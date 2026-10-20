// ── פרסומי אונליין שמגיעים מתיקיות Google Drive ציבוריות (תיקייה לכל קלאב) ──
// בשעות שבהגדרות (index.js) השרת קורא את התיקיות, מוריד את התמונות שבהן ומחליף את
// הפרסומים של כל קלאב — מה שבתיקייה הוא מה שמוצג. אין צורך בדפלוי כשהפרסום מתחלף.
// קלאב עם תיקייה מקבל את הפרסומים רק ממנה (פרסומי האקסל שלו מתעלמים — onlineClubs.js).
//
// התיקיות נקבעות בפאנל הניהול (app_settings 'drive_promo_folders' = { clubId: { folderId, clubName } }).
// עד שנשמרה הגדרה כלשהי — DEFAULT_FOLDERS (Ludus, שהוגדר לפני שהיה ממשק).
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

const DEFAULT_FOLDERS = {
  ludus: { clubName: 'Ludus', folderId: '1VXKQP_Ze_JEm3R6uFW7rqhczyyIXDwM3' },
};

const UPLOADS = path.join(__dirname, '../uploads/online-promos');
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILES = 10;

let cache = null; // { [clubId]: { promos: [...], syncedAt, error? } }
let folders = null; // { [clubId]: { clubName, folderId } }

async function loadFolders() {
  if (folders) return folders;
  try {
    const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'drive_promo_folders'`);
    folders = r.rows[0] ? JSON.parse(r.rows[0].value) : { ...DEFAULT_FOLDERS };
  } catch {
    folders = { ...DEFAULT_FOLDERS };
  }
  return folders;
}

async function saveFolders(next) {
  folders = next;
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('drive_promo_folders', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(next)]
  );
}

// מזהה תיקייה מתוך קישור שיתוף (drive.google.com/drive/folders/<id>?usp=sharing, ...?id=<id>) או מזהה לבד
function parseFolderId(input) {
  const s = String(input || '').trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || s.match(/^([A-Za-z0-9_-]{10,})$/);
  return m ? m[1] : null;
}

// כמו promoTitleFromFile בסקריפט ייבוא האקסל: שם קובץ אוטומטי (WhatsApp Image, IMG...) → ''
function titleFromFile(name) {
  const t = String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/^(whatsapp image|whatsapp video|img|image|photo|screenshot|צילום מסך|dsc|pxl)\b/i.test(t)) return '';
  if (!/[a-zA-Z֐-׿]/.test(t)) return '';
  return t;
}

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
  const images = [];
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
      images.push({ f, fileName });
    } catch (err) {
      console.error(`[drivePromos] ${src.clubId}/${f.name}:`, err.message);
    }
  }
  images.forEach(({ f, fileName }, i) => promos.push({
    id: `drive-${src.clubId}-${f.id}`,
    clubId: src.clubId,
    image: `/uploads/online-promos/${src.clubId}/${fileName}`,
    alt: `${src.clubName} — ${titleFromFile(f.name) || `פרסום${images.length > 1 ? ` ${i + 1}` : ''}`}`,
    source: 'drive',
  }));
  // מחיקת קבצים שכבר לא בתיקייה
  const keep = new Set(promos.map((p) => path.basename(p.image)));
  for (const n of fs.readdirSync(dir)) if (!keep.has(n)) fs.unlinkSync(path.join(dir, n));
  return promos;
}

// onlyClubId — סנכרון קלאב אחד (אחרי שמירת תיקייה בפאנל)
async function syncDrivePromos(onlyClubId = null) {
  const state = { ...(await loadState()) };
  const conf = await loadFolders();
  const sources = Object.entries(conf).map(([clubId, c]) => ({ clubId, ...c }));
  // קלאב שהתיקייה שלו הוסרה — הפרסומים שלו יורדים, והקבצים נמחקים
  for (const clubId of Object.keys(state)) {
    if (conf[clubId]) continue;
    delete state[clubId];
    fs.rmSync(path.join(UPLOADS, clubId), { recursive: true, force: true });
  }
  const summary = {};
  for (const src of sources) {
    if (onlyClubId && src.clubId !== onlyClubId) continue;
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

// לשימוש סינכרוני בהזרקה ל-index.html (המטמון נטען בהפעלת השרת — loadState + loadFolders)
function currentDrivePromos() {
  if (!cache || !folders) return [];
  return Object.keys(folders).flatMap((clubId) => cache[clubId]?.promos || []);
}
// הקלאבים שהפרסומים שלהם מגיעים מ-Drive (גם אם התיקייה ריקה כרגע)
function currentDriveClubs() {
  return folders ? Object.keys(folders) : Object.keys(DEFAULT_FOLDERS);
}

// לפאנל הניהול: לכל קלאב עם תיקייה — הקישור, מספר הפרסומים ומתי סונכרן
async function driveStatus() {
  const [conf, state] = [await loadFolders(), await loadState()];
  return Object.entries(conf).map(([clubId, c]) => ({
    clubId,
    clubName: c.clubName,
    folderId: c.folderId,
    folderUrl: `https://drive.google.com/drive/folders/${c.folderId}`,
    promos: (state[clubId]?.promos || []).map((p) => ({ image: p.image, alt: p.alt })),
    syncedAt: state[clubId]?.syncedAt || null,
    error: state[clubId]?.error || null,
    failedAt: state[clubId]?.failedAt || null,
  }));
}

// שמירת/הסרת תיקייה לקלאב. בודק שהתיקייה נפתחת (ציבורית) לפני השמירה, ומסנכרן מיד.
async function setClubFolder(clubId, clubName, link) {
  if (!/^[a-z0-9-]{1,40}$/.test(String(clubId || ''))) throw Object.assign(new Error('קלאב לא תקין'), { status: 400 });
  const conf = { ...(await loadFolders()) };
  if (!link) {
    delete conf[clubId];
    await saveFolders(conf);
    await syncDrivePromos(clubId);
    return { removed: true };
  }
  const folderId = parseFolderId(link);
  if (!folderId) throw Object.assign(new Error('זה לא נראה כמו קישור לתיקייה בגוגל דרייב'), { status: 400 });
  try {
    await listFolder(folderId);
  } catch {
    throw Object.assign(new Error('לא הצלחתי לפתוח את התיקייה. ודא שהשיתוף הוא "כל מי שיש לו את הקישור" (צפייה)'), { status: 400 });
  }
  conf[clubId] = { clubName: String(clubName || clubId).slice(0, 60), folderId };
  await saveFolders(conf);
  const summary = await syncDrivePromos(clubId);
  return { folderId, synced: summary[clubId] };
}

module.exports = {
  syncDrivePromos, currentDrivePromos, currentDriveClubs, loadState, loadFolders, listFolder,
  driveStatus, setClubFolder, parseFolderId, titleFromFile, DEFAULT_FOLDERS,
};
