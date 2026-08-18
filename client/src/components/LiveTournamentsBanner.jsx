import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatCost, lateRegCloseTime, venueDisplayName, currentOccurrence } from '../utils/whatsapp';
import { tournamentProgress } from '../utils/nearby';
import LateRegCountdown from './LateRegCountdown';

/**
 * רצועת "רץ עכשיו" בעמוד הבית.
 *
 * מציגה, לכל טורניר שרץ ברגע זה, את השלב שבו הוא נמצא ואת הזמן שנותר להרשמה
 * מאוחרת — הספירה יורדת בזמן אמת.
 *
 * למה endpoint נפרד: הרשימה הציבורית (/tournaments) מסתירה בכוונה טורנירים
 * שכבר התחילו, וזה בדיוק מה שצריך להופיע כאן.
 */
export default function LiveTournamentsBanner({ onSelect }) {
  const [tournaments, setTournaments] = useState([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const load = () => api.get('/tournaments/nearby')
      .then(r => { if (!cancelled) setTournaments(r.data); })
      .catch(() => {});
    load();
    // רענון הנתונים עצמם כל 5 דקות — טורניר חדש עשוי להתחיל בינתיים
    const dataTimer = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(dataTimer); };
  }, []);

  // טיק של שנייה — הספירה לסגירת ההרשמה חייבת לזוז מול העיניים, אחרת אין
  // הבדל בינה לבין שעה כתובה
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const live = tournaments
    .map(t => ({ t, prog: tournamentProgress(t, now), closeAt: lateRegCloseTime(t, currentOccurrence(t)) }))
    .filter(({ prog }) => prog.status === 'running')
    // רק כאלה שעוד אפשר להצטרף אליהם — טורניר שההרשמה אליו נסגרה כבר לא
    // מועיל למי שמחפש לאן ללכת עכשיו
    .filter(({ closeAt }) => !closeAt || closeAt > now)
    .sort((a, b) => {
      if (!a.closeAt) return 1;
      if (!b.closeAt) return -1;
      return a.closeAt - b.closeAt;   // מה שנסגר הכי קרוב — ראשון
    });

  if (!live.length) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-white">
          רץ עכשיו — {live.length} {live.length === 1 ? 'טורניר' : 'טורנירים'}
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {live.map(({ t, prog, closeAt }) => (
          <LiveCard key={t.id} t={t} prog={prog} closeAt={closeAt} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function LiveCard({ t, prog, closeAt, onSelect }) {
  return (
    <button
      onClick={() => onSelect?.(t)}
      className="text-right bg-slate-800/80 border border-red-500/30 hover:border-red-500/60 rounded-2xl p-4
        transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg"
    >
      <div className="flex items-start gap-3 mb-3">
        {t.venue_logo
          ? <img src={t.venue_logo} alt="" className="w-10 h-10 rounded-full object-contain bg-slate-900 ring-1 ring-slate-600 shrink-0" />
          : <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg shrink-0">🏠</span>}
        <div className="min-w-0 flex-1">
          <div className="font-black text-white leading-tight truncate">{t.name}</div>
          <div className="text-poker-green-light text-xs font-semibold truncate">
            {venueDisplayName(t.venue_name, t.venue_type, t.venue_club_number)}
          </div>
        </div>
      </div>

      {/* השלב הנוכחי — הדבר שהכי קשה לדעת מבחוץ */}
      <div className="bg-slate-900/70 rounded-xl px-3 py-2 mb-2">
        {prog.isBreak ? (
          <div className="font-black text-amber-400 text-lg">☕ בהפסקה</div>
        ) : (
          <>
            <div className="font-black text-white text-lg leading-tight">
              רמה {prog.level}
            </div>
            <div className="font-mono tabular-nums text-poker-gold text-sm">
              {Number(prog.smallBlind).toLocaleString()}/{Number(prog.bigBlind).toLocaleString()}
              {prog.ante > 0 && <span className="text-slate-400"> · אנטה {Number(prog.ante).toLocaleString()}</span>}
            </div>
          </>
        )}
        <div className="text-[11px] text-slate-400 mt-0.5">
          נותרו ~{prog.minutesLeftInLevel} דק׳ לשלב
        </div>
      </div>

      {/* הזמן שנותר להרשמה מאוחרת — הסיבה היחידה שמישהו יזוז מהכיסא עכשיו */}
      <LateRegCountdown closeAt={closeAt} />

      <div className="text-[11px] text-slate-400 mt-2">
        כניסה {formatCost(t.cost)}
        {t.venue_city && <span> · {t.venue_city}</span>}
      </div>
    </button>
  );
}
