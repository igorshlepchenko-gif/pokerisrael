export function buildWhatsAppLink(whatsappNumber, tournament, registrantName = '', registrantPhone = '') {
  const clean = whatsappNumber.replace(/\D/g, '').replace(/^0/, '972');

  // תמיכה לאחור — אם עברו string במקום object
  if (typeof tournament === 'string') {
    const msg = `שלום, הגעתי אליכם מאתר פוקר לייב ישראל. ברצוני להירשם לטורניר ${tournament}.`;
    return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`;
  }

  const { name, start_time, is_recurring, day_of_week } = tournament;
  const time = start_time ? formatTime(start_time) : '';

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

  const msg = `שלום, הגעתי אליכם מאתר פוקר לייב ישראל.\nברצוני להירשם לטורניר ${name} ${whenStr}.${senderLine}\nאשמח לאישור השתתפות `;
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}%F0%9F%99%8F`;
}

export function buildVenueContactLink(whatsappNumber, venueName) {
  const clean = whatsappNumber.replace(/\D/g, '').replace(/^0/, '972');
  const msg = `שלום ${venueName}, הגעתי אליכם מאתר פוקר לייב ישראל. אשמח לקבל מידע נוסף על המועדון.`;
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`;
}

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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

// מחזיר מחרוזת תצוגה למשחקי קאש: "NLH" או "NLH + PLO5 ×2"
export function formatGames(primary, secondary) {
  if (!primary) return null;
  let sec = secondary;
  if (typeof sec === 'string') { try { sec = JSON.parse(sec || '[]'); } catch { sec = []; } }
  if (!Array.isArray(sec)) sec = [];
  const parts = sec.map(s => `${s.game}${s.hands > 1 ? ` ×${s.hands}` : ''}`);
  return [primary, ...parts].join(' + ');
}
