import { useAuth } from '../context/AuthContext';
import { ONLINE_ENABLED } from '../data/onlineClubs';

// כל אזור "פוקר אונליין" (העמוד, הטאב בניווט, הפרסומים בעמוד הבית והשורות "פספסת?").
// true = תצוגת מנהל בלבד (שלב בדיקה). נפתח לכל הגולשים 2026-10-29 לבקשת בעל האתר.
// ⚠️ ב-true זו הסתרה בתצוגה בלבד: נתוני הקלאבים והתמונות עדיין נשלחים עם קוד האתר.
export const ONLINE_ADMIN_ONLY = false;

export function useOnlineVisible() {
  const { user } = useAuth() || {};
  return ONLINE_ENABLED && (!ONLINE_ADMIN_ONLY || user?.role === 'admin');
}
