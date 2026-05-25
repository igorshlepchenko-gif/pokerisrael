import { buildWhatsAppLink, formatTime, formatDate, formatCost, DAYS_HE } from '../../utils/whatsapp';

const SUIT_COLORS = ['text-red-400', 'text-slate-300', 'text-red-400', 'text-slate-300'];
const SUITS = ['♥', '♠', '♦', '♣'];

function randomSuit(id) {
  return { suit: SUITS[id % 4], color: SUIT_COLORS[id % 4] };
}

export default function TournamentCard({ t, index, onClick }) {
  const { suit, color } = randomSuit(index);
  const waLink = buildWhatsAppLink(t.whatsapp_number, t.name);

  const stages = Array.isArray(t.stages)
    ? t.stages
    : (typeof t.stages === 'string' ? JSON.parse(t.stages || '[]') : []);

  return (
    <div
      onClick={onClick}
      className={`card p-5 hover:border-poker-green/50 transition-all duration-300 hover:shadow-poker-green/10 hover:shadow-2xl animate-slide-up group relative overflow-hidden cursor-pointer ${t.is_boosted ? 'border-amber-500/40 shadow-amber-500/5 shadow-xl' : ''}`}
    >

      {/* Boost badge */}
      {t.is_boosted && (
        <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg z-10">
          🚀 {t.boost_label || 'מקודם'}
        </div>
      )}

      {/* Decorative suit */}
      <span className={`absolute top-3 left-4 text-4xl opacity-10 group-hover:opacity-20 transition-opacity select-none ${color}`}>
        {suit}
      </span>

      {/* Header — לוגו + שם מועדון + שם טורניר */}
      <div className="flex items-center gap-3 mb-3">
        {t.venue_logo
          ? <img src={t.venue_logo} alt={t.venue_name} className="w-14 h-14 rounded-full object-cover shrink-0 ring-2 ring-slate-600" />
          : <span className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-2xl shrink-0">🏠</span>
        }
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-slate-100 leading-tight truncate">{t.name}</h3>
          <p className="text-poker-green-light font-semibold text-sm">{t.venue_name}</p>
        </div>
      </div>

      {/* Venue info */}
      <div className="text-xs text-slate-400 flex items-center gap-1 mb-3">
        <span>📍</span>
        <span>{t.venue_address}, {t.venue_city}</span>
      </div>

      {/* גריד מסודר: התחלה | סיום | עלות — שלושתם בשורה אחת */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-0.5">התחלה</div>
          <div className="font-bold text-poker-green-light">{formatTime(t.start_time)}</div>
          <div className="text-xs text-slate-400">{formatDate(t.start_time)}</div>
          {t.is_recurring && t.day_of_week !== null && (
            <div className="text-xs text-poker-gold">כל יום {DAYS_HE[t.day_of_week]}</div>
          )}
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-0.5">סיום משוער</div>
          <div className="font-bold text-slate-300">
            {t.estimated_end_time ? formatTime(t.estimated_end_time) : '—'}
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-0.5">כניסה</div>
          <div className="font-bold text-poker-gold">{formatCost(t.cost)}</div>
        </div>
      </div>

      {/* Description */}
      {t.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">{t.description}</p>
      )}

      {/* Starting stack + level duration + re-entry */}
      {(t.starting_stack || t.level_duration || t.re_entry) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {t.starting_stack && (
            <span className="text-xs bg-slate-700 text-poker-gold px-2 py-0.5 rounded-full font-bold">
              🎯 ערימה: {t.starting_stack.toLocaleString()}
            </span>
          )}
          {t.level_duration && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-bold">
              ⏱ {t.level_duration} דק׳ לשלב
            </span>
          )}
          {t.re_entry && (
            <span className="text-xs bg-slate-700 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              🔄 {t.re_entry} Re-Entry
            </span>
          )}
        </div>
      )}

      {/* Late Registration */}
      {t.late_reg_level && (() => {
        let n = 0, stageIdx = -1;
        for (let i = 0; i < stages.length; i++) {
          if (stages[i].type !== 'break') n++;
          if (n === t.late_reg_level) { stageIdx = i; break; }
        }
        if (stageIdx === -1) return null;
        const stage = stages[stageIdx];
        let totalMins = 0;
        for (let i = 0; i < stageIdx; i++) totalMins += parseInt(stages[i].duration) || 0;
        let estTime = null;
        if (t.start_time) {
          const dt = new Date(t.start_time);
          dt.setMinutes(dt.getMinutes() + totalMins);
          estTime = dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        }
        return (
          <div className="mb-3 bg-indigo-950/50 rounded-lg px-3 py-2 border border-indigo-700/30 text-xs flex flex-wrap gap-3">
            <span className="text-indigo-300 font-bold">⏳ Late Reg עד שלב {t.late_reg_level}</span>
            <span className="text-slate-400">
              {stage.small_blind?.toLocaleString()}/{stage.big_blind?.toLocaleString()}
            </span>
            {estTime && <span className="text-poker-green-light font-semibold">~ {estTime}</span>}
          </div>
        );
      })()}

      {/* Blind structure table */}
      {stages.length > 0 && (() => {
        const levelCount = stages.filter(r => r.type !== 'break').length;
        const hasDuration = stages.some(r => r.type !== 'break' && r.duration);
        return (
          <details className="mb-3 group/blind">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors select-none list-none flex items-center gap-1">
              <span className="group-open/blind:rotate-90 transition-transform inline-block">▶</span>
              מבנה בליינדים ({levelCount} שלבים)
            </summary>
            <div className="mt-2 rounded-lg overflow-hidden border border-slate-700">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-800 text-slate-400">
                    <th className="py-1 px-2 text-center">שלב</th>
                    <th className="py-1 px-2 text-center">סמול</th>
                    <th className="py-1 px-2 text-center">ביג</th>
                    <th className="py-1 px-2 text-center">אנטה</th>
                    {hasDuration && <th className="py-1 px-2 text-center">זמן</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lvl = 0;
                    return stages.map((row, i) => {
                      const isBreak = row.type === 'break';
                      if (!isBreak) lvl++;
                      const displayLevel = isBreak ? null : lvl;
                      return isBreak ? (
                        <tr key={i} className="bg-amber-500/5 border-y border-amber-500/20">
                          <td className="py-1 px-2 text-center text-amber-400 text-[10px]">☕</td>
                          <td colSpan={hasDuration ? 3 : 3} className="py-1 px-2 text-center text-amber-400/80 text-[10px] font-semibold">
                            הפסקה
                          </td>
                          {hasDuration && (
                            <td className="py-1 px-2 text-center text-amber-400/70 text-[10px]">{row.duration} דק׳</td>
                          )}
                        </tr>
                      ) : (
                        <tr key={i} className={i % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-800/30'}>
                          <td className="py-1 px-2 text-center">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-poker-green-light font-black text-[10px]">
                              {displayLevel}
                            </span>
                          </td>
                          <td className="py-0.5 px-2 text-center text-poker-gold">{row.small_blind?.toLocaleString()}</td>
                          <td className="py-0.5 px-2 text-center text-poker-gold">{row.big_blind?.toLocaleString()}</td>
                          <td className="py-0.5 px-2 text-center text-slate-400">{row.ante > 0 ? row.ante?.toLocaleString() : '—'}</td>
                          {hasDuration && (
                            <td className="py-0.5 px-2 text-center text-slate-300">{row.duration ? `${row.duration}′` : '—'}</td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </details>
        );
      })()}

      {/* WhatsApp button */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="wa-btn flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-2.5 px-4 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 text-sm shadow-lg"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        הרשמה לטורניר
      </a>
    </div>
  );
}
