// ניקוי שדות קישור שמוצגים לגולשים (קישור הרשמה, אתר מועדון).
// רק http/https — קישור כמו javascript:... היה רץ בדפדפן של מי שלוחץ על "הרשמה".
// כתובת בלי פרוטוקול (www.club.co.il) מקבלת https:// אוטומטית.
// מחזיר { ok: true, value } (value=null לשדה ריק) או { ok: false }.
function cleanUrlField(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const v = String(raw).trim();
  if (!v) return { ok: true, value: null };
  if (v.length > 500) return { ok: false };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`;
  let u;
  try { u = new URL(withScheme); } catch { return { ok: false }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false };
  return { ok: true, value: withScheme };
}

const BAD_URL_MESSAGE = 'קישור לא תקין — יש להזין כתובת אתר שמתחילה ב-https://';

module.exports = { cleanUrlField, BAD_URL_MESSAGE };
