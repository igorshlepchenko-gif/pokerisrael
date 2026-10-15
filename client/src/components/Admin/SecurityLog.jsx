import { useState, useEffect } from 'react';
import api from '../../utils/api';

// יומן האבטחה — בקשות שנחסמו/חשודות (הגנה מפני scraping, server/middleware/antiScraping.js)
const REASONS = {
  honeypot: '🪤 נכנס למלכודת',
  blocked_network: '🏢 רשת חסומה (DataPacket)',
  blocked_ip: '⛔ IP חסום',
  blocked_user_agent: '🤖 כלי סקריפט',
  empty_user_agent: '🤖 בלי זיהוי דפדפן',
  rate_limit_data: '🚦 יותר מדי בקשות נתונים',
  rate_limit_pages: '🚦 יותר מדי טעינות דף',
  page_token_missing: '🔑 בלי טוקן דף',
  page_token_invalid: '🔑 טוקן דף מזויף',
  'fake_search_bot:Googlebot': '🎭 מתחזה לגוגל',
  'fake_search_bot:Bingbot': '🎭 מתחזה לבינג',
};
const label = (r) => REASONS[r] || r;
const fmt = (d) => new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function SecurityLog() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/security-events', { params: { days } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-400">
          בקשות שנחסמו או נראו חשודות (העתקת נתונים אוטומטית). כל IP + סיבה נרשמים פעם אחת בדקה; נשמר 30 יום.
        </p>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="input-field text-sm w-36 py-1.5">
          <option value={1}>24 שעות</option>
          <option value={7}>7 ימים</option>
          <option value={30}>30 ימים</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">טוען…</div>
      ) : !data || data.by_ip.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">אין אירועים בתקופה הזו 🎉</div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <h3 className="font-black text-white px-4 pt-4">לפי כתובת IP</h3>
            <table className="w-full text-sm mt-2">
              <thead className="text-xs text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="text-right p-3">IP</th>
                  <th className="text-right p-3">אירועים</th>
                  <th className="text-right p-3">סיבות</th>
                  <th className="text-right p-3">נראה לאחרונה</th>
                  <th className="text-right p-3">דפדפן / כלי</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.by_ip.map(row => (
                  <tr key={row.ip}>
                    <td className="p-3 font-mono text-slate-200" dir="ltr">{row.ip}</td>
                    <td className="p-3 tabular-nums">{row.events}</td>
                    <td className="p-3 text-slate-300">{row.reasons.map(label).join(' · ')}</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">{fmt(row.last_seen)}</td>
                    <td className="p-3 text-slate-500 text-xs max-w-xs truncate" dir="ltr" title={row.last_user_agent}>{row.last_user_agent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto">
            <h3 className="font-black text-white px-4 pt-4">אירועים אחרונים</h3>
            <table className="w-full text-sm mt-2">
              <thead className="text-xs text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="text-right p-3">זמן</th>
                  <th className="text-right p-3">IP</th>
                  <th className="text-right p-3">סיבה</th>
                  <th className="text-right p-3">נתיב</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.recent.map(e => (
                  <tr key={e.id}>
                    <td className="p-3 text-slate-400 whitespace-nowrap">{fmt(e.created_at)}</td>
                    <td className="p-3 font-mono text-slate-200" dir="ltr">{e.ip}</td>
                    <td className="p-3 text-slate-300">{label(e.reason)}</td>
                    <td className="p-3 font-mono text-slate-500 text-xs" dir="ltr">{e.method} {e.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
