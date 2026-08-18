import { useState, useEffect } from 'react';
import { formatTime } from '../utils/whatsapp';

/**
 * ספירה לאחור לסגירת ההרשמה המאוחרת.
 *
 * משותפת לרצועת "רץ עכשיו" בעמוד הבית ולמודל "מצא טורניר קרוב אליי" — שני
 * המקומות עונים על אותה שאלה ("יש לי עוד זמן להגיע?"), ושכפול הלוגיקה בין
 * שניהם היה נפרד עם הזמן.
 *
 * closeAt = null פירושו שאי אפשר לחשב (אין late_reg_level או אין משכי שלבים).
 * במקרה כזה אומרים זאת במפורש במקום להציג מספר שאולי שגוי.
 */
export default function LateRegCountdown({ closeAt, size = 'normal' }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!closeAt) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [closeAt]);

  if (!closeAt) {
    return (
      <div className="rounded-xl px-3 py-2 bg-slate-700/40 border border-slate-600">
        <div className="text-slate-300 text-xs font-semibold">
          ⏳ זמן ההרשמה המאוחרת לא ידוע — כדאי לברר מול המועדון
        </div>
      </div>
    );
  }

  const msLeft = closeAt - now;
  const closed = msLeft <= 0;
  const closingSoon = !closed && msLeft <= 30 * 60 * 1000;

  const total = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const clock = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;

  const tone = closed
    ? 'bg-slate-700/40 border-slate-600 text-slate-400'
    : closingSoon
      ? 'bg-red-500/15 border-red-500/50 text-red-300'
      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300';

  const clockSize = size === 'large' ? 'text-4xl' : 'text-2xl';

  return (
    <div className={`rounded-xl px-3 py-2 border ${tone}`}>
      <div className="text-[11px] font-semibold">
        {closed ? 'ההרשמה המאוחרת נסגרה'
          : closingSoon ? '⚠️ נסגר בקרוב — הרשמה מאוחרת'
          : '⏱️ נותר להרשמה מאוחרת'}
      </div>
      {!closed && (
        <div className={`font-black font-mono tabular-nums leading-tight ${clockSize}`}>
          {clock}
        </div>
      )}
      <div className="text-[11px] text-slate-400">נסגרת ב-{formatTime(closeAt)}</div>
    </div>
  );
}
