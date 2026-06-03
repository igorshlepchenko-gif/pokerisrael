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
    whenStr = isCash
      ? `המתקיים כל יום ${DAYS_HE[day_of_week]} בשעה ${time}`
      : `המתקיים כל יום ${DAYS_HE[day_of_week]} בשעה ${time}`;
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

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// מחזיר מחרוזת תאריך YYYY-MM-DD (זמן מקומי)
function toDateStr(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// מחשב את התאריך של המופע הקרוב הבא לאירוע שבועי קבוע
// startTime: תאריך מקורי (לקביעת השעה), dayOfWeek: 0-6, skipped: מערך תאריכים לדילוג
export function nextOccurrence(startTime, dayOfWeek, skipped = []) {
  if (!startTime) return null;
  const base = new Date(startTime);
  const dow = (dayOfWeek === null || dayOfWeek === undefined) ? base.getDay() : Number(dayOfWeek);
  const skipList = Array.isArray(skipped) ? skipped : (() => { try { return JSON.parse(skipped || '[]'); } catch { return []; } })();

  const now = new Date();
  const res = new Date(now);
  res.setHours(base.getHours(), base.getMinutes(), 0, 0);

  let daysAhead = (dow - res.getDay() + 7) % 7;
  if (daysAhead === 0 && res <= now) daysAhead = 7; // היום אבל השעה עברה → שבוע הבא
  res.setDate(res.getDate() + daysAhead);

  // דילוג על תאריכים שסומנו (חגים וכו')
  let guard = 0;
  while (skipList.includes(toDateStr(res)) && guard < 60) {
    res.setDate(res.getDate() + 7);
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

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
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
