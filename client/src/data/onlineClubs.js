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
export function activePromos() {
  const today = israelToday();
  return PROMOS.filter(p => (!p.validFrom || p.validFrom <= today) && (!p.validTo || today <= p.validTo));
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
