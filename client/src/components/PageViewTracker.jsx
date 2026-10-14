import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageToken } from '../utils/pageToken';

// מונה כניסות (server/routes/analytics.js) — שולח "צפייה בדף" בכל מעבר דף.
// בלי עוגיות ובלי מזהה בדפדפן; השרת מזהה מבקר רק בתוך אותו יום.
// לא פועל באפליקציית המובייל (VITE_API_BASE_URL) — היא לא "כניסה לאתר".
const enabled = !import.meta.env.VITE_API_BASE_URL;
let entrySent = false; // הצפייה הראשונה בטעינה = "כניסה" (עם מקור ההגעה)

function send(body) {
  const json = JSON.stringify(body);
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon && navigator.sendBeacon('/api/analytics/pv', blob)) return;
  fetch('/api/analytics/pv', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json,
    keepalive: true, credentials: 'same-origin',
  }).catch(() => {});
}

// אדמין לא נספר. השרת מזהה אותו לפי העוגייה; זה גיבוב למקרה שההתחברות שמורה רק כטוקן
function isAdmin() {
  try {
    const t = localStorage.getItem('pli_token');
    return !!t && JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'admin';
  } catch {
    return false;
  }
}

export default function PageViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled || isAdmin()) return;
    getPageToken().then((t) => {
      if (!t) return;
      const body = { t, path: pathname };
      if (!entrySent) {
        entrySent = true;
        body.entry = true;
        body.ref = document.referrer || '';
        body.utm = new URLSearchParams(window.location.search).get('utm_source') || '';
      }
      send(body);
    }).catch(() => {});
  }, [pathname]);

  return null;
}
