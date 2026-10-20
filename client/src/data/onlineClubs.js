// עמוד "פוקר אונליין" (/online) ומיקומי הפרסום שמפנים אליו. האתר מפנה שחקנים לסוכן.
//
// ⚠️ הקלאבים והפרסומים לא נערכים כאן — הם מגיעים מ-onlineClubs.generated.json, שנוצר מקובץ
// ה-Excel online-clubs/online-clubs.xlsx ע"י: node server/scripts/importOnlineClubs.js
// (הסקריפט גם מעתיק ומכווץ את הלוגואים והפרסומים אל client/public/online-clubs/).
// כל עוד אין קלאבים — העמוד, הטאב בניווט וכל מיקומי הפרסום מוסתרים (ONLINE_ENABLED).
import generated from './onlineClubs.generated.json';

// הסוכן שהאתר מפנה אליו (וואטסאפ בפורמט 972XXXXXXXXX). גם דיווח על פעילות חשודה מגיע אליו.
// number = מספר הסוכן הראשי ב-ClubGG — זהה בכל הקלאבים, ברירת המחדל לכל קלאב בלי agentNumber משלו.
export const AGENT = { name: 'Pokeradmin24', whatsapp: '972525700810', number: '50682245' };

export const STORE_LINKS = {
  ios: 'https://apps.apple.com/il/app/clubgg-poker/id1529839330',
  android: 'https://play.google.com/store/apps/details?id=com.nsus.clubgg',
};

// 7XL — אתר/אפליקציה ברשת GG (לא קלאב). קישור הורדה אחד לכל המכשירים (מפנה לעמוד ההורדה
// הרשמי של GG Network). ההצטרפות דרך הסוכן — פונים אליו בוואטסאפ אחרי ההרשמה.
export const SEVEN_XL = {
  name: '7XL',
  downloadUrl: 'http://bit.ly/7xl-mobile',
  // בתיקייה נפרדת מ-online-clubs/ בכוונה — סקריפט הייבוא מהאקסל בונה את online-clubs/ מחדש בכל הרצה
  logo: '/online-platforms/7xl.jpg',
};

// סרטון "איך מצטרפים" (קובץ ב-client/public/online-clubs/ או קישור). ריק = לא מוצג.
export const JOIN_VIDEO_URL = '';

// תווית קטנה בכל פרסום
export const PROMO_TAG = 'אונליין · 18+';

// מקור רשמי לסיוע (כל-זכות, מבוסס על השירות לטיפול בהתמכרויות במשרד הרווחה)
export const GAMBLING_HELP_URL = 'https://www.kolzchut.org.il/he/סיוע_למבוגרים_עם_בעיית_הימורים';

export const STAKE_LEVELS = [
  { key: 'low',  label: 'נמוך' },
  { key: 'mid',  label: 'בינוני' },
  { key: 'high', label: 'גבוה' },
];

// שדות קלאב: id, name, platform, clubNumber, agentNumber? (ברירת מחדל AGENT.number), games,
// levels ('low'|'mid'|'high'), stakes?, hours?, note?, logo?, agent? ({ name, whatsapp } לסוכן אחר)
export const CLUBS = generated.clubs;

// פרסומים מתחלפים (קרוסלה בעמוד האונליין + בעמוד הבית). כל פרסום מוצג רק בין validFrom
// ל-validTo (כולל) — כך פרסומי השבוע יורדים לבד כשהשבוע נגמר, בלי לזכור למחוק.
// image: קובץ בתיקיית client/public/online-clubs/promos/ (מכווץ לרוחב 900px).
export const PROMOS = generated.promos;

// תאריך היום לפי שעון ישראל, בפורמט YYYY-MM-DD (להשוואה מול validFrom/validTo)
function israelToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}
// קלאבים שהפרסומים שלהם מגיעים מתיקיית Google Drive ומתעדכנים בשרת כמה פעמים ביום
// (server/services/drivePromos.js). הפרסומים שלהם מהאקסל מתעלמים — מה שבתיקייה קובע.
// התיקיות נקבעות בפאנל הניהול; השרת מוסר את רשימת הקלאבים ב-data-clubs של בלוק הפרסומים.
const promosEl = () => (typeof document !== 'undefined' && document.getElementById('pli-promos')) || null;
export const DRIVE_PROMO_CLUBS = (() => {
  const attr = promosEl()?.dataset.clubs;
  return attr == null ? ['ludus'] : attr.split(',').filter(Boolean); // בלי השרת (פיתוח) — כמו קודם
})();

// הרשימה העדכנית מוטמעת ב-index.html ע"י השרת (<script id="pli-promos" type="application/json">)
function drivePromos() {
  try {
    const el = promosEl();
    const list = el ? JSON.parse(el.textContent || '[]') : [];
    return Array.isArray(list) ? list.filter(p => p && p.image && DRIVE_PROMO_CLUBS.includes(p.clubId)) : [];
  } catch {
    return [];
  }
}

// "טורניר הבוקר" של Ludus: בין 10:00 ל-14:00 (שעון ישראל) הפרסום שלו מוקפץ ראשון ב-1 מכל 4
// טעינות דף. ההגרלה נעשית פעם אחת לטעינה, כך שכל מיקומי הפרסום באותו דף מסכימים.
const MORNING_FEATURE = { clubId: 'ludus', fromHour: 10, toHour: 14, chance: 0.25 };
let featuredDecision;
export function featuredPromoId(promos) {
  if (featuredDecision === undefined) {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    featuredDecision = hour >= MORNING_FEATURE.fromHour && hour < MORNING_FEATURE.toHour && Math.random() < MORNING_FEATURE.chance;
  }
  if (!featuredDecision) return null;
  return promos.find(p => p.clubId === MORNING_FEATURE.clubId)?.id || null;
}

export function activePromos() {
  const today = israelToday();
  const list = PROMOS
    .filter(p => !DRIVE_PROMO_CLUBS.includes(p.clubId))
    .filter(p => (!p.validFrom || p.validFrom <= today) && (!p.validTo || today <= p.validTo))
    .concat(drivePromos());
  const featured = featuredPromoId(list);
  return featured ? [list.find(p => p.id === featured), ...list.filter(p => p.id !== featured)] : list;
}

export const ACTIVE_CLUBS = CLUBS;
export const ONLINE_ENABLED = ACTIVE_CLUBS.length > 0;

export function agentFor(club) {
  return club?.agent || AGENT;
}
export function agentNumberFor(club) {
  return club?.agentNumber || agentFor(club).number;
}
export function waLink(text, phone = AGENT.whatsapp) {
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}
