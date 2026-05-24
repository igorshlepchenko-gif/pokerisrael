import { buildWhatsAppLink, formatTime, formatDate, formatCost, DAYS_HE } from '../../utils/whatsapp';

const SUIT_COLORS = ['text-red-400', 'text-slate-300', 'text-red-400', 'text-slate-300'];
const SUITS = ['♥', '♠', '♦', '♣'];

function randomSuit(id) {
  return { suit: SUITS[id % 4], color: SUIT_COLORS[id % 4] };
}

export default function TournamentCard({ t, index }) {
  const { suit, color } = randomSuit(index);
  const waLink = buildWhatsAppLink(t.whatsapp_number, t.name);

  const stages = Array.isArray(t.stages)
    ? t.stages
    : (typeof t.stages === 'string' ? JSON.parse(t.stages || '[]') : []);

  return (
    <div className={`card p-5 hover:border-poker-green/50 transition-all duration-300 hover:shadow-poker-green/10 hover:shadow-2xl animate-slide-up group relative overflow-hidden ${t.is_boosted ? 'border-amber-500/40 shadow-amber-500/5 shadow-xl' : ''}`}>

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

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-lg text-slate-100 leading-tight">{t.name}</h3>
            <p className="text-poker-green-light font-semibold text-sm mt-0.5">{t.venue_name}</p>
          </div>
          <div className="text-left shrink-0">
            <div className="text-xl font-black text-poker-gold">{formatCost(t.cost)}</div>
            <div className="text-xs text-slate-400 text-left">כניסה</div>
          </div>
        </div>
      </div>

      {/* Venue info */}
      <div className="text-xs text-slate-400 flex items-center gap-1 mb-3">
        <span>📍</span>
        <span>{t.venue_address}, {t.venue_city}</span>
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-0.5">התחלה</div>
          <div className="font-bold text-poker-green-light">{formatTime(t.start_time)}</div>
          <div className="text-xs text-slate-400">{formatDate(t.start_time)}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-0.5">סיום משוער</div>
          <div className="font-bold text-slate-300">
            {t.estimated_end_time ? formatTime(t.estimated_end_time) : '—'}
          </div>
          {t.is_recurring && t.day_of_week !== null && (
            <div className="text-xs text-poker-gold">כל יום {DAYS_HE[t.day_of_week]}</div>
          )}
        </div>
      </div>

      {/* Description */}
      {t.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">{t.description}</p>
      )}

      {/* Stages */}
      {stages.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-slate-500 mb-1 font-semibold">שלבים:</div>
          <div className="flex flex-wrap gap-1">
            {stages.map((s, i) => (
              <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {s.name} · {s.duration_minutes}′
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ad slot per card — replace with actual ad code when ready */}
      {/* <div className="mb-3">...</div> */}

      {/* WhatsApp button */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
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
