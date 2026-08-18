import { useState, useEffect } from 'react';
import api from '../../utils/api';

// שמות הווריאנטים לתצוגה — כדי שהטבלה תראה את הכיתוב עצמו ולא רק "a"/"b"
const LABELS = {
  nearby_button: {
    title: 'כפתור "מצא טורניר קרוב אליי" בעמוד הבית',
    a: '🔥 מגרד לך?',
    b: '⚡ אקשן בסביבה',
  },
};

export default function AbResults() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/ab-results')
      .then(r => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-400">טוען…</div>;
  if (!rows.length) return <div className="text-center py-10 text-slate-400">עדיין אין נתונים.</div>;

  const tests = [...new Set(rows.map(r => r.test_key))];

  return (
    <div className="space-y-6">
      {tests.map(key => {
        const group = rows.filter(r => r.test_key === key);
        const best = group.reduce((a, b) => (b.ctr ?? -1) > (a.ctr ?? -1) ? b : a, group[0]);
        const totalImp = group.reduce((n, r) => n + r.impressions, 0);
        return (
          <div key={key} className="border border-slate-700 rounded-xl p-4">
            <h3 className="font-black text-white mb-1">{LABELS[key]?.title || key}</h3>
            <p className="text-xs text-slate-500 mb-3">
              נספר מבקר אחד לכל וריאנט — ריענוני עמוד לא נספרים פעמיים.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="text-right py-2 px-2">גרסה</th>
                    <th className="text-center py-2 px-2">נחשפו</th>
                    <th className="text-center py-2 px-2">לחצו</th>
                    <th className="text-center py-2 px-2">אחוז הקלקה</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map(r => (
                    <tr key={r.variant} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-white font-semibold">
                        {LABELS[key]?.[r.variant] || r.variant}
                        {r === best && group.length > 1 && totalImp >= 100 && (
                          <span className="mr-2 text-[11px] text-emerald-400">מוביל</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-300">{r.impressions}</td>
                      <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-300">{r.clicks}</td>
                      <td className="py-2 px-2 text-center font-mono tabular-nums font-bold text-poker-green-light">
                        {r.ctr === null ? '—' : `${r.ctr}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalImp < 100 && (
              <p className="text-[11px] text-amber-400/80 mt-3">
                ⚠️ {totalImp} חשיפות בסך הכל — מוקדם מדי להסיק. בכמות כזו הפרש בין הגרסאות
                יכול לנבוע במקרה. שווה להמתין לכמה מאות חשיפות לפחות.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
