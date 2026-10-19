import { useState, useEffect } from 'react';
import api from '../../utils/api';

// הפעלת התראת הבוקר (08:00) "טורנירי היום מוכנים לשיתוף" — server/services/webPush.js.
// באייפון: התראות עובדות רק מתוך האתר כשהוא מותקן במסך הבית (iOS 16.4+).

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSetup() {
  const [state, setState] = useState('checking'); // checking | ios-install | unsupported | denied | off | on
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!supported()) return setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg && (await reg.pushManager.getSubscription());
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  const enable = async () => {
    setBusy(true); setMsg('');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return; }
      const { data } = await api.get('/push/vapid-public-key');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) });
      await api.post('/push/subscribe', { subscription: sub.toJSON() });
      setState('on');
      setMsg('מעולה! כל בוקר ב-08:00 תקבל התראה. אפשר לשלוח עכשיו התראת בדיקה.');
    } catch (err) {
      setMsg('לא הצלחתי להפעיל: ' + (err?.message || 'שגיאה'));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await api.post('/push/test');
      setMsg(r.data.sent ? 'נשלחה התראת בדיקה — היא אמורה להופיע תוך כמה שניות.' : 'לא נמצא מכשיר רשום. נסה להפעיל מחדש.');
    } catch { setMsg('שגיאה בשליחה'); } finally { setBusy(false); }
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState('off'); setMsg('ההתראות בוטלו במכשיר הזה.');
  };

  const label = { on: '🔔 התראת בוקר פעילה', off: '🔔 התראת בוקר', 'ios-install': '🔔 התראת בוקר', denied: '🔕 התראות חסומות', unsupported: '🔔 התראת בוקר', checking: '🔔' }[state];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`text-sm font-bold py-1.5 px-4 rounded-xl border ${state === 'on' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'} hover:brightness-125`}>
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-80 max-w-[90vw] card p-4 text-sm text-slate-300 shadow-2xl">
          <p className="font-bold text-white mb-2">התראה כל בוקר ב-08:00</p>
          <p className="mb-3 text-slate-400">&quot;📲 X טורנירים היום — לחץ לשיתוף&quot; → נפתח עמוד התמונה → &quot;שתף בוואטסאפ&quot; → בוחרים את הערוץ.</p>

          {state === 'ios-install' && (
            <ol className="list-decimal pr-5 space-y-1 text-slate-300">
              <li>פתח את האתר ב-<b>Safari</b> באייפון.</li>
              <li>לחץ על כפתור השיתוף <span aria-hidden>⬆️</span> בתחתית המסך.</li>
              <li>בחר <b>&quot;הוסף למסך הבית&quot;</b> ← &quot;הוסף&quot;.</li>
              <li>פתח את &quot;פוקר ישראל&quot; מהמסך הבית, התחבר, היכנס לפאנל הניהול ולחץ שוב כאן.</li>
            </ol>
          )}
          {state === 'unsupported' && <p className="text-slate-400">הדפדפן הזה לא תומך בהתראות. באייפון — יש להוסיף את האתר למסך הבית (iOS 16.4 ומעלה).</p>}
          {state === 'denied' && <p className="text-slate-400">ההתראות נחסמו למכשיר הזה. באייפון: הגדרות ← התראות ← פוקר ישראל ← אפשר התראות.</p>}
          {state === 'off' && (
            <button onClick={enable} disabled={busy} className="w-full py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
              {busy ? 'מפעיל…' : 'הפעל התראות במכשיר הזה'}
            </button>
          )}
          {state === 'on' && (
            <div className="flex gap-2">
              <button onClick={test} disabled={busy} className="flex-1 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50">שלח בדיקה</button>
              <button onClick={disable} className="py-2 px-3 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700">בטל</button>
            </div>
          )}
          {msg && <p className="mt-3 text-emerald-300">{msg}</p>}
        </div>
      )}
    </div>
  );
}
