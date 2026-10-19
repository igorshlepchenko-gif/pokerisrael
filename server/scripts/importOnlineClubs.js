/**
 * ייבוא קלאבים ופרסומים לעמוד "פוקר אונליין" מקובץ Excel אחד.
 *
 *   node server/scripts/importOnlineClubs.js --template   ← יוצר את קובץ ה-Excel (רק אם לא קיים)
 *   node server/scripts/importOnlineClubs.js              ← קורא אותו ומעדכן את האתר
 *
 * הקובץ: online-clubs/online-clubs.xlsx (בשורש הפרויקט). מה הייבוא עושה:
 *  1. בודק כל שורה (שדות חובה, תאריכים, קבצים קיימים) — שגיאה אחת עוצרת הכל, בלי לכתוב כלום.
 *  2. מעתיק ומכווץ לוגואים ופרסומים מהנתיבים במחשב אל client/public/online-clubs/.
 *  3. כותב את client/src/data/onlineClubs.generated.json — הקובץ שהאתר קורא ממנו.
 * כיווץ התמונות נעשה עם Python + Pillow (קיימים במחשב הפיתוח), לא בשרת.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ExcelJS = require('exceljs');

const ROOT = path.resolve(__dirname, '..', '..');
const XLSX = process.env.ONLINE_CLUBS_XLSX || path.join(ROOT, 'online-clubs', 'online-clubs.xlsx');
const PUBLIC_DIR = path.join(ROOT, 'client', 'public', 'online-clubs');
const OUT_JSON = path.join(ROOT, 'client', 'src', 'data', 'onlineClubs.generated.json');
const DEFAULT_AGENT_NUMBER = '50682245';

const CLUB_COLS = [
  ['id', 'מזהה (אופציונלי, אנגלית)', 22],
  ['name', 'שם הקלאב *', 22],
  ['platform', 'פלטפורמה', 12],
  ['clubNumber', 'מספר מועדון *', 15],
  ['agentNumber', `מספר סוכן (ריק = ${DEFAULT_AGENT_NUMBER})`, 22],
  ['games', 'משחקים (בפסיקים: NLH, PLO, PLO5)', 26],
  ['levels', 'גבהים (בפסיקים: נמוך, בינוני, גבוה)', 28],
  ['stakes', 'גובה משחק (טקסט חופשי)', 36],
  ['hours', 'שעות פעילות', 30],
  ['note', 'הערה / תיאור קצר', 40],
  ['logo', 'נתיב לוגו במחשב', 60],
  ['active', 'פעיל (כן/לא)', 12],
  ['promoFolder', 'תיקיית פרסומים (כל התמונות שבה מתפרסמות)', 70],
];
const PROMO_COLS = [
  ['club', 'שם הקלאב *', 22],
  ['source', 'נתיב תמונה או תיקייה *', 70],
  ['from', 'מתאריך *', 14],
  ['to', 'עד תאריך (כולל) *', 16],
  ['alt', 'תיאור הפרסום (אופציונלי)', 44],
  ['active', 'פעיל (כן/לא)', 12],
];
// גבהים — מזוהים לפי מילות מפתח בכל טקסט ("נמוכים", "בליינדים נמוכים ובינוניים" וכו')
const LEVEL_WORDS = [[/נמו[כך]|low/i, 'low'], [/בינונ|mid/i, 'mid'], [/גבו[הה]|high/i, 'high']];
function parseLevels(text) {
  return LEVEL_WORDS.filter(([re]) => re.test(text)).map(([, key]) => key);
}
// משחקים — מחלצים סימונים מוכרים מכל טקסט ("משחקי קאש: NLH, PLO4/5/6" → NLH, PLO4, PLO5, PLO6)
function parseGames(text) {
  const out = [];
  const add = (g) => { if (!out.includes(g)) out.push(g); };
  const t = text.toUpperCase();
  for (const m of t.matchAll(/PLO\s*(\d(?:\s*\/\s*\d)*)?/g)) {
    if (m[1]) m[1].split('/').map(d => d.trim()).forEach(d => add(`PLO${d}`));
    else add('PLO');
  }
  for (const g of ['NLH', 'MTT', 'SNG', 'OFC', 'SHORT DECK']) if (t.includes(g)) add(g);
  // סדר קבוע ונוח לקריאה: NLH קודם, אחריו אומהה לפי מספר קלפים, ואז פורמטים
  const ORDER = ['NLH', 'PLO', 'PLO4', 'PLO5', 'PLO6', 'MTT', 'SNG', 'OFC', 'SHORT DECK'];
  return out.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}
const IMG_EXT = /\.(jpe?g|png|webp)$/i;

// ---------- עזר ----------
function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.text) return String(v.text).trim();                       // hyperlink
    if (v.richText) return v.richText.map(r => r.text).join('').trim();
    if (v.result != null) return cellText(v.result);                 // formula
  }
  return String(v).trim();
}
// תאריך: Date של Excel, או טקסט 2026-10-05 / 05/10/2026 / 5.10.2026
function toIsoDate(v) {
  if (v instanceof Date) {
    // Excel שומר תאריך כחצות UTC — לוקחים את הרכיבים ב-UTC כדי לא לזוז ביום
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  const s = cellText(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
const isNo = (v) => /^(לא|no|false|0)$/i.test(cellText(v));
const list = (v) => cellText(v).split(/[,،;]/).map(s => s.trim()).filter(Boolean);
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// שם הפרסום משם הקובץ ("Mega Sunday 120K.jpg" → "Mega Sunday 120K"). שמות אוטומטיים של
// וואטסאפ / מצלמה / צילום מסך לא אומרים כלום — מחזירים ריק, ואז נכתב "פרסום N"
function promoTitleFromFile(file) {
  const name = path.parse(file).name.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  if (/^(whatsapp image|whatsapp video|img|image|photo|screenshot|צילום מסך|dsc|pxl)\b/i.test(name)) return '';
  if (!/[a-zA-Z֐-׿]/.test(name)) return ''; // רק מספרים/תאריכים
  return name;
}

function readSheet(ws, cols) {
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return; // כותרות
    const obj = { _row: n };
    cols.forEach(([key], i) => { obj[key] = row.getCell(i + 1).value; });
    if (cols.every(([key]) => !cellText(obj[key]))) return; // שורה ריקה
    rows.push(obj);
  });
  return rows;
}

// כיווץ תמונה ל-JPEG ברוחב מקסימלי (Python + Pillow)
function compressImage(src, dest, maxWidth, quality) {
  const py = [
    'import sys',
    'from PIL import Image',
    'src, dest, mw, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])',
    'im = Image.open(src).convert("RGB")',
    'w, h = im.size',
    'im = im.resize((mw, round(h * mw / w)), Image.LANCZOS) if w > mw else im',
    'im.save(dest, quality=q, optimize=True)',
    'print(f"{im.size[0]}x{im.size[1]}")',
  ].join('\n');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // מחזיר את מידות התמונה הסופית — כדי שהקרוסלה תתאים את המסגרת לצורת כל פרסום
  const out = execFileSync('python', ['-c', py, src, dest, String(maxWidth), String(quality)], { stdio: 'pipe' }).toString().trim();
  const [width, height] = out.split('x').map(Number);
  return { width, height };
}

// ---------- תבנית ----------
async function writeTemplate() {
  if (fs.existsSync(XLSX)) {
    console.log(`הקובץ כבר קיים, לא נדרס: ${XLSX}`);
    return;
  }
  const wb = new ExcelJS.Workbook();
  const header = (ws, cols) => {
    ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
    ws.columns = cols.map(([key, header, width]) => ({ key, header, width }));
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B21B6' } };
    r.height = 22;
  };
  const yesNo = (ws, col) => {
    for (let i = 2; i <= 300; i++) {
      ws.getCell(`${col}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"כן,לא"'] };
    }
  };

  const clubs = wb.addWorksheet('קלאבים');
  header(clubs, CLUB_COLS);
  for (let i = 2; i <= 300; i++) {
    clubs.getCell(`C${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"clubgg"'] };
  }
  yesNo(clubs, 'L');
  clubs.addRow({
    id: 'only-friends', name: 'Only Friends', platform: 'clubgg', clubNumber: '277949', agentNumber: '',
    games: 'NLH, PLO5', levels: 'נמוך, בינוני, גבוה',
    stakes: 'טורנירים · באי-אין 75–1,200 ₪ + פריירולים',
    hours: 'טורנירים כל יום, אירועים מרכזיים ב-21:15',
    note: 'קהילת פוקר עם לוח טורנירים שבועי ופריירולים לכרטיסים',
    logo: 'C:\\Users\\MS\\Pictures\\Screenshots\\clubonline\\onlyfriends\\onlyfriendslogo.jpeg',
    active: 'כן',
  });
  clubs.getColumn('clubNumber').numFmt = '@';
  clubs.getColumn('agentNumber').numFmt = '@';

  const promos = wb.addWorksheet('פרסומים');
  header(promos, PROMO_COLS);
  yesNo(promos, 'F');
  promos.getColumn('from').numFmt = 'dd/mm/yyyy';
  promos.getColumn('to').numFmt = 'dd/mm/yyyy';
  const dir = 'C:\\Users\\MS\\Pictures\\Screenshots\\clubonline\\onlyfriends\\pirsum\\5_12october';
  promos.addRow({ club: 'Only Friends', source: `${dir}\\WhatsApp Image 2026-10-111 at 02.40.15.jpeg`, from: '05/10/2026', to: '12/10/2026', alt: 'לוח טורנירי יום ראשון', active: 'כן' });
  promos.addRow({ club: 'Only Friends', source: `${dir}\\WhatsApp Image 2026-10-11 at 02.40.15.jpeg`, from: '05/10/2026', to: '12/10/2026', alt: 'Mega Sunday 120K GTD, באי-אין 777, 21:15', active: 'כן' });
  promos.addRow({ club: 'Only Friends', source: `${dir}\\WhatsApp Image 202116-10-11 at 02.40.15.jpeg`, from: '05/10/2026', to: '12/10/2026', alt: 'Super Saturday 150K GTD, באי-אין 1200, 21:15', active: 'כן' });

  const help = wb.addWorksheet('הוראות');
  help.views = [{ rightToLeft: true }];
  help.getColumn(1).width = 110;
  [
    'איך ממלאים',
    '',
    'גיליון "קלאבים" — שורה לכל קלאב:',
    '• חובה: שם הקלאב, מספר מועדון.',
    `• מספר סוכן: להשאיר ריק = הסוכן הראשי ${DEFAULT_AGENT_NUMBER}.`,
    '• משחקים וגבהים: כמה ערכים מופרדים בפסיק. גבהים: נמוך / בינוני / גבוה (לסינון בעמוד).',
    '• נתיב לוגו: הנתיב המלא לקובץ במחשב (קליק ימני על הקובץ ← "העתק כנתיב", ולהדביק בלי המירכאות).',
    '• מזהה: אפשר להשאיר ריק אם השם באנגלית — נוצר אוטומטית מהשם. לקלאב עם שם בעברית — לכתוב מזהה באנגלית.',
    '• פעיל = לא ← הקלאב לא מוצג באתר (בלי למחוק את השורה).',
    '',
    '• תיקיית פרסומים: כל התמונות שיושבות ישירות בתיקייה הזו מתפרסמות ברחבי האתר, בלי תאריכים.',
    '  מוסיפים תמונה לתיקייה = היא עולה. מוחקים/מעבירים אותה = היא יורדת. (תתי-תיקיות לא נסרקות.)',
    '  שם הקובץ = שם הפרסום (מופיע בהודעת הוואטסאפ לסוכן), למשל "Mega Sunday 120K.jpg". שמות אוטומטיים כמו "WhatsApp Image..." מוצגים כ"פרסום 1, 2...".',
    '  הסריקה רצה אוטומטית פעם ביום, או מיד כשמבקשים מ-Claude "תייבא".',
    '',
    'גיליון "פרסומים" (אופציונלי) — לפרסום עם תאריכי תוקף, שורה לכל תמונה או לתיקייה:',
    '• שם הקלאב: בדיוק כמו בגיליון "קלאבים".',
    '• נתיב: לקובץ תמונה, או לתיקייה — ואז כל התמונות בתיקייה נכנסות עם אותם תאריכים.',
    '• מתאריך / עד תאריך: הפרסום מוצג רק בטווח הזה (כולל), ויורד לבד אחריו.',
    '• תיאור: מוצג לקוראי מסך ובהודעת הוואטסאפ לסוכן. אפשר להשאיר ריק.',
    '',
    'אחרי השמירה — לבקש מ-Claude להריץ את הייבוא (או: node server/scripts/importOnlineClubs.js).',
    'הייבוא בודק הכל לפני שהוא משנה משהו: אם יש שגיאה, תקבל רשימה של השורות לתיקון ושום דבר לא משתנה.',
  ].forEach(t => help.addRow([t]));
  help.getRow(1).font = { bold: true, size: 14 };

  fs.mkdirSync(path.dirname(XLSX), { recursive: true });
  await wb.xlsx.writeFile(XLSX);
  console.log(`נוצר: ${XLSX}`);
}

// ---------- ייבוא ----------
async function runImport() {
  if (!fs.existsSync(XLSX)) {
    console.error(`לא נמצא קובץ: ${XLSX}\nהריצו קודם עם --template`);
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const clubSheet = wb.getWorksheet('קלאבים');
  const promoSheet = wb.getWorksheet('פרסומים');
  if (!clubSheet || !promoSheet) {
    console.error('חסר גיליון "קלאבים" או "פרסומים" בקובץ');
    process.exit(1);
  }

  const errors = [];
  const warnings = [];
  const clubs = [];
  const seenIds = new Set();
  // קלאבים מושבתים (פעיל = לא) — נזכרים כדי שהפרסומים שלהם יידלגו בשקט ולא ייחשבו שגיאה
  const inactiveClubs = new Set();

  for (const r of readSheet(clubSheet, CLUB_COLS)) {
    const where = `קלאבים, שורה ${r._row}`;
    if (isNo(r.active)) {
      const n = cellText(r.name).toLowerCase();
      if (n) inactiveClubs.add(n);
      if (cellText(r.id)) inactiveClubs.add(cellText(r.id).toLowerCase());
      continue;
    }
    const name = cellText(r.name);
    const clubNumber = cellText(r.clubNumber);
    const id = cellText(r.id) || slugify(name);
    if (!name) errors.push(`${where}: חסר שם קלאב`);
    if (!clubNumber) errors.push(`${where}: חסר מספר מועדון`);
    if (!id) errors.push(`${where}: לשם בעברית צריך למלא "מזהה" באנגלית`);
    else if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${where}: מזהה "${id}" — רק אותיות אנגליות קטנות, ספרות ומקף`);
    else if (seenIds.has(id)) errors.push(`${where}: המזהה "${id}" כבר קיים בשורה אחרת`);
    seenIds.add(id);

    const levelsText = cellText(r.levels);
    const levels = parseLevels(levelsText);
    if (levelsText && levels.length === 0) {
      warnings.push(`${where}: לא זוהה גובה ב"${levelsText}" — הקלאב לא יופיע בסינון לפי גובה`);
    }
    // טקסט ארוך בעמודת הגבהים ובלי "גובה משחק" — כנראה זה התיאור של הגובה; מציגים אותו
    const stakes = cellText(r.stakes) || (levelsText.length > 12 ? levelsText : '');
    const gamesText = cellText(r.games);
    const games = parseGames(gamesText);
    if (gamesText && games.length === 0) warnings.push(`${where}: לא זוהו משחקים ב"${gamesText}"`);

    const promoFolder = cellText(r.promoFolder).replace(/^"|"$/g, '');

    const logoSrc = cellText(r.logo).replace(/^"|"$/g, '');
    if (logoSrc && !fs.existsSync(logoSrc)) errors.push(`${where}: קובץ הלוגו לא נמצא — ${logoSrc}`);

    const agentNumber = cellText(r.agentNumber);
    clubs.push({
      id, name,
      platform: cellText(r.platform) || 'clubgg',
      clubNumber,
      ...(agentNumber && agentNumber !== DEFAULT_AGENT_NUMBER ? { agentNumber } : {}),
      games,
      levels,
      ...(stakes ? { stakes } : {}),
      ...(cellText(r.hours) ? { hours: cellText(r.hours) } : {}),
      ...(cellText(r.note) ? { note: cellText(r.note) } : {}),
      _logoSrc: logoSrc,
      _promoFolder: promoFolder,
    });
  }

  // פרסומים מתיקיית הקלאב — כל התמונות שיושבות ישירות בתיקייה (לא בתתי-תיקיות), בלי תאריכים:
  // מה שבתיקייה מתפרסם, מה שהוסר ממנה יורד בייבוא הבא. תיקייה שעוד לא קיימת — רק הודעה.
  const promos = [];
  for (const c of clubs) {
    const dir = c._promoFolder;
    delete c._promoFolder;
    if (!dir) continue;
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      warnings.push(`${c.name}: תיקיית הפרסומים עוד לא קיימת — ${dir}`);
      continue;
    }
    fs.readdirSync(dir).filter(f => IMG_EXT.test(f)).sort().forEach((f, i, all) => promos.push({
      clubId: c.id, clubName: c.name, from: null, to: null, src: path.join(dir, f), folder: true,
      alt: `${c.name} — ${promoTitleFromFile(f) || `פרסום${all.length > 1 ? ` ${i + 1}` : ''}`}`,
    }));
  }

  for (const r of readSheet(promoSheet, PROMO_COLS)) {
    const where = `פרסומים, שורה ${r._row}`;
    if (isNo(r.active)) continue;
    const clubName = cellText(r.club);
    if (inactiveClubs.has(clubName.toLowerCase())) continue; // קלאב מושבת זמנית — גם הפרסומים שלו יורדים
    const club = clubs.find(c => c.name.toLowerCase() === clubName.toLowerCase() || c.id === clubName.toLowerCase());
    if (!club) { errors.push(`${where}: הקלאב "${clubName}" לא נמצא בגיליון "קלאבים" (או שהוא לא פעיל)`); continue; }
    const from = toIsoDate(r.from);
    const to = toIsoDate(r.to);
    if (!from) errors.push(`${where}: "מתאריך" לא תקין`);
    if (!to) errors.push(`${where}: "עד תאריך" לא תקין`);
    if (from && to && from > to) errors.push(`${where}: "מתאריך" אחרי "עד תאריך"`);

    const source = cellText(r.source).replace(/^"|"$/g, '');
    let files = [];
    if (!source || !fs.existsSync(source)) {
      errors.push(`${where}: הנתיב לא נמצא — ${source || '(ריק)'}`);
    } else if (fs.statSync(source).isDirectory()) {
      files = fs.readdirSync(source).filter(f => IMG_EXT.test(f)).sort().map(f => path.join(source, f));
      if (files.length === 0) errors.push(`${where}: אין תמונות בתיקייה — ${source}`);
    } else if (!IMG_EXT.test(source)) {
      errors.push(`${where}: הקובץ אינו תמונה (jpg/png/webp) — ${source}`);
    } else {
      files = [source];
    }
    const alt = cellText(r.alt);
    files.forEach((f, i) => promos.push({
      clubId: club.id, clubName: club.name, from, to, src: f,
      alt: alt ? `${club.name} — ${alt}${files.length > 1 ? ` (${i + 1})` : ''}` : `${club.name} — פרסום`,
    }));
  }

  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} הערות (לא עוצרות את הייבוא):`);
    warnings.forEach(w => console.log('  • ' + w));
  }
  if (errors.length) {
    console.error(`\n❌ נמצאו ${errors.length} בעיות — לא שונה כלום:\n`);
    errors.forEach(e => console.error('  • ' + e));
    process.exit(1);
  }

  // כתיבה — רק אחרי שהכל תקין. בונים מחדש את תיקיית הנכסים כדי שקבצים של קלאבים/פרסומים
  // שהוסרו מהאקסל לא יישארו מיותמים.
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(PUBLIC_DIR, 'promos'), { recursive: true });

  for (const c of clubs) {
    if (c._logoSrc) {
      compressImage(c._logoSrc, path.join(PUBLIC_DIR, `${c.id}-logo.jpg`), 600, 88);
      c.logo = `/online-clubs/${c.id}-logo.jpg`;
    }
    delete c._logoSrc;
  }

  const counters = {};
  const outPromos = promos.map(p => {
    const key = `${p.clubId}-${p.folder ? 'folder' : p.from}`;
    counters[key] = (counters[key] || 0) + 1;
    const id = `${key}-${counters[key]}`;
    const { width, height } = compressImage(p.src, path.join(PUBLIC_DIR, 'promos', `${id}.jpg`), 900, 82);
    return { id, clubId: p.clubId, image: `/online-clubs/promos/${id}.jpg`, width, height, alt: p.alt, ...(p.from ? { validFrom: p.from, validTo: p.to } : {}) };
  });

  fs.writeFileSync(OUT_JSON, JSON.stringify({ clubs, promos: outPromos }, null, 2) + '\n', 'utf8');

  console.log(`\n✅ יובאו ${clubs.length} קלאבים ו-${outPromos.length} פרסומים`);
  clubs.forEach(c => {
    const n = outPromos.filter(p => p.clubId === c.id).length;
    console.log(`  • ${c.name} (${c.clubNumber}) — ${n} פרסומים${c.logo ? '' : ' — בלי לוגו'}`);
  });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  const live = outPromos.filter(p => (!p.validFrom || p.validFrom <= today) && (!p.validTo || today <= p.validTo)).length;
  console.log(`  פרסומים בתוקף היום (${today}): ${live} מתוך ${outPromos.length}`);
}

(process.argv.includes('--template') ? writeTemplate() : runImport()).catch(err => {
  console.error(err);
  process.exit(1);
});
