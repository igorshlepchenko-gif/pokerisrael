import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// "לחזור לכאן אחרי ההתחברות": נשמר לפני שליחה להרשמה/התחברות, ונצרך ברגע שיש משתמש מחובר —
// כך זה עובד גם בהתחברות רגילה, גם ב-Google (שחוזר ל-/) וגם אחרי אימות מייל (שמנווט ל-/).
// בתוקף שעה, ורק נתיב פנימי (לא "//host") — כדי שלא ישמש להפניה החוצה.
const KEY = 'pli_return_to';
const TTL_MS = 60 * 60 * 1000;

const safePath = (p) => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//');

export function rememberReturn(path) {
  if (!safePath(path)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })); } catch { /* ignore */ }
}

function takeReturn() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw);
    return safePath(path) && Date.now() - at < TTL_MS ? path : null;
  } catch { return null; }
}

// מורכב פעם אחת ב-App
export function ReturnAfterLogin() {
  const { user } = useAuth() || {};
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    const path = takeReturn();
    if (path) navigate(path, { replace: true });
  }, [user, navigate]);
  return null;
}
