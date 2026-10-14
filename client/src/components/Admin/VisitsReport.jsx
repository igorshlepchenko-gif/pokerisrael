import { useState, useEffect } from 'react';
import api from '../../utils/api';

// דוח כניסות לאתר (server/routes/analytics.js). "מבקרים" = אנשים שונים באותו יום;
// סכום על פני תקופה = מספר ביקורים (מי שנכנס ביומיים שונים נספר פעמיים — אין מעקב בין ימים).

const PAGE_NAMES = {
  '/': 'עמוד הבית',
  '/podcasts': 'פודקאסטים',
  '/communities': 'קהילות',
  '/lessons': 'לימודי פוקר',
  '/online': 'פוקר אונליין',
  '/rules': 'חוקים',
  '/hands': 'רישום ידיים',
  '/hand-logger': 'רישום ידיים',
  '/login': 'התחברות',
  '/register': 'הרשמה',
  '/dashboard': 'לוח בקרה (מועדונים)',
  '/privacy': 'מדיניות פרטיות',
  '/accessibility': 'הצהרת נגישות',
};
const pageName = (p) => PAGE_NAMES[p.replace(/\/$/, '') || '/'] || p;

const SOURCE_RULES = [
  [/google\./, 'גוגל'],
  [/(^|\.)facebook\.com$|^fb\.|^l\.facebook/, 'פייסבוק'],
  [/whatsapp|^wa\.me$|^l\.wl\.co$/, 'וואטסאפ'],
  [/instagram/, 'אינסטגרם'],
  [/^t\.me$|telegram/, 'טלגרם'],
  [/bing\.com/, 'בינג'],
  [/youtube/, 'יוטיוב'],
];
function sourceName(s) {
  if (!s) return 'ישירה (הקלדה, סימנייה או אפליקציה)';
  const hit = SOURCE_RULES.find(([re]) => re.test(s));
  return hit ? hit[1] : s;
}
// מאחד מקורות שממופים לאותו שם (למשל google.com + google.co.il)
function groupSources(rows) {
  const m = new Map();
  for (const r of rows) {
    const name = sourceName(r.source);
    m.set(name, (m.get(name) || 0) + r.visits);
  }
  return [...m.entries()].map(([name, visits]) => ({ name, visits })).sort((a, b) => b.visits - a.visits);
}

const LTR = { direction: 'ltr' };
const DEVICE_NAMES = { mobile: '📱 נייד', desktop: '💻 מחשב', tablet: '📟 טאבלט' };
const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
const weekday = (d) => new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'short' });

function Tile({ label, value, hint }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-white tabular-nums">{value.toLocaleString('he-IL')}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function ShareList({ title, rows, total }) {
  return (
    <div className="card p-4">
      <h3 className="font-black text-white mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-slate-500">אין נתונים עדיין</p> : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const pct = total ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.label} className="text-sm">
                <div className="flex justify-between gap-3 mb-1">
                  <span className="text-slate-200 truncate">{r.label}</span>
                  <span className="text-slate-400 tabular-nums whitespace-nowrap">{r.value.toLocaleString('he-IL')} · {pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function VisitsReport() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/analytics/summary', { params: { days } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="text-center py-10 text-slate-400">טוען…</div>;
  if (!data) return <div className="card p-12 text-center text-slate-500">לא ניתן לטעון את הנתונים</div>;

  const daily = data.daily;
  const today = daily[daily.length - 1] || { visitors: 0, views: 0 };
  const visits = daily.reduce((n, d) => n + d.visitors, 0);
  const views = daily.reduce((n, d) => n + d.views, 0);
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const sources = groupSources(data.sources);
  const entries = sources.reduce((n, s) => n + s.visits, 0);
  const deviceTotal = data.devices.reduce((n, d) => n + d.visits, 0);
  const shown = hover ?? daily.length - 1;
  const avgRaw = visits / daily.length;
  const avg = avgRaw < 10 ? Math.round(avgRaw * 10) / 10 : Math.round(avgRaw);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-400 max-w-2xl">
          כניסות של אנשים אמיתיים לאתר — בלי בוטים ובלי הכניסות שלך כאדמין. בלי עוגיות: מבקר נספר פעם אחת ביום.
        </p>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-field text-sm w-36 py-1.5">
          <option value={7}>7 ימים</option>
          <option value={30}>30 ימים</option>
          <option value={90}>90 ימים</option>
          <option value={365}>שנה</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="מבקרים היום" value={today.visitors} hint={`${today.views.toLocaleString('he-IL')} צפיות בדפים`} />
        <Tile label={`ביקורים ב-${days} ימים`} value={visits} hint="סכום המבקרים היומיים" />
        <Tile label="צפיות בדפים" value={views} hint={visits ? `${(views / visits).toFixed(1)} דפים לביקור` : ' '} />
        <Tile label="ממוצע ליום" value={avg} hint="מבקרים" />
      </div>

      {/* גרף מבקרים לפי יום */}
      <div className="card p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-black text-white">מבקרים לפי יום</h3>
          <span className="text-sm text-slate-300 tabular-nums">
            {weekday(daily[shown].day)} {fmtDay(daily[shown].day)} · <b className="text-white">{daily[shown].visitors}</b> מבקרים · {daily[shown].views} צפיות
          </span>
        </div>
        {/* index.css מכריח direction:rtl על כל אלמנט — ציר הזמן צריך ltr מפורש בכל רמה */}
        <div className="relative h-40" style={LTR} onMouseLeave={() => setHover(null)}>
          {/* קווי רשת עדינים */}
          {[0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-slate-700/40" style={{ bottom: `${f * 100}%` }}>
              <span className="absolute -top-2 left-0 text-[10px] text-slate-500 bg-transparent">{Math.round(max * f)}</span>
            </div>
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] pl-6" style={LTR}>
            {daily.map((d, i) => (
              <div
                key={d.day}
                className="flex-1 h-full flex items-end cursor-default"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
                title={`${fmtDay(d.day)}: ${d.visitors} מבקרים`}
              >
                <div
                  className={`w-full rounded-t ${i === shown ? 'bg-blue-400' : 'bg-blue-600/80'}`}
                  style={{ height: `${(d.visitors / max) * 100}%`, minHeight: d.visitors ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1 pl-6" style={LTR}>
          <span>{fmtDay(daily[0].day)}</span>
          <span>{fmtDay(daily[daily.length - 1].day)}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ShareList title="מאיפה הגיעו" total={entries} rows={sources.map((s) => ({ label: s.name, value: s.visits }))} />
        <ShareList
          title="מכשיר"
          total={deviceTotal}
          rows={data.devices.map((d) => ({ label: DEVICE_NAMES[d.device] || d.device, value: d.visits }))}
        />
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-black text-white px-4 pt-4">הדפים הנצפים ביותר</h3>
        <table className="w-full text-sm mt-2">
          <thead className="text-xs text-slate-400 border-b border-slate-700">
            <tr>
              <th className="text-right p-3">דף</th>
              <th className="text-right p-3">צפיות</th>
              <th className="text-right p-3">מבקרים</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {data.pages.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-slate-500">אין נתונים עדיין</td></tr>
            )}
            {data.pages.map((p) => (
              <tr key={p.path}>
                <td className="p-3 text-slate-200">{pageName(p.path)} <span className="text-xs text-slate-500 font-mono" dir="ltr">{p.path}</span></td>
                <td className="p-3 tabular-nums">{p.views.toLocaleString('he-IL')}</td>
                <td className="p-3 tabular-nums text-slate-400">{p.visitors.toLocaleString('he-IL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
