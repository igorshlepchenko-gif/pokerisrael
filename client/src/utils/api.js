import axios from 'axios';
import { clearHandLoggerDraft } from './handLoggerDraft';

// import.meta.env.VITE_API_BASE_URL is unset in the web app's own build, so this
// still resolves to '/api' there unchanged — only the mobile app build sets it,
// since a packaged app has no same-origin server for a relative path to resolve against.
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pli_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    // Header-auth clients (mobile app — no cross-site cookie) get their sliding-session
    // refresh via this response header instead of a re-issued cookie; see server/middleware/auth.js
    const refreshed = res.headers['x-refreshed-token'];
    if (refreshed) localStorage.setItem('pli_token', refreshed);
    return res;
  },
  (err) => {
    // 401 מנקודות קצה אחרות = סשן פג תוקף → redirect ללוגין
    // 401 מ-/auth/login = סיסמה/מייל שגויים → לטפל בטופס עצמו, לא לעשות redirect
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('pli_token');
      clearHandLoggerDraft();
      const message = err.response?.data?.message;
      window.location.href = message ? `/login?sessionMessage=${encodeURIComponent(message)}` : '/login';
    }
    return Promise.reject(err);
  }
);

// לוג הרשמה יורה-ושכח, נקרא תמיד ממש לפני window.open לוואטסאפ — ברגע שהטאב
// עובר לרקע (המשתמש עבר לוואטסאפ), דפדפנים רבים מבטלים בקשות fetch/axios שעדיין
// באוויר. sendBeacon מיועד בדיוק למקרה הזה ומובטח להישלח גם כשהדף ברקע/נסגר.
export function logRegistration(payload) {
  const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  if (navigator.sendBeacon && navigator.sendBeacon('/api/registrations', body)) return;
  api.post('/registrations', payload).catch(() => {}); // דפדפן ישן ללא תמיכה ב-sendBeacon
}

// אותו דפוס בדיוק כמו logRegistration — לוג פנייה למאמן/קורס (טאב לימודי פוקר),
// נקרא ממש לפני window.open לוואטסאפ
export function logInquiry(payload) {
  const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  if (navigator.sendBeacon && navigator.sendBeacon('/api/inquiries', body)) return;
  api.post('/inquiries', payload).catch(() => {}); // דפדפן ישן ללא תמיכה ב-sendBeacon
}

export default api;
