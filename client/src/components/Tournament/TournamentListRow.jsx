import { buildWhatsAppLink, formatTime, formatDate, formatCost, DAYS_HE, getStageDurations, formatGames, venueDisplayName, eventDisplayDate } from '../../utils/whatsapp';

export default function TournamentListRow({ t, index, onClick }) {
  const waLink = buildWhatsAppLink(t.whatsapp_number, t);
  const stages = Array.isArray(t.stages) ? t.stages : (typeof t.stages === 'string' ? JSON.parse(t.stages || '[]') : []);
  const levelDur = getStageDurations(stages, t.level_duration);

  return (
    <div onClick={onClick} className="group px-5 py-4 hover:bg-slate-700/30 transition-colors animate-fade-in cursor-pointer">

      {/* Mobile layout */}
      <div className="md:hidden space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
              {t.name}
              {t.is_boosted && (
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  🚀 {t.boost_label || 'מקודם'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-poker-green-light">
              {t.venue_logo
                ? <img src={t.venue_logo} alt={t.venue_name} className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-slate-600" />
                : <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl shrink-0">🏠</span>
              }
              {venueDisplayName(t.venue_name, t.venue_type, t.venue_club_number)}
            </div>
            <div className="text-xs text-slate-400">📍 {t.venue_address}, {t.venue_city}</div>
          </div>
          <div className="text-left shrink-0">
            <div className="text-lg font-black text-poker-gold">{formatCost(t.cost)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>🕐 {formatTime(eventDisplayDate(t))}</span>
          <span>{formatDate(eventDisplayDate(t))}</span>
          {t.is_recurring && t.day_of_week !== null && (
            <span className="text-poker-gold">כל {DAYS_HE[t.day_of_week]}</span>
          )}
        </div>
        {t.starting_stack && (
          <span className="text-xs bg-slate-700 text-poker-gold px-2 py-0.5 rounded-full">
            ערימה: {t.starting_stack.toLocaleString()}
          </span>
        )}
        <a href={waLink} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="wa-btn flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-2 px-4 rounded-xl text-sm transition-all">
          <WaIcon /> הרשמה לטורניר
        </a>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 items-center">

        {/* Name + venue */}
        <div className="min-w-0">
          <div className="font-bold text-slate-100 truncate group-hover:text-white flex items-center gap-1.5">
            {t.name}
            {t.is_boosted && (
              <span className="shrink-0 bg-amber-500/20 text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                🚀 {t.boost_label || 'מקודם'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-poker-green-light truncate">
            {t.venue_logo
              ? <img src={t.venue_logo} alt={t.venue_name} className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-slate-600" />
              : <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl shrink-0">🏠</span>
            }
            <span className="truncate">{venueDisplayName(t.venue_name, t.venue_type, t.venue_club_number)}</span>
          </div>
          {(t.starting_stack || t.level_duration || t.re_entry || t.late_reg_level || t.platform || t.game_type) && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {t.platform && (
                <span className="text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded-full font-bold">
                  {t.tournament_type === 'online' ? '💻' : '📍'} {t.platform}
                </span>
              )}
              {t.game_type && (
                <span className="text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/40 px-1.5 py-0.5 rounded-full font-bold">
                  🃏 {formatGames(t.game_type, t.secondary_games)}
                </span>
              )}
              {t.cash_sb != null && t.cash_bb != null && (
                <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-full font-bold">
                  🎯 {Number(t.cash_sb).toLocaleString('he-IL')}/{Number(t.cash_bb).toLocaleString('he-IL')}
                </span>
              )}
              {t.starting_stack && (
                <span className="text-[10px] bg-slate-700/80 text-poker-gold px-1.5 py-0.5 rounded-full">
                  🎯 {t.starting_stack.toLocaleString()}
                </span>
              )}
              {levelDur && (
                <span className="text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded-full font-bold tracking-wide">
                  ⏱ {levelDur}דק׳
                </span>
              )}
              {t.re_entry && (
                <span className="text-[10px] bg-slate-700/80 text-emerald-400 px-1.5 py-0.5 rounded-full">
                  🔄 {t.re_entry}
                </span>
              )}
              {t.late_reg_level && (
                <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-700/30">
                  ⏳ Late Reg שלב {t.late_reg_level}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Address */}
        <div className="text-sm text-slate-400 truncate">
          <span className="text-slate-500">📍</span> {t.venue_address}, {t.venue_city}
        </div>

        {/* Start time */}
        <div>
          <div className="font-bold text-poker-green-light">{formatTime(eventDisplayDate(t))}</div>
          <div className="text-xs text-slate-500">{formatDate(eventDisplayDate(t))}</div>
          {t.is_recurring && t.day_of_week !== null && (
            <div className="text-xs text-poker-gold">כל {DAYS_HE[t.day_of_week]}</div>
          )}
        </div>

        {/* Cost + Rake + GTD */}
        <div>
          {t.game_type && <div className="text-[10px] text-slate-500">כניסה מינ׳</div>}
          <div className="font-black text-poker-gold">{formatCost(t.cost)}</div>
          {t.rake != null && t.rake !== '' && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              RAKE {t.rake_type === 'percent' ? `${t.rake}%` : `₪${Number(t.rake).toLocaleString('he-IL')}`}
            </div>
          )}
          {t.gtd > 0 && (
            <div className="text-xs text-amber-400 font-bold mt-0.5">
              💰 ₪{Number(t.gtd).toLocaleString('he-IL')} GTD
            </div>
          )}
        </div>

        {/* WhatsApp button */}
        <a href={waLink} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="wa-btn flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-2 px-3 rounded-xl text-xs whitespace-nowrap transition-all hover:scale-105">
          <WaIcon /> הרשמה
        </a>
      </div>

      {/* Description tooltip on hover */}
      {t.description && (
        <div className="hidden md:block text-xs text-slate-500 mt-1 truncate pr-0 max-w-md group-hover:text-slate-400 transition-colors">
          {t.description}
        </div>
      )}
    </div>
  );
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
