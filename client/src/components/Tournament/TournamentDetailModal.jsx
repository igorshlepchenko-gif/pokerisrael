import { useEffect } from 'react';
import { buildWhatsAppLink, formatTime, formatDate, formatCost, DAYS_HE } from '../../utils/whatsapp';

export default function TournamentDetailModal({ tournament: t, onClose }) {
  // סגירה ב-Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // מניעת גלילה ברקע
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!t) return null;

  const waLink = buildWhatsAppLink(t.whatsapp_number, t.name);

  const stages = Array.isArray(t.stages)
    ? t.stages
    : (typeof t.stages === 'string' ? JSON.parse(t.stages || '[]') : []);

  const levelCount = stages.filter(r => r.type !== 'break').length;
  const hasDuration = stages.some(r => r.type !== 'break' && r.duration);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">

        {/* Header sticky */}
        <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur border-b border-slate-700 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {t.venue_logo
              ? <img src={t.venue_logo} alt={t.venue_name} className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-600 shrink-0" />
              : <span className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl shrink-0">🏠</span>
            }
            <div className="min-w-0">
              <h2 className="font-black text-white text-base leading-tight truncate">{t.name}</h2>
              <p className="text-poker-green-light font-semibold text-sm truncate">{t.venue_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-700 rounded-lg"
            aria-label="סגור"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Boost badge */}
          {t.is_boosted && (
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
              🚀 {t.boost_label || 'מקודם'}
            </div>
          )}

          {/* Address */}
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <span>📍</span>
            <span>{t.venue_address}, {t.venue_city}</span>
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 rounded-xl p-3 text-center">
              <div className="text-[11px] text-slate-500 mb-1">📅 התחלה</div>
              <div className="font-black text-poker-green-light text-2xl leading-none">{formatTime(t.start_time)}</div>
              <div className="text-xs text-slate-400 mt-1">{formatDate(t.start_time)}</div>
              {t.is_recurring && t.day_of_week !== null && (
                <div className="text-[11px] text-poker-gold mt-1 font-semibold">כל יום {DAYS_HE[t.day_of_week]}</div>
              )}
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 text-center">
              <div className="text-[11px] text-slate-500 mb-1">🏁 סיום משוער</div>
              <div className="font-black text-slate-300 text-2xl leading-none">
                {t.estimated_end_time ? formatTime(t.estimated_end_time) : '—'}
              </div>
            </div>
          </div>

          {/* Cost + stack + level badges */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-slate-700/80 text-poker-gold font-black text-base px-4 py-2 rounded-xl border border-slate-600">
              💰 {formatCost(t.cost)}
            </span>
            {t.starting_stack && (
              <span className="bg-slate-700/80 text-poker-gold px-3 py-2 rounded-xl font-bold text-sm border border-slate-600">
                🎯 ערימה: {t.starting_stack.toLocaleString()}
              </span>
            )}
            {t.level_duration && (
              <span className="bg-slate-700/80 text-slate-300 px-3 py-2 rounded-xl font-bold text-sm border border-slate-600">
                ⏱ {t.level_duration} דק׳ לשלב
              </span>
            )}
          </div>

          {/* Description */}
          {t.description && (
            <div className="text-sm text-slate-300 leading-relaxed bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
              {t.description}
            </div>
          )}

          {/* Blind structure */}
          {stages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-slate-300">מבנה בליינדים</span>
                <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">{levelCount} שלבים</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-[11px]">
                      <th className="py-2 px-2 text-center font-semibold">שלב</th>
                      <th className="py-2 px-2 text-center font-semibold">סמול</th>
                      <th className="py-2 px-2 text-center font-semibold">ביג</th>
                      <th className="py-2 px-2 text-center font-semibold">אנטה</th>
                      {hasDuration && <th className="py-2 px-2 text-center font-semibold">זמן</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let lvl = 0;
                      return stages.map((row, i) => {
                        const isBreak = row.type === 'break';
                        if (!isBreak) lvl++;
                        return isBreak ? (
                          <tr key={i} className="bg-amber-500/5 border-y border-amber-500/20">
                            <td className="py-2 px-2 text-center text-amber-400">☕</td>
                            <td colSpan={3} className="py-2 px-2 text-center text-amber-400/80 font-semibold">הפסקה</td>
                            {hasDuration && (
                              <td className="py-2 px-2 text-center text-amber-400/70">{row.duration} דק׳</td>
                            )}
                          </tr>
                        ) : (
                          <tr key={i} className={i % 2 === 0 ? 'bg-slate-800/40' : 'bg-slate-900/30'}>
                            <td className="py-2 px-2 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-poker-green-light font-black text-[11px]">
                                {lvl}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center text-poker-gold font-bold">{row.small_blind?.toLocaleString()}</td>
                            <td className="py-2 px-2 text-center text-poker-gold font-bold">{row.big_blind?.toLocaleString()}</td>
                            <td className="py-2 px-2 text-center text-slate-400">{row.ante > 0 ? row.ante?.toLocaleString() : '—'}</td>
                            {hasDuration && (
                              <td className="py-2 px-2 text-center text-slate-300">{row.duration ? `${row.duration}′` : '—'}</td>
                            )}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bottom padding so footer doesn't cover content */}
          <div className="h-2" />
        </div>

        {/* Footer sticky: WhatsApp CTA */}
        <div className="sticky bottom-0 shrink-0 bg-slate-800/95 backdrop-blur border-t border-slate-700 px-5 py-4">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 text-base shadow-lg"
          >
            <WaIcon />
            הרשמה לטורניר בוואטסאפ
          </a>
        </div>
      </div>
    </div>
  );
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
