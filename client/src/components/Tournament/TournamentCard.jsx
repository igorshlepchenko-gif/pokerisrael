import { useState } from 'react';
import { formatTime, formatDate, formatCost, DAYS_HE, buildWhatsAppLink, getStageDurations, formatGames, venueDisplayName, eventDisplayDate } from '../../utils/whatsapp';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import RegistrationModal from './RegistrationModal';

const SUIT_COLORS = ['text-red-400', 'text-slate-300', 'text-red-400', 'text-slate-300'];
const SUITS = ['♥', '♠', '♦', '♣'];

function WaIcon({ small }) {
  return (
    <svg viewBox="0 0 24 24" className={`${small ? 'w-3.5 h-3.5' : 'w-5 h-5'} fill-current shrink-0`} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function randomSuit(id) {
  return { suit: SUITS[id % 4], color: SUIT_COLORS[id % 4] };
}

export default function TournamentCard({ t, index, onClick, brands = [] }) {
  const { suit, color } = randomSuit(index);
  const { user } = useAuth();
  const [showRegModal, setShowRegModal] = useState(false);

  // מצא brand logo לפי שם הטורניר
  const matchedBrand = brands.find(b =>
    b.venue_id === t.venue_id && t.name?.toLowerCase().includes(b.name.toLowerCase())
  );
  const displayLogo = matchedBrand?.logo_url || t.venue_logo;

  const openWhatsApp = (name, phone) => {
    api.post('/registrations', {
      tournament_id:    t.id,
      tournament_name:  t.name,
      venue_id:         t.venue_id,
      venue_name:       t.venue_name,
      tournament_date:  t.start_time,
      registrant_name:  name || 'אנונימי',
      registrant_phone: phone || null,
      user_id:          user?.id || null,
    }).catch(() => {});
    window.open(buildWhatsAppLink(t.whatsapp_number, t, name, phone), '_blank', 'noopener,noreferrer');
  };

  const handleRegister = (e) => {
    e.stopPropagation();
    if (user) {
      // מחובר — ישר WhatsApp עם הפרטים מהמערכת
      openWhatsApp(user.name, user.phone);
    } else {
      // לא מחובר — חלון הזנת פרטים
      setShowRegModal(true);
    }
  };

  // רישום כפול — הרשמה דרך המארגן (Runner Runner) בנוסף למארח
  const hasOrganizer = !!(t.organizer_name && (t.organizer_whatsapp || t.organizer_registration_url));
  const openOrganizerWhatsApp = (e) => {
    e.stopPropagation();
    if (!t.organizer_whatsapp) return;
    const n = user?.name, p = user?.phone;
    api.post('/registrations', {
      tournament_id: t.id, tournament_name: t.name, venue_id: t.organizer_venue_id,
      venue_name: t.organizer_name, tournament_date: t.start_time,
      registrant_name: n || 'אנונימי', registrant_phone: p || null, user_id: user?.id || null,
    }).catch(() => {});
    window.open(buildWhatsAppLink(t.organizer_whatsapp, t, n, p), '_blank', 'noopener,noreferrer');
  };

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
        {displayLogo
          ? <img src={displayLogo} alt={matchedBrand?.name || t.venue_name} className="w-14 h-14 rounded-full object-contain bg-slate-800 shrink-0 ring-2 ring-slate-600" />
          : <span className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-2xl shrink-0">🏠</span>
        }
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-slate-100 leading-tight truncate">{t.name}</h3>
          <p className="text-poker-green-light font-semibold text-sm">{venueDisplayName(t.venue_name, t.venue_type, t.venue_club_number)}</p>
        </div>
      </div>

      {/* Venue info */}
      <div className="text-xs text-slate-400 flex items-center gap-1 mb-3">
        <span>📍</span>
        <span>{t.venue_address}, {t.venue_city}</span>
      </div>

      {/* סוג משחק קאש / פלטפורמה אונליין */}
      {(t.game_type || t.platform) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {t.platform && (
            <span className="text-xs bg-blue-500/15 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-bold">
              {t.tournament_type === 'online' ? '💻' : '📍'} {t.platform}
            </span>
          )}
          {t.game_type && (
            <span className="text-xs bg-violet-500/15 text-violet-300 border border-violet-500/40 px-2 py-0.5 rounded-full font-bold tracking-wide">
              🃏 {formatGames(t.game_type, t.secondary_games)}
            </span>
          )}
          {t.cash_sb != null && t.cash_bb != null && (
            <span className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
              🎯 בליינדים: {Number(t.cash_sb).toLocaleString('he-IL')}/{Number(t.cash_bb).toLocaleString('he-IL')}
            </span>
          )}
        </div>
      )}

      {/* גריד מסודר: התחלה | סיום | עלות — שלושתם בשורה אחת */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-0.5">{t.is_recurring ? 'המופע הבא' : 'התחלה'}</div>
          <div className="font-bold text-poker-green-light">{formatTime(eventDisplayDate(t))}</div>
          <div className="text-xs text-slate-400">{formatDate(eventDisplayDate(t))}</div>
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
          <div className="text-xs text-slate-500 mb-0.5">{t.game_type ? 'כניסה מינ׳' : 'כניסה'}</div>
          <div className="font-bold text-poker-gold">{formatCost(t.cost)}</div>
          {t.rake != null && t.rake !== '' && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              RAKE {t.rake_type === 'percent' ? `${t.rake}%` : `₪${Number(t.rake).toLocaleString('he-IL')}`}
            </div>
          )}
        </div>
      </div>

      {/* GTD */}
      {t.gtd > 0 && (
        <div className="mb-3 flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
          <span className="text-amber-400 text-base">💰</span>
          <span className="text-xs text-amber-400/70 font-semibold">GTD</span>
          <span className="text-amber-300 font-black text-base">₪{Number(t.gtd).toLocaleString('he-IL')}</span>
        </div>
      )}

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
          {getStageDurations(stages, t.level_duration) && (
            <span className="text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold tracking-wide">
              ⏱ {getStageDurations(stages, t.level_duration)} דק׳
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
          estTime = dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
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

      {/* WhatsApp button — הרשמה דרך המארח */}
      <button
        onClick={handleRegister}
        className="wa-btn flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-2.5 px-4 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 text-sm shadow-lg"
      >
        <WaIcon />
        {hasOrganizer
          ? `הרשמה דרך ${t.venue_name}`
          : (t.tournament_type === 'cash' || t.tournament_type === 'online_cash' ? 'הצטרפות למשחק' : 'הרשמה לטורניר')}
      </button>

      {/* רישום כפול — הרשמה דרך המארגן (Runner Runner וכו') */}
      {hasOrganizer && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-2">
          <p className="text-[11px] text-slate-500 text-center">או הרשמה דרך {t.organizer_name}:</p>
          {t.organizer_whatsapp && (
            <button
              onClick={openOrganizerWhatsApp}
              className="flex items-center justify-center gap-2 w-full bg-[#25D366]/15 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#4ade80] font-bold py-2 px-4 rounded-xl transition-all text-sm"
            >
              <WaIcon small />
              הרשמה דרך {t.organizer_name}
            </button>
          )}
          {t.organizer_registration_url && (
            <a
              href={t.organizer_registration_url}
              target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center justify-center gap-2 w-full font-bold py-2 px-4 rounded-xl text-sm
                text-white bg-gradient-to-l from-blue-600 to-indigo-600
                shadow-[0_0_14px_rgba(99,102,241,0.6)] hover:shadow-[0_0_22px_rgba(99,102,241,0.9)]
                hover:scale-105 active:scale-95 transition-all duration-200"
            >
              🔗 הרשמה אונליין ({t.organizer_name})
            </a>
          )}
        </div>
      )}

      {/* קישור חיצוני להרשמה */}
      {t.external_registration_url && (
        <a
          href={t.external_registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full font-bold py-2.5 px-4 rounded-xl text-sm
            text-white bg-gradient-to-l from-blue-600 to-indigo-600
            shadow-[0_0_14px_rgba(99,102,241,0.6)] hover:shadow-[0_0_22px_rgba(99,102,241,0.9)]
            hover:scale-105 active:scale-95 transition-all duration-200 animate-pulse-slow"
        >
          🔗 הרשמה אונליין
        </a>
      )}

      {/* קישור לאתר המקום */}
      {t.venue_website && (
        <a
          href={/^https?:\/\//i.test(t.venue_website) ? t.venue_website : `https://${t.venue_website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
        >
          <span>🌐</span>
          <span>לאתר המקום</span>
        </a>
      )}

      {showRegModal && (
        <RegistrationModal
          tournament={t}
          onClose={() => setShowRegModal(false)}
          onSubmit={(name, phone) => { setShowRegModal(false); openWhatsApp(name, phone); }}
        />
      )}
    </div>
  );
}
