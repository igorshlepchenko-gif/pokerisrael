import { useEffect, useState } from 'react';

/* שעון טורניר — הכלי הכי מזוהה בעולם הפוקר: רמות בליינד עולות.
   דקורטיבי בלבד (לא קשור לטורניר ספציפי) — מציג התקדמות רמות באופן אווירתי. */

const LEVELS = [
  { level: 1, sb: 100,  bb: 200,  ante: 0   },
  { level: 2, sb: 150,  bb: 300,  ante: 0   },
  { level: 3, sb: 200,  bb: 400,  ante: 400 },
  { level: 4, sb: 300,  bb: 600,  ante: 600 },
  { level: 5, sb: 500,  bb: 1000, ante: 1000 },
  { level: 6, sb: 700,  bb: 1400, ante: 1400 },
];

export default function TournamentClock() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const t = setInterval(() => setI(p => (p + 1) % LEVELS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const { level, sb, bb, ante } = LEVELS[i];

  return (
    <div
      className="inline-flex items-center gap-3 rounded-full border px-4 py-2 mb-6"
      style={{ background: 'rgba(13,21,38,0.7)', borderColor: 'rgba(29,78,216,0.3)' }}
      role="img"
      aria-label={`שעון טורניר לדוגמה — רמה ${level}, בליינדים ${sb} מול ${bb}`}
    >
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-full bg-poker-cyan animate-pulse-blue motion-reduce:animate-none shrink-0"
      />
      <span aria-hidden="true" className="text-[11px] font-bold text-slate-400 tracking-wide">
        רמה {level}
      </span>
      <span aria-hidden="true" className="w-px h-4 bg-slate-700" />
      <span aria-hidden="true" className="font-mono font-bold text-poker-gold text-sm tabular-nums">
        {sb.toLocaleString('he-IL')}<span className="text-slate-500 mx-0.5">/</span>{bb.toLocaleString('he-IL')}
        {ante > 0 && <span className="text-slate-500 text-xs mx-1.5">אנטה {ante.toLocaleString('he-IL')}</span>}
      </span>
    </div>
  );
}
