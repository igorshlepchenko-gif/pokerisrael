export function buildWhatsAppLink(whatsappNumber, tournament, registrantName = '', registrantPhone = '') {
  const clean = whatsappNumber.replace(/\D/g, '').replace(/^0/, '972');

  // תמיכה לאחור — אם עברו string במקום object
  if (typeof tournament === 'string') {
    const msg = `שלום, הגעתי אליכם מאתר פוקר ישראל. ברצוני להירשם לטורניר ${tournament}.`;
    return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`;
  }

  const { name, start_time, is_recurring, day_of_week, tournament_type } = tournament;
  const time = start_time ? formatTime(start_time) : '';

  const isCash = tournament_type === 'cash' || tournament_type === 'online_cash';

  let whenStr = '';
  if (is_recurring && day_of_week !== null && day_of_week !== undefined) {
    whenStr = `המתקיים כל יום ${DAYS_HE[day_of_week]} בשעה ${time}`;
  } else if (start_time) {
    whenStr = `ביום ${formatDate(start_time)} בשעה ${time}`;
  }

  let senderLine = '';
  if (registrantName) {
    senderLine = `\nשמי: ${registrantName}`;
    if (registrantPhone) senderLine += ` | טלפון: ${registrantPhone}`;
  }

  const msg = isCash
    ? `שלום, הגעתי אליכם מאתר פוקר ישראל.\nברצוני להצטרף למשחק הקאש ${name} ${whenStr}.${senderLine}\nאשמח לאישור השתתפות `
    : `שלום, הגעתי אליכם מאתר פוקר ישראל.\nברצוני להירשם לטורניר ${name} ${whenStr}.${senderLine}\nאשמח לאישור השתתפות `;
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}%F0%9F%99%8F`;
}

export function buildVenueContactLink(whatsappNumber, venueName) {
  const clean = whatsappNumber.replace(/\D/g, '').replace(/^0/, '972');
  const msg = `שלום ${venueName}, הגעתי אליכם מאתר פוקר ישראל. אשמח לקבל מידע נוסף על המועדון.`;
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`;
}

// פנייה למועדון מתוך "מצא טורניר קרוב אליי" — השאלה היחידה שמעניינת שחקן
// שכבר בדרך: האם עדיין אפשר להיכנס בהרשמה מאוחרת.
export function buildLateRegContactLink(whatsappNumber, tournamentName) {
  const clean = String(whatsappNumber || '').replace(/\D/g, '').replace(/^0/, '972');
  const msg = `שלום, אני רוצה להגיע לטורניר ${tournamentName} בהרשמה מאוחרת. האם ניתן להגיע?`;
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`;
}

// Joker Club עברו להרשמה ישירה באתר שלהם במקום וואטסאפ. מזוהה לפי שם המועדון
// ולא venue_id — ה-id של המועדון הזה בטבלת venues אינו קבוע/ידוע מראש
export const JOKER_CLUB_REGISTRATION_URL = 'https://jokerclub.co.il/reg';
export function isJokerClubVenue(venueName) {
  return /joker/i.test(venueName || '');
}

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// כל הזמנים מחושבים לפי שעון ישראל — ללא תלות באזור הזמן של הדפדפן של הצופה.
// (הועבר למעלה כי nextOccurrence צריך אותו)
export const IL_TZ = 'Asia/Jerusalem';

// מפרק Date לרכיבי שעון-קיר (שנה/חודש/יום/שעה/דקה/יום-בשבוע) כפי שהם נראים
// באזור זמן נתון, כמספרים פשוטים — לא כאובייקט Date נוסף שתלוי בפרשנות אזור זמן
export function tzParts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
  const WEEKDAY_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
    weekday: WEEKDAY_NUM[p.weekday],
  };
}

// בונה Date שמייצג רגע UTC אמיתי מתוך שעון-קיר Y/M/D/H/M באזור זמן נתון. אין
// דרך ישירה לכך ב-JS הרגיל (בניגוד ל-Date.UTC, שמקבל רק מספרים ב-UTC) — זה
// הטריק המקובל: מנחשים UTC, בודקים איך הניחוש הזה היה *נראה* באזור היעד, ומתקנים
// לפי ההפרש. מתכנס תמיד לתשובה הנכונה, כולל בימי מעבר שעון קיץ.
export function zonedTimeToUTC(year, month, day, hour, minute, tz) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const shown = tzParts(guess, tz);
  const shownAsUTC = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
  return new Date(guess.getTime() + (guess.getTime() - shownAsUTC));
}

// מחזיר מחרוזת תאריך YYYY-MM-DD של רגע נתון, לפי אזור זמן נתון
function toDateStrInTZ(date, tz) {
  const p = tzParts(date, tz);
  const pad = n => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// מחשב את התאריך של המופע הקרוב הבא לאירוע שבועי קבוע, בשעון ישראל — ללא תלות
// באזור הזמן של מי שמריץ את הפונקציה (דפדפן הצופה). startTime מגיע כמחרוזת נאיבית
// (ללא אזור זמן) שמייצגת שעון-קיר ישראל לפי המוסכמה של האפליקציה; חילוץ השעה/דקה
// שלה נעשה ישירות מהמחרוזת (regex), לא דרך new Date().getHours(), כי זה האחרון
// תלוי באיך אזור הזמן של הריצה הנוכחית "היה מפרש" אותה כזמן מקומי.
// dayOfWeek: 0-6, skipped: מערך תאריכים לדילוג
export function nextOccurrence(startTime, dayOfWeek, skipped = []) {
  if (!startTime) return null;
  const m = String(startTime).match(/T(\d{2}):(\d{2})/);
  const baseHour = m ? Number(m[1]) : 0;
  const baseMinute = m ? Number(m[2]) : 0;

  const base = new Date(startTime);
  const dow = (dayOfWeek === null || dayOfWeek === undefined) ? base.getDay() : Number(dayOfWeek);
  const skipList = Array.isArray(skipped) ? skipped : (() => { try { return JSON.parse(skipped || '[]'); } catch { return []; } })();

  const nowParts = tzParts(new Date(), IL_TZ);
  const nowInstant = zonedTimeToUTC(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nowParts.minute, IL_TZ);
  const todayCandidate = zonedTimeToUTC(nowParts.year, nowParts.month, nowParts.day, baseHour, baseMinute, IL_TZ);

  let daysAhead = (dow - nowParts.weekday + 7) % 7;
  if (daysAhead === 0 && todayCandidate <= nowInstant) daysAhead = 7; // היום אבל השעה עברה → שבוע הבא

  // מתקדמים על גבי תאריך יומן פשוט (UTC-anchored, רק לצורך חשבון הימים עצמו),
  // ואז ממירים כל תאריך-מועמד מחדש דרך zonedTimeToUTC — כך שההיסט הנכון של אזור
  // הזמן (כולל שעון קיץ) מחושב מחדש לכל תאריך יעד, ולא רק מוזז בכמות מ"ש קבועה
  const targetDate = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day));
  targetDate.setUTCDate(targetDate.getUTCDate() + daysAhead);
  let res = zonedTimeToUTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate(), baseHour, baseMinute, IL_TZ);

  // דילוג על תאריכים שסומנו (חגים וכו')
  let guard = 0;
  while (skipList.includes(toDateStrInTZ(res, IL_TZ)) && guard < 60) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 7);
    res = zonedTimeToUTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate(), baseHour, baseMinute, IL_TZ);
    guard++;
  }
  return res;
}

// תאריך תצוגה לאירוע — חוזר שבועי מציג את המופע הבא, אחרת את התאריך המקורי
export function eventDisplayDate(t) {
  if (t.is_recurring) {
    const next = nextOccurrence(t.start_time, t.day_of_week, t.skipped_dates);
    return next ? next.toISOString() : t.start_time;
  }
  return t.start_time;
}

// מחשב את הרגע (UTC אמיתי) שבו נסגרת ה-late registration, לפי late_reg_level והבליינדים.
// מחזיר null כשאין מספיק מידע לחשב (בלי duration לשלבים אי אפשר לדעת כמה זמן עבר) —
// כך שחוסר-מידע לעולם לא חוסם הרשמה בטעות, רק היעדר-נתונים אמיתי גורם ל"לא לחסום".
export function lateRegCloseTime(t) {
  if (!t.late_reg_level) return null;
  const stages = Array.isArray(t.stages) ? t.stages : (typeof t.stages === 'string' ? JSON.parse(t.stages || '[]') : []);
  if (!stages.some(s => s.type !== 'break' && s.duration)) return null;

  let n = 0, stageIdx = -1;
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].type !== 'break') n++;
    if (n === t.late_reg_level) { stageIdx = i; break; }
  }
  if (stageIdx === -1) return null;

  let totalMins = 0;
  for (let i = 0; i < stageIdx; i++) totalMins += parseInt(stages[i].duration) || 0;

  const effectiveStart = eventDisplayDate(t);
  if (!effectiveStart) return null;

  const base = startInstant(t, effectiveStart);
  if (!base) return null;
  return new Date(base.getTime() + totalMins * 60000);
}

// ממיר את שעת ההתחלה האפקטיבית לרגע UTC חד-משמעי.
// הופרד מ-lateRegCloseTime כדי ש-tournamentProgress ישתמש באותה לוגיקה בדיוק
// ולא ישכפל את טיפול אזור-הזמן העדין הזה (שכפול כזה נוטה להיפרד עם הזמן).
export function startInstant(t, effectiveStart) {
  if (!effectiveStart) return null;
  const str = String(effectiveStart);
  if (t.is_recurring || /Z$|[+-]\d{2}:?\d{2}$/.test(str)) {
    // כבר רגע UTC חד-משמעי: eventDisplayDate מחזיר ISO UTC אמיתי לחוזרים (דרך
    // nextOccurrence), וה-API עצמו לפעמים כבר ממיר start_time למחרוזת עם Z (תלוי
    // באזור הזמן של תהליך ה-Node של השרת) — בשני המקרים אין צורך בהמרה נוספת
    return new Date(str);
  }
  // מחרוזת נאיבית ללא אזור זמן — כמו ב-nextOccurrence, מניחים ששעון-הקיר שבה
  // הוא ישראל, ומפרקים+ממירים ידנית במקום new Date ישיר (תלוי באזור הזמן של הדפדפן)
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return zonedTimeToUTC(y, mo, d, h, mi, IL_TZ);
}

// "מתי המופע הרלוונטי עכשיו" — להבדיל מ-eventDisplayDate שעונה "מתי בפעם הבאה".
// nextOccurrence מקפיץ לשבוע הבא ברגע שהשעה של היום עברה (whatsapp.js, daysAhead=7),
// ולכן טורניר שבועי שהתחיל לפני שעה מדווח כ"בעוד שבוע" — חסר תועלת ל"מה רץ עכשיו".
// כאן: אם המופע של היום (או של אתמול, לטורניר שחוצה חצות) כבר התחיל ועדיין בתוך
// חלון ה-lookback — מחזירים אותו. אחרת נופלים חזרה להתנהגות הרגילה.
export function currentOccurrence(t, lookbackHours = 12) {
  if (!t.is_recurring) return t.start_time;

  const m = String(t.start_time).match(/T(\d{2}):(\d{2})/);
  const baseHour = m ? Number(m[1]) : 0;
  const baseMinute = m ? Number(m[2]) : 0;
  const dow = (t.day_of_week === null || t.day_of_week === undefined)
    ? new Date(t.start_time).getDay()
    : Number(t.day_of_week);

  const skipList = Array.isArray(t.skipped_dates)
    ? t.skipped_dates
    : (() => { try { return JSON.parse(t.skipped_dates || '[]'); } catch { return []; } })();

  const now = new Date();
  const nowParts = tzParts(now, IL_TZ);

  // back=0 היום, back=1 אתמול (טורניר ערב שממשיך אחרי חצות)
  for (let back = 0; back <= 1; back++) {
    const d = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day - back));
    if (d.getUTCDay() !== dow) continue;
    const cand = zonedTimeToUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), baseHour, baseMinute, IL_TZ);
    const elapsed = now - cand;
    if (elapsed >= 0 && elapsed <= lookbackHours * 3600000 && !skipList.includes(toDateStrInTZ(cand, IL_TZ))) {
      return cand.toISOString();
    }
  }
  return eventDisplayDate(t);
}

// האם ה-late registration כבר נסגרה כרגע. false גם כשאין מספיק מידע לחשב —
// עדיף לא לחסום הרשמה אמיתית מאשר לחסום בטעות טורניר בלי נתוני duration
export function isLateRegClosed(t) {
  const closeTime = lateRegCloseTime(t);
  return closeTime ? new Date() > closeTime : false;
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: IL_TZ });
}

// ל-<input type="datetime-local"> בטפסי עריכה — "YYYY-MM-DDTHH:mm" לפי שעון ישראל,
// באותה שיטה בדיוק כמו formatTime/formatDate למעלה (Intl עם Asia/Jerusalem)
export function toIsraelDatetimeInput(dateStr) {
  if (!dateStr) return '';
  const p = tzParts(new Date(dateStr), IL_TZ);
  const pad = n => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: IL_TZ });
}

export function formatCost(cost) {
  if (!cost || cost === 0) return 'חינם';
  return `₪${Number(cost).toLocaleString('he-IL')}`;
}

// מחזיר מחרוזת זמנים לשלב: "20" או "10/15/20" אם יש כמה זמנים שונים
// מעדיף stages, נופל ל-fallback אם אין
export function getStageDurations(stages, fallback) {
  const arr = Array.isArray(stages) ? stages : [];
  const durations = [
    ...new Set(
      arr
        .filter(s => s.type !== 'break' && s.duration != null && s.duration !== '')
        .map(s => Number(s.duration))
        .filter(d => d > 0)
    ),
  ];
  if (durations.length > 0) return durations.join('/');
  return fallback ? String(fallback) : null;
}

// שם מועדון לתצוגה — למועדון אונליין מוסיף את מספר המועדון: "שם - 123456"
export function venueDisplayName(name, venueType, clubNumber) {
  if (venueType === 'online' && clubNumber) return `${name} - ${clubNumber}`;
  return name;
}

// מחזיר מחרוזת תצוגה למשחקי קאש: "NLH" או "NLH + PLO5 ×2"
export function formatGames(primary, secondary) {
  if (!primary) return null;
  let sec = secondary;
  if (typeof sec === 'string') { try { sec = JSON.parse(sec || '[]'); } catch { sec = []; } }
  if (!Array.isArray(sec)) sec = [];
  const parts = sec.map(s => `${s.game}${s.hands > 1 ? ` ×${s.hands}` : ''}`);
  return [primary, ...parts].join(' + ');
}
