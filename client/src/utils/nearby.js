import { currentOccurrence, startInstant, lateRegCloseTime, tzParts, zonedTimeToUTC, IL_TZ } from './whatsapp';

// ── מרחק ──────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;
const toRad = deg => (deg * Math.PI) / 180;

// שים לב: Number(null) === 0 ו-Number('') === 0, כלומר מועדון בלי קואורדינטות
// היה הופך ל-(0,0) — נקודה באוקיינוס האטלנטי — ונכנס לדירוג במרחק ~5,000 ק"מ
// במקום להיות מסונן. לכן בודקים ריקנות מפורשות לפני ההמרה.
const numOrNull = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// מרחק אווירי (Haversine). מכוון: לא זמן נסיעה — זה היה דורש API חיצוני בתשלום.
// בישראל הפער בין השניים בדרך כלל מספיק קטן כדי לדרג נכון "מה הכי קרוב".
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const lat1 = numOrNull(a.lat), lng1 = numOrNull(a.lng);
  const lat2 = numOrNull(b.lat), lng2 = numOrNull(b.lng);
  if ([lat1, lng1, lat2, lng2].some(v => v === null)) return null;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} מ׳`;
  return `${km.toFixed(1)} ק״מ`;
}

// ── מיקום הטורניר ─────────────────────────────────────────────────────────

export function tournamentCoords(t) {
  const lat = numOrNull(t.venue_lat);
  const lng = numOrNull(t.venue_lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

// מחלץ קואורדינטות מטקסט שהודבק: זוג מספרים גולמי, או קישור Google Maps
// (הצורות ‎@lat,lng‎ ו-‎q=lat,lng‎). מחזיר null כשאין התאמה — כולל קישורים
// מקוצרים (maps.app.goo.gl), שלא מכילים את הקואורדינטות עד שפותחים אותם.
export function parsePastedCoords(text) {
  const s = String(text || '').trim();
  if (!s) return null;

  const patterns = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,        // /maps/@31.97,34.79,15z
    /[?&](?:q|ll|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=31.97,34.79
    /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,    // "31.97, 34.79"
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const lat = Number(m[1]), lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

// ── באיזה שלב הטורניר נמצא כרגע ───────────────────────────────────────────

function parseStages(stages) {
  if (Array.isArray(stages)) return stages;
  if (typeof stages === 'string') { try { return JSON.parse(stages || '[]'); } catch { return []; } }
  return [];
}

/**
 * מצב הטורניר ברגע זה.
 * status:
 *   'before'  — טרם התחיל (minutesToStart)
 *   'running' — רץ, עם רמה/בליינדים נוכחיים
 *   'unknown' — התחיל אבל אין duration לשלבים, אי אפשר לדעת באיזו רמה
 *   'ended'   — עבר את סוף מבנה הבליינדים
 *
 * כשאין נתוני duration מחזירים 'unknown' ולא מנחשים — אותה גישה בדיוק
 * כמו ב-lateRegCloseTime, שמעדיף "לא יודע" על פני מספר שגוי.
 */
export function tournamentProgress(t, now = new Date()) {
  const start = startInstant(t, currentOccurrence(t));
  if (!start) return { status: 'unknown' };

  const minutesToStart = Math.round((start - now) / 60000);
  if (now < start) return { status: 'before', start, minutesToStart };

  const stages = parseStages(t.stages);
  const hasDurations = stages.some(s => s.type !== 'break' && Number(s.duration) > 0);
  if (!hasDurations) return { status: 'unknown', start };

  let elapsed = (now - start) / 60000;
  let level = 0;

  for (const s of stages) {
    const isBreak = s.type === 'break';
    if (!isBreak) level++;
    const dur = Number(s.duration) || 0;
    if (dur <= 0) continue;
    if (elapsed < dur) {
      return {
        status: 'running',
        start,
        isBreak,
        level: isBreak ? null : level,
        smallBlind: s.small_blind,
        bigBlind: s.big_blind,
        ante: s.ante,
        minutesLeftInLevel: Math.max(0, Math.ceil(dur - elapsed)),
      };
    }
    elapsed -= dur;
  }
  return { status: 'ended', start };
}

// ── מי נכנס להצעות ────────────────────────────────────────────────────────

const MIN_WINDOW_HOURS = 6;

/**
 * עד מתי קדימה מציעים טורנירים.
 *
 * חלון קבוע של 6 שעות נכשל בשימוש יומי: בשעה 11:43 טורנירי הערב (18:00, 23:00)
 * נפלו מחוץ לחלון בהפרש של 17 דקות, ולמעשה לא הוצע כמעט כלום. שחקן ששואל
 * בבוקר לאן ללכת מתכוון להערב, לא לשש השעות הקרובות.
 *
 * לכן: עד סוף היום בשעון ישראל, אבל לפחות 6 שעות קדימה — כדי שגם ב-23:30
 * עדיין יוצעו הטורנירים של השעות שאחרי חצות.
 */
export function suggestionWindowEnd(now = new Date()) {
  const p = tzParts(now, IL_TZ);
  // חצות הלילה הקרוב = 00:00 של היום הבא בשעון ישראל.
  // zonedTimeToUTC מנרמל גלישת חודש/שנה בעצמו דרך Date.UTC.
  const endOfDay = zonedTimeToUTC(p.year, p.month, p.day + 1, 0, 0, IL_TZ);
  const floor = new Date(now.getTime() + MIN_WINDOW_HOURS * 3600000);
  return endOfDay > floor ? endOfDay : floor;
}

/**
 * האם הטורניר רלוונטי כהצעה "לאן ללכת עכשיו".
 *
 * נכנס אם הוא מתחיל לפני סוף חלון ההצעות, או שכבר התחיל וההרשמה המאוחרת
 * עדיין פתוחה. כשאי אפשר לחשב סגירת הרשמה (אין duration) — נכנס בכל זאת,
 * כדי שחוסר-נתונים לא יסתיר טורניר אמיתי; הדיסקליימר והפנייה למועדון
 * קיימים בדיוק בשביל המקרה הזה.
 */
export function isSuggestable(t, now = new Date()) {
  if (t.tournament_type === 'online') return false;   // אין מיקום פיזי
  if (!tournamentCoords(t)) return false;             // בלי קואורדינטות אין מרחק

  const prog = tournamentProgress(t, now);
  if (prog.status === 'ended') return false;
  if (prog.status === 'before') return prog.start <= suggestionWindowEnd(now);

  const close = lateRegCloseTime(t);
  return close ? now <= close : true;
}

/** כל הטורנירים הרלוונטיים, ממוינים מהקרוב לרחוק. */
export function rankByDistance(tournaments, origin, now = new Date()) {
  return (tournaments || [])
    .filter(t => isSuggestable(t, now))
    .map(t => ({ tournament: t, distanceKm: haversineKm(origin, tournamentCoords(t)) }))
    .filter(x => x.distanceKm != null)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// מעל זה נציג הערה שאין משהו באמת קרוב — בלי לחסום את ההצעה עצמה,
// כי בפריפריה חסימה קשיחה פשוט תיתן מסך ריק
export const FAR_AWAY_KM = 60;

// ── ניווט ─────────────────────────────────────────────────────────────────

// בונה את מחרוזת היעד לניווט מתוך כתובת + עיר.
// לא מצרף את העיר כשהיא כבר מופיעה בכתובת ("הסדנא 13 רעננה" + "רעננה"),
// וגם לא כשהיא ערך-דמה של מארגן ארצי ("ארצי") — מחרוזת מיותרת כזו רק
// מבלבלת את מנוע החיפוש של Waze/גוגל.
const PLACEHOLDER_CITIES = ['ארצי', 'כללי', 'משתנה'];
export function navAddress(t) {
  const addr = (t.venue_address || '').trim();
  const city = (t.venue_city || '').trim();
  if (!addr) return city && !PLACEHOLDER_CITIES.includes(city) ? city : '';
  if (!city || PLACEHOLDER_CITIES.includes(city)) return addr;
  return addr.includes(city) ? addr : `${addr}, ${city}`;
}

// לניווט מעדיפים דווקא את הכתובת הכתובה ולא את הקואורדינטות שלנו:
// הקואורדינטות נועדו למיון לפי מרחק, והן ברמת רחוב (מקורן ב-geocoding) —
// כלומר עלולות לנחות בקצה הלא נכון של הרחוב. ל-Waze ולגוגל יש נתוני כתובות
// מדויקים יותר משלנו, אז עדיף לתת להם את הכתובת ולתת להם לפתור אותה.
// הקואורדינטות משמשות כגיבוי כשאין כתובת.
export function wazeLink(coords, address) {
  if (address) return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  if (coords) return `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
  return null;
}

export function googleMapsLink(coords, address) {
  const dest = address || (coords ? `${coords.lat},${coords.lng}` : '');
  if (!dest) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
