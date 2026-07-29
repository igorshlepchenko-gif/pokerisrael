import { useState, useEffect, useMemo } from 'react';
import { formatTime, eventDisplayDate } from '../utils/whatsapp';

const ROTATE_MS = 7000;
const FADE_MS = 300;
const IL_TZ = 'Asia/Jerusalem';

function shortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', timeZone: IL_TZ });
}

/* מציג טורניר אמיתי אחד בכל רגע ומתחלף בין כולם — הראשון (הקרוב ביותר) ללא
   תאריך (רק שעה), כל השאר עם תאריך קצר. מחליף רשימת טורנירים = מחליף תוכן
   מיד, ה-interval רץ ברקע בלי תלות בכך. */
export default function NextTournamentPill({ tournaments }) {
  const sorted = useMemo(() => {
    return (tournaments || [])
      .map(t => ({ t, when: eventDisplayDate(t) }))
      .filter(x => x.when)
      .sort((a, b) => new Date(a.when) - new Date(b.when));
  }, [tournaments]);

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => { setIndex(0); }, [sorted.length]);

  useEffect(() => {
    if (sorted.length < 2) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % sorted.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [sorted.length]);

  if (sorted.length === 0) return null;
  const { t: current, when } = sorted[index % sorted.length];
  const isNearest = index === 0;

  return (
    <div
      className="inline-flex items-center gap-3 rounded-full border px-4 py-2 mb-6 max-w-full"
      style={{ background: 'rgba(13,21,38,0.7)', borderColor: 'rgba(29,78,216,0.3)' }}
    >
      <span className="w-2 h-2 rounded-full bg-poker-cyan animate-pulse-blue motion-reduce:animate-none shrink-0" />
      <span
        className="flex items-center gap-3 min-w-0 transition-opacity"
        style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      >
        {isNearest && (
          <>
            <span className="text-[11px] font-bold text-slate-400 tracking-wide whitespace-nowrap">הקרוב ביותר</span>
            <span className="w-px h-4 bg-slate-700 shrink-0" />
          </>
        )}
        <span className="font-bold text-slate-100 text-sm truncate">{current.name}</span>
        <span className="w-px h-4 bg-slate-700 shrink-0" />
        <span className="font-mono font-bold text-poker-gold text-sm tabular-nums whitespace-nowrap">
          {isNearest ? `היום ${formatTime(when)}` : `${shortDate(when)} ${formatTime(when)}`}
        </span>
      </span>
    </div>
  );
}
