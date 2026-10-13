// הגנת SSRF — חסימת משיכת URL שמצביע לרשת פנימית/לוקאלית
const dns = require('dns').promises;
const axios = require('axios');

function isPrivateIp(ip) {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const a = Number(v4[1]), b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;            // this-host / private / loopback
    if (a === 169 && b === 254) return true;                       // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;              // private
    if (a === 192 && b === 168) return true;                       // private
    if (a === 100 && b >= 64 && b <= 127) return true;             // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('fe80')) return true;                         // link-local
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.replace('::ffff:', ''));
  return false;
}

// זורק שגיאה אם ה-URL אינו בטוח למשיכה מצד השרת
async function assertSafeUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error('כתובת קישור לא תקינה'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('פרוטוקול לא נתמך — רק http/https');

  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('כתובת פנימית חסומה');
  }
  // אם ה-host הוא IP מפורש
  if (isPrivateIp(host)) throw new Error('כתובת מצביעה לרשת פנימית — חסום');

  // פתרון DNS — לחסום גם hostname שמתרגם ל-IP פנימי
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); }
  catch { throw new Error('לא ניתן לפתור את כתובת הקישור'); }
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error('הקישור מצביע לרשת פנימית — חסום');
  }
}

// אפשרויות axios בטוחות (הגבלת redirects + timeout)
const SAFE_AXIOS = {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokerIsraelBot/1.0)' },
  timeout: 20000,
  maxContentLength: 10 * 1024 * 1024,
  maxRedirects: 3,
};

// lookup שמסרב לכתובת פנימית — רץ ברגע החיבור עצמו, כך שגם DNS שמשתנה בין
// הבדיקה לבקשה (DNS rebinding) לא יכול להפנות את השרת לרשת הפנימית
function safeLookup(hostname, options, callback) {
  require('dns').lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return callback(err);
    const bad = addrs.find(a => isPrivateIp(a.address));
    if (bad) return callback(new Error('הקישור מצביע לרשת פנימית — חסום'));
    if (options && options.all) return callback(null, addrs);
    callback(null, addrs[0].address, addrs[0].family);
  });
}

// GET בטוח: כל הפניה (redirect) נבדקת מחדש — axios לבדו עוקב אחרי הפניות בלי
// לבדוק אותן, כך שקישור חיצוני יכל להפנות ל-http://10.x.x.x או ל-*.railway.internal
async function safeGet(url, extra = {}) {
  let current = url;
  for (let hop = 0; hop <= SAFE_AXIOS.maxRedirects; hop++) {
    await assertSafeUrl(current);
    const res = await axios.get(current, {
      ...SAFE_AXIOS,
      ...extra,
      maxRedirects: 0,
      lookup: safeLookup,
      validateStatus: s => (s >= 200 && s < 300) || (s >= 300 && s < 400),
    });
    if (res.status < 300) return res;
    const location = res.headers.location;
    if (!location) throw new Error('הפניה ללא יעד');
    current = new URL(location, current).toString();
  }
  throw new Error('יותר מדי הפניות');
}

module.exports = { assertSafeUrl, isPrivateIp, SAFE_AXIOS, safeGet };
