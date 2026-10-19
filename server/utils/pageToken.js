// טוקן דף קצר-מועד: נוצר בכל טעינת דף (מוטמע ב-HTML כ-<meta>), ונדרש לקריאות
// נתוני הטורנירים — כך שאי אפשר פשוט לקרוא ל-API בלולאה בלי לטעון את האתר.
//
// מבנה: base64url(JSON payload) + '.' + HMAC-SHA256. ה-payload כולל גם
// גיבובים של מזהי טורנירי "פיתיון" (canary) — הדף משתמש בהם כדי לא להציג אותם
// לגולשים, בלי שהתגובה של ה-API עצמה תסמן אותם.
const crypto = require('crypto');
const config = require('../config/antiScraping');

function secret() {
  if (process.env.PAGE_TOKEN_SECRET) return process.env.PAGE_TOKEN_SECRET;
  if (!process.env.JWT_SECRET) throw new Error('PAGE_TOKEN_SECRET / JWT_SECRET not set');
  // נגזר מ-JWT_SECRET כדי שלא יהיה צורך במשתנה סביבה נוסף — אבל לא זהה לו
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update('page-token-v1').digest('hex');
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

// גיבוב מזהה טורניר לפי מזהה הסשן — אותו חישוב בדיוק נעשה בדפדפן (client/src/utils/pageToken.js)
function canaryHash(sid, tournamentId) {
  return crypto.createHash('sha256').update(`${sid}:${tournamentId}`).digest('hex').slice(0, 16);
}

function issue({ canaryIds = [], wm = null, now = Date.now() } = {}) {
  const sid = crypto.randomBytes(9).toString('base64url');
  const payload = {
    s: sid,
    e: Math.floor(now / 1000) + config.pageToken.ttlSeconds,
    h: canaryIds.map((id) => canaryHash(sid, id)),
    ...(wm && { w: wm }), // קוד סימן המים של הגולש (middleware/antiScraping.js → watermarkCode)
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

// מחזיר { ok: true, sid } או { ok: false, reason: 'missing' | 'invalid' | 'expired' }
function verify(token, now = Date.now()) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const [body, mac] = token.split('.');
  if (!body || !mac) return { ok: false, reason: 'invalid' };
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'invalid' };
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { return { ok: false, reason: 'invalid' }; }
  if (!payload.e || payload.e * 1000 < now) return { ok: false, reason: 'expired' };
  return { ok: true, sid: payload.s };
}

module.exports = { issue, verify, canaryHash };
