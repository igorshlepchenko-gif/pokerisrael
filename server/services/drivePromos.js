// ── פרסומי אונליין שמגיעים מתיקיית Google Drive ציבורית (כרגע: Ludus) ──────
// בשעות שבהגדרות (index.js) השרת קורא את התיקייה, מוריד את התמונות שבה ומחליף את
// הפרסומים של הקלאב — מה שבתיקייה הוא מה שמוצג. אין צורך בדפלוי כשהפרסום מתחלף.
//
// התמונות נשמרות ב-uploads/online-promos/<club>/ (Volume קבוע ב-Railway) והרשימה
// ב-app_settings ('drive_promos'). הדפדפן מקבל אותה מוטמעת ב-index.html
// (middleware/antiScraping.js → renderIndexHtml) — אין קריאה נוספת לשרת.
//
// הגנה מתקלות: אם קריאת התיקייה נכשלת — הפרסום הקיים נשאר. תיקייה ריקה (נקראה בהצלחה)
// = אין פרסום לקלאב.
const fs = require('fs');
const path = require('path');
const fileType = require('file-type');
const pool = require('../config/db');
const { safeGet } = require('../utils/safeUrl');

const SOURCES = [
  { clubId: 'ludus', clubName: 'Ludus', folderId: '1VXKQP_Ze_JEm3R6uFW7rqhczyyIXDwM3' },
];

const UPLOADS = path.join(__dirname, '../uploads/online-promos');
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILES = 10;

let cache = null; // { [clubId]: { promos: [...], syncedAt, error? } }

async function loadState() {
  if (cache) return cache;
  try {
    const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'drive_promos'`);
    cache = r.rows[0] ? JSON.parse(r.rows[0].value) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function saveState(state) {
  cache = state;
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('drive_promos', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(state)]
  );
}

// רשימת הקבצים בתיקייה ציבורית — דרך עמוד ה"תצוגה המוטמעת" של Drive (לא דורש מפתח API).
// מחזיר [{ id, name }] או זורק שגיאה אם הדף לא נראה כמו תיקייה.
async function listFolder(folderId) {
  const res = await safeGet(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`, {
    responseType: 'text',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokerIsraelBot/1.0)', 'Accept-Language': 'he,en' },
  });
  const html = String(res.data || '');
  if (!html.includes('flip-entries')) throw new Error('Drive folder page not recognized');
  const files = [];
  const re = /id="entry-([A-Za-z0-9_-]{10,})"[\s\S]*?class="flip-entry-title">([^<]*)</g;
  let m;
  while ((m = re.exec(html)) && files.length < MAX_FILES) {
    files.push({ id: m[1], name: m[2].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() });
  }
  return files;
}

async function downloadImage(fileId) {
  const res = await safeGet(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, {
    responseType: 'arraybuffer',
    maxContentLength: 8 * 1024 * 1024,
  });
  const buf = Buffer.from(res.data);
  const type = await fileType.fromBuffer(buf);
  if (!type || !IMAGE_MIMES.has(type.mime)) return null; // לא תמונה (סרטון, מסמך, דף אזהרה של Drive)
  return { buf, ext: type.ext === 'jpg' ? 'jpg' : type.ext };
}

async function syncSource(src) {
  const dir = path.join(UPLOADS, src.clubId);
  fs.mkdirSync(dir, { recursive: true });
  const files = await listFolder(src.folderId);
  const promos = [];
  for (const f of files) {
    try {
      const existing = fs.readdirSync(dir).find((n) => n.startsWith(f.id + '.'));
      let fileName = existing;
      if (!existing) {
        const img = await downloadImage(f.id);
        if (!img) continue;
        fileName = `${f.id}.${img.ext}`;
        fs.writeFileSync(path.join(dir, fileName), img.buf);
      }
      promos.push({
        id: `drive-${src.clubId}-${f.id}`,
        clubId: src.clubId,
        image: `/uploads/online-promos/${src.clubId}/${fileName}`,
        alt: `${src.clubName} — ${f.name.replace(/\.[a-z0-9]+$/i, '')}`,
        source: 'drive',
      });
    } catch (err) {
      console.error(`[drivePromos] ${src.clubId}/${f.name}:`, err.message);
    }
  }
  // מחיקת קבצים שכבר לא בתיקייה
  const keep = new Set(promos.map((p) => path.basename(p.image)));
  for (const n of fs.readdirSync(dir)) if (!keep.has(n)) fs.unlinkSync(path.join(dir, n));
  return promos;
}

async function syncDrivePromos() {
  const state = { ...(await loadState()) };
  const summary = {};
  for (const src of SOURCES) {
    try {
      const promos = await syncSource(src);
      state[src.clubId] = { promos, syncedAt: new Date().toISOString() };
      summary[src.clubId] = promos.length;
    } catch (err) {
      // התיקייה לא נקראה — משאירים את הפרסום הקיים
      state[src.clubId] = { ...(state[src.clubId] || { promos: [] }), error: err.message, failedAt: new Date().toISOString() };
      summary[src.clubId] = `error: ${err.message}`;
    }
  }
  await saveState(state);
  return summary;
}

// לשימוש סינכרוני בהזרקה ל-index.html (המטמון נטען בהפעלת השרת)
function currentDrivePromos() {
  if (!cache) return [];
  return SOURCES.flatMap((s) => cache[s.clubId]?.promos || []);
}

module.exports = { syncDrivePromos, currentDrivePromos, loadState, listFolder, SOURCES };
