import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pli_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 מנקודות קצה אחרות = סשן פג תוקף → redirect ללוגין
    // 401 מ-/auth/login = סיסמה/מייל שגויים → לטפל בטופס עצמו, לא לעשות redirect
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('pli_token');
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

export default api;
