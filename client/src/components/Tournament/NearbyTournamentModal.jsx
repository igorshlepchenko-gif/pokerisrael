import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import {
  formatTime, formatDate, formatCost, venueDisplayName,
  buildLateRegContactLink, lateRegCloseTime,
} from '../../utils/whatsapp';
import {
  rankByDistance, tournamentCoords, formatDistance,
  tournamentProgress, wazeLink, googleMapsLink, FAR_AWAY_KM, navAddress,
} from '../../utils/nearby';

const GEO_OPTS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };

export default function NearbyTournamentModal({ onClose, onShowDetails }) {
  const [phase, setPhase] = useState('locating'); // locating | ready | denied | empty | error
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState([]);
  const [idx, setIdx] = useState(0);
  const closeRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => { closeRef.current?.focus(); }, [phase]);

  useEffect(() => {
    let cancelled = false;

    if (!('geolocation' in navigator)) {
      setPhase('denied');
      setErrorMsg('הדפדפן שלך לא תומך בשירותי מיקום.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        if (cancelled) return;
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          // endpoint ייעודי ולא /tournaments: הרשימה הציבורית מסתירה בכוונה
          // טורנירים שכבר התחילו, וזה בדיוק מה שצריך להופיע כאן
          const res = await api.get('/tournaments/nearby');
          if (cancelled) return;
          const ranked = rankByDistance(res.data, origin);
          setResults(ranked);
          setIdx(0);
          setPhase(ranked.length ? 'ready' : 'empty');
        } catch {
          if (!cancelled) { setPhase('error'); setErrorMsg('לא הצלחנו לטעון את הטורנירים.'); }
        }
      },
      err => {
        if (cancelled) return;
        setPhase('denied');
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? 'כדי למצוא את הטורניר הקרוב אליך צריך לאשר גישה למיקום.'
            : 'לא הצלחנו לאתר את המיקום שלך.'
        );
      },
      GEO_OPTS
    );

    return () => { cancelled = true; };
  }, []);

  const current = results[idx];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nearby-modal-title"
      className="modal-overlay fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="modal-panel-h relative w-full sm:max-w-lg flex flex-col bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur border-b border-slate-700 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 id="nearby-modal-title" className="font-black text-white text-base leading-tight">
              📍 הכי קרוב אליך
            </h2>
            {phase === 'ready' && (
              <p className="text-slate-400 text-xs mt-0.5">
                הצעה {idx + 1} מתוך {results.length}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-slate-700 hover:bg-red-500/80 text-slate-300 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95 shadow-md"
            aria-label="סגור"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === 'locating' && <Centered>🛰️ מאתרים את המיקום שלך…</Centered>}

          {(phase === 'denied' || phase === 'error') && (
            <Centered>
              <p className="text-slate-300 mb-2">{errorMsg}</p>
              <p className="text-slate-500 text-sm">
                אפשר גם לסנן לפי עיר ברשימת הטורנירים.
              </p>
            </Centered>
          )}

          {phase === 'empty' && (
            <Centered>
              <p className="text-slate-300 mb-2">לא נמצאו טורנירים פעילים באזורך כרגע.</p>
              <p className="text-slate-500 text-sm">
                ההצעות כוללות טורנירים שמתחילים בשעות הקרובות, או שההרשמה המאוחרת אליהם עדיין פתוחה.
              </p>
            </Centered>
          )}

          {phase === 'ready' && current && (
            <Suggestion entry={current} onShowDetails={onShowDetails} />
          )}
        </div>

        {/* Footer */}
        {phase === 'ready' && current && (
          <div className="sticky bottom-0 shrink-0 bg-slate-800/95 backdrop-blur border-t border-slate-700 px-5 py-4 space-y-2">
            <NavButtons t={current.tournament} />
            <div className="flex gap-2">
              <button
                onClick={() => setIdx(i => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="flex-1 border border-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-xl text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:border-slate-400"
              >
                → הקודם
              </button>
              <button
                onClick={() => setIdx(i => Math.min(results.length - 1, i + 1))}
                disabled={idx >= results.length - 1}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                הצעה הבאה ←
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug text-center pt-1">
              המידע נאסף מהרשת או מהמועדון ואינו באחריותנו — מומלץ לאמת מול המועדון.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Centered({ children }) {
  return <div className="py-10 text-center text-slate-300">{children}</div>;
}

function Suggestion({ entry, onShowDetails }) {
  const { tournament: t, distanceKm } = entry;
  const prog = tournamentProgress(t);
  const closeTime = lateRegCloseTime(t);

  return (
    <div className="space-y-4">
      {/* Distance */}
      <div className="flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 font-black px-4 py-1.5 rounded-full text-sm">
          📍 {formatDistance(distanceKm)} ממך
        </span>
      </div>
      {distanceKm > FAR_AWAY_KM && (
        <p className="text-amber-400/80 text-xs text-center -mt-2">
          אין כרגע משהו ממש קרוב אליך — זו האפשרות הקרובה ביותר.
        </p>
      )}

      {/* Venue + name */}
      <div className="flex items-center gap-3">
        {t.venue_logo
          ? <img src={t.venue_logo} alt={t.venue_name} className="w-12 h-12 rounded-full object-contain bg-slate-800 ring-2 ring-slate-600 shrink-0" />
          : <span className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl shrink-0">🏠</span>}
        <div className="min-w-0">
          <h3 className="font-black text-white text-lg leading-tight">{t.name}</h3>
          <p className="text-poker-green-light font-semibold text-sm">
            {venueDisplayName(t.venue_name, t.venue_type, t.venue_club_number)}
          </p>
          {t.venue_address && <p className="text-slate-400 text-xs mt-0.5">📍 {t.venue_address}</p>}
        </div>
      </div>

      {/* Live status */}
      <LiveStatus prog={prog} closeTime={closeTime} />

      {/* Facts */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Fact label="כניסה" value={formatCost(t.cost)} />
        {t.gtd > 0 && <Fact label="מובטח" value={`₪${Number(t.gtd).toLocaleString('he-IL')}`} />}
        {t.starting_stack && <Fact label="סטאק התחלתי" value={Number(t.starting_stack).toLocaleString('he-IL')} />}
        {t.re_entry && <Fact label="Re-Entry" value={t.re_entry} />}
      </div>

      {/* Contact the venue about late registration */}
      {t.whatsapp_number && (
        <a
          href={buildLateRegContactLink(t.whatsapp_number, t.name)}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366]/15 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#4ade80] font-bold py-2.5 px-4 rounded-xl transition-all text-sm"
        >
          💬 לשאול את המועדון אם אפשר עוד להצטרף
        </a>
      )}

      {onShowDetails && (
        <button
          onClick={() => onShowDetails(t)}
          className="w-full text-slate-400 hover:text-blue-400 font-semibold py-1.5 text-sm transition-colors"
        >
          לכל פרטי הטורניר →
        </button>
      )}
    </div>
  );
}

function LiveStatus({ prog, closeTime }) {
  if (prog.status === 'before') {
    const h = Math.floor(prog.minutesToStart / 60);
    const m = prog.minutesToStart % 60;
    const inStr = h > 0 ? `בעוד ${h} שע׳ ${m} דק׳` : `בעוד ${m} דק׳`;
    return (
      <Box tone="blue">
        <span className="font-black">🕐 טרם התחיל</span>
        <span>מתחיל {inStr} — {formatTime(prog.start)}, {formatDate(prog.start)}</span>
      </Box>
    );
  }

  if (prog.status === 'running') {
    return (
      <Box tone="green">
        {prog.isBreak ? (
          <span className="font-black">☕ בהפסקה כרגע</span>
        ) : (
          <>
            <span className="font-black">▶️ רץ עכשיו — רמה {prog.level}</span>
            <span className="font-mono tabular-nums">
              בליינדים {Number(prog.smallBlind).toLocaleString()}/{Number(prog.bigBlind).toLocaleString()}
              {prog.ante > 0 && ` · אנטה ${Number(prog.ante).toLocaleString()}`}
            </span>
          </>
        )}
        <span className="text-xs opacity-80">נותרו ~{prog.minutesLeftInLevel} דק׳ לשלב הנוכחי</span>
        {closeTime && <span className="text-xs opacity-80">הרשמה מאוחרת עד {formatTime(closeTime)}</span>}
      </Box>
    );
  }

  return (
    <Box tone="slate">
      <span className="font-black">▶️ כנראה כבר התחיל</span>
      <span className="text-xs opacity-80">אין מבנה בליינדים מלא, אז אי אפשר לדעת באיזו רמה — שווה לשאול את המועדון.</span>
    </Box>
  );
}

function Box({ tone, children }) {
  const tones = {
    blue:  'bg-blue-500/10 border-blue-500/30 text-blue-200',
    green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
    slate: 'bg-slate-700/40 border-slate-600 text-slate-300',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-1 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-white font-bold">{value}</div>
    </div>
  );
}

function NavButtons({ t }) {
  const coords = tournamentCoords(t);
  const address = navAddress(t);
  const waze = wazeLink(coords, address);
  const gmaps = googleMapsLink(coords, address);
  if (!waze && !gmaps) return null;
  return (
    <div className="flex gap-2">
      <a
        href={waze}
        target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 min-h-[44px] bg-[#33ccff]/15 hover:bg-[#33ccff]/30 border border-[#33ccff]/40 text-[#7fdcff] font-bold py-2.5 px-3 rounded-xl transition-all text-sm"
      >
        🚗 Waze
      </a>
      <a
        href={gmaps}
        target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 min-h-[44px] bg-slate-700/60 hover:bg-slate-600 border border-slate-600 text-slate-200 font-bold py-2.5 px-3 rounded-xl transition-all text-sm"
      >
        🗺️ Google Maps
      </a>
    </div>
  );
}
