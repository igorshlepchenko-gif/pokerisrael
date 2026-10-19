import { useAuth } from '../context/AuthContext';
import { ONLINE_ENABLED } from '../data/onlineClubs';

// שלב בדיקה: כל אזור "פוקר אונליין" (העמוד, הטאב בניווט, הפרסומים בעמוד הבית והשורות
// "פספסת?") גלוי רק למנהל המערכת, עד שבעל האתר יוודא שהכל עובד ושהפרסומים לא מעיקים.
// לפתיחה לכל הגולשים — לשנות ל-false.
// ⚠️ זו הסתרה בתצוגה בלבד: נתוני הקלאבים והתמונות עדיין נשלחים עם קוד האתר.
export const ONLINE_ADMIN_ONLY = true;

export function useOnlineVisible() {
  const { user } = useAuth() || {};
  return ONLINE_ENABLED && (!ONLINE_ADMIN_ONLY || user?.role === 'admin');
}
