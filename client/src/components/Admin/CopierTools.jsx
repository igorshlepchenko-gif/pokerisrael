import { useState, useEffect } from 'react';
import api from '../../utils/api';

// כלים לזיהוי וחסימה של מי שמעתיק: חיפוש הקוד מסימן המים (מתוך צילום מסך שפורסם
// במקום אחר) → IP + מתי, וחסימת IP מנתוני הטורנירים (server: blocked_ips).
const fmt = (d) => new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
const device = (ua = '') => (/iphone|ipad/i.test(ua) ? '📱 אייפון' : /android/i.test(ua) ? '📱 אנדרואיד' : /windows|macintosh|linux/i.test(ua) ? '💻 מחשב' : ua.slice(0, 30));

export default function CopierTools() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState([]);
  const [msg, setMsg] = useState('');

  const loadBlocked = () => api.get('/admin/blocked-ips').then((r) => setBlocked(r.data)).catch(() => {});
  useEffect(() => { loadBlocked(); }, []);

  const lookup = async (e) => {
    e.preventDefault();
    setError(''); setResult(null); setMsg('');
    try {
      const r = await api.get(`/admin/watermark/${encodeURIComponent(code.trim())}`);
      setResult(r.data);
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בחיפוש');
    }
  };

  const block = async (ip) => {
    const days = window.prompt(
      `לחסום את ${ip} מנתוני הטורנירים?\n\nהאתר עצמו ייטען, אבל רשימת הטורנירים תהיה ריקה.\n` +
      `⚠️ בסלולר כתובת אחת משותפת לפעמים לכמה אנשים — עדיף חסימה קצרה.\n\nלכמה ימים?`, '30');
    if (!days) return;
    try {
      const r = await api.post('/admin/blocked-ips', { ip, days: Number(days), reason: result ? `קוד סימן מים ${result.code}` : '' });
      setMsg(r.data.message);
      loadBlocked();
      if (result) setResult({ ...result, matches: result.matches.map((m) => (m.ip === ip ? { ...m, blocked: true } : m)) });
    } catch (err) {
      setMsg(err.response?.data?.message || 'שגיאה');
    }
  };

  const unblock = async (ip) => {
    if (!window.confirm(`להסיר את החסימה של ${ip}?`)) return;
    await api.delete(`/admin/blocked-ips/${encodeURIComponent(ip)}`).catch(() => {});
    loadBlocked();
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-black text-white mb-1">🔎 מי צילם את המסך?</h3>
        <p className="text-sm text-slate-400 mb-3">
          ליד &quot;PokerIsrael.org&quot; בסימן המים מופיע קוד של 5 תווים, שונה לכל גולש ולכל יום.
          ראית צילום מסך מהאתר באינסטגרם או בוואטסאפ? הקלד כאן את הקוד שמופיע בו.
        </p>
        <form onSubmit={lookup} className="flex gap-2 flex-wrap">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="למשל K7Q3M"
            maxLength={5}
            dir="ltr"
            className="input-field font-mono tracking-widest w-40 py-1.5"
          />
          <button className="text-sm font-bold py-1.5 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-500">חפש</button>
        </form>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        {result && (
          result.matches.length === 0 ? (
            <p className="text-sm text-slate-400 mt-3">
              הקוד {result.code} לא נמצא. הקודים נשמרים 30 יום — ייתכן שהצילום ישן יותר, או שאחד התווים נקרא לא נכון.
            </p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="text-right p-2">יום</th>
                    <th className="text-right p-2">כתובת IP</th>
                    <th className="text-right p-2">מכשיר</th>
                    <th className="text-right p-2">כניסות</th>
                    <th className="text-right p-2">אחרונה</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {result.matches.map((m) => (
                    <tr key={m.day + m.ip}>
                      <td className="p-2 whitespace-nowrap">{fmtDay(m.day)}</td>
                      <td className="p-2 font-mono" dir="ltr">{m.ip}</td>
                      <td className="p-2 text-slate-300" title={m.user_agent}>{device(m.user_agent)}</td>
                      <td className="p-2 tabular-nums">{m.views}</td>
                      <td className="p-2 whitespace-nowrap text-slate-400">{fmt(m.last_seen)}</td>
                      <td className="p-2">
                        {m.blocked
                          ? <span className="text-xs text-rose-300">⛔ חסום</span>
                          : <button onClick={() => block(m.ip)} className="text-xs font-bold py-1 px-3 rounded-lg bg-rose-900/50 text-rose-200 hover:bg-rose-900/80">⛔ חסום</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {msg && <p className="text-sm text-emerald-300 mt-2">{msg}</p>}
      </div>

      {blocked.length > 0 && (
        <div className="card p-4">
          <h3 className="font-black text-white mb-2">⛔ כתובות חסומות ({blocked.length})</h3>
          <ul className="divide-y divide-slate-700/50 text-sm">
            {blocked.map((b) => (
              <li key={b.ip} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                <span className="font-mono" dir="ltr">{b.ip}</span>
                <span className="text-slate-400 text-xs">{b.reason || ''} · עד {b.expires_at ? fmt(b.expires_at) : 'ללא הגבלה'}</span>
                <button onClick={() => unblock(b.ip)} className="text-xs text-slate-300 hover:text-white underline">הסר חסימה</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
