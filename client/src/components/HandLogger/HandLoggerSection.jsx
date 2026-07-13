import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import HandLoggerWizard from './HandLoggerWizard';
import api from '../../utils/api';

const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLORS  = { s: 'text-slate-200', h: 'text-red-400', d: 'text-red-400', c: 'text-slate-200' };

function MiniCard({ card }) {
  if (!card) return null;
  return (
    <span className={`font-bold text-sm ${SUIT_COLORS[card.suit]}`}>
      {card.rank}{SUIT_SYMBOLS[card.suit]}
    </span>
  );
}

function HandPreview({ hand }) {
  const cards = hand.hero_cards || [];
  const resultColor = hand.result === 'won' ? 'text-emerald-400' : hand.result === 'lost' ? 'text-red-400' : 'text-amber-400';
  const resultIcon  = hand.result === 'won' ? '🏆' : hand.result === 'lost' ? '💀' : '🤝';
  const typeLabel   = hand.game_type === 'tournament' ? '🏆 טורניר' : '💰 קאש';

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 hover:border-blue-500/30 transition-all">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-sm font-black ${resultColor}`}>{resultIcon}</span>
        <div className="flex items-center gap-1.5">
          {cards.map((c, i) => <MiniCard key={i} card={c} />)}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-600">
          {new Date(hand.created_at).toLocaleDateString('he-IL')}
        </span>
        <span className="text-[11px] text-slate-400">{typeLabel} · {hand.hero_position}</span>
      </div>
      {hand.narrative && (
        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 text-right leading-relaxed">
          {hand.narrative}
        </p>
      )}
    </div>
  );
}

function PokerWinIllustration() {
  return (
    <div className="flex-shrink-0 w-32 sm:w-40 self-center sm:self-auto">
      <svg viewBox="0 0 200 220" className="w-full h-auto" role="img">
        <title>שחקן פוקר חוגג אחרי שמירת היד</title>
        <desc>דמות נשענת לאחור באגרוף ניצחון, מחזיקה טלפון עם אישור שמירה, קונפטי עולה</desc>
        <defs>
          <linearGradient id="handLoggerBodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a5da0" />
            <stop offset="100%" stopColor="#1a2e5e" />
          </linearGradient>
        </defs>
        <g transform="rotate(-5 100 140)">
          <g className="animate-float-y">
            <ellipse cx="100" cy="213" rx="72" ry="6" fill="#000" opacity="0.25" />
            <path d="M70 100 Q100 90 130 100 L145 202 Q100 217 55 202 Z" fill="url(#handLoggerBodyGrad)" />
            <path d="M62 100 Q100 80 138 100 L138 113 Q100 94 62 113 Z" fill="#1c3468" />
            <circle cx="100" cy="70" r="24" fill="url(#handLoggerBodyGrad)" />
            <rect x="82" y="66" width="16" height="10" rx="4" fill="#0a1830" stroke="#4ade80" strokeWidth="1.5" />
            <rect x="102" y="66" width="16" height="10" rx="4" fill="#0a1830" stroke="#4ade80" strokeWidth="1.5" />
            <line x1="98" y1="70" x2="102" y2="70" stroke="#4ade80" strokeWidth="1.5" />
            <path d="M78 90 Q100 98 122 90" stroke="#16294f" strokeWidth="2" fill="none" opacity="0.6" />
            <path d="M132 100 Q150 78 148 52" stroke="url(#handLoggerBodyGrad)" strokeWidth="16" strokeLinecap="round" fill="none" />
            <circle cx="147" cy="48" r="10" fill="#33538e" />
            <path d="M68 106 Q46 122 42 156" stroke="url(#handLoggerBodyGrad)" strokeWidth="16" strokeLinecap="round" fill="none" />
            <circle cx="42" cy="157" r="9" fill="#33538e" />
            <rect x="24" y="150" width="34" height="48" rx="6" fill="#0a1830" stroke="#4ade80" strokeWidth="1.5" />
            <g className="animate-pulse">
              <circle cx="55" cy="152" r="7" fill="#22c55e" />
              <path d="M52 152 L54.5 154.5 L59 149" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <path className="animate-rise" d="M150 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#4ade80" />
            <path className="animate-rise" style={{ animationDelay: '0.5s' }} d="M168 45 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" fill="#f5b942" />
            <path className="animate-rise" style={{ animationDelay: '0.9s' }} d="M130 25 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" fill="#3b82f6" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function NoAccessModal({ user, onClose }) {
  const waPhone = '972545861119';
  const waText  = encodeURIComponent(`שלום, שמי ${user?.name || ''} ואני מעוניין להשתמש בכלי רישום הידיים שלכם`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="always-dark rounded-2xl border border-slate-700 p-6 max-w-md w-full"
        style={{ background: 'linear-gradient(135deg, rgba(13,21,38,0.98) 0%, rgba(6,9,26,0.98) 100%)' }}
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔒</span>
          <h3 className="text-lg font-black text-white">גישה מוגבלת</h3>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          חבר יקר, אין לך הרשאה לכלי רישום הידיים. כלי זה נמצא כרגע בתהליך בניה ושיפורים ולכן אינו פתוח לקהל הרחב. לבקשת גישה נא לפנות להנהלת האתר.
        </p>
        <div className="flex gap-3">
          <a
            href={`https://wa.me/${waPhone}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white text-center transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', boxShadow: '0 0 16px rgba(34,197,94,0.3)' }}
          >
            💬 פנייה בוואטסאפ
          </a>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HandLoggerSection() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [wizardOpen,   setWizardOpen]   = useState(false);
  const [noAccessOpen, setNoAccessOpen] = useState(false);
  const [recentHands,  setRecentHands]  = useState([]);
  const [totalHands,   setTotalHands]   = useState(0);

  const hasAccess = user && (user.hand_logger_access || user.role === 'admin');

  const handleRegisterClick = () => {
    if (!user) {
      navigate('/login');
    } else if (!hasAccess) {
      setNoAccessOpen(true);
    } else {
      setWizardOpen(true);
    }
  };

  const fetchHands = async () => {
    if (!hasAccess) return;
    try {
      const res = await api.get('/hand-histories', { params: { limit: 3 } });
      setRecentHands(res.data.hands || []);
      setTotalHands(res.data.total || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchHands(); }, [user]);

  return (
    <>
      {noAccessOpen && <NoAccessModal user={user} onClose={() => setNoAccessOpen(false)} />}

      {wizardOpen && (
        <HandLoggerWizard
          onClose={() => setWizardOpen(false)}
          onSaved={() => { fetchHands(); }}
        />
      )}

      <section className="max-w-7xl mx-auto px-4 mb-10">
        <div className="always-dark rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0f1e42 0%, #1a2e6e 40%, #0d3366 100%)',
            boxShadow: '0 8px 40px rgba(29,78,216,0.45), 0 0 0 1px rgba(59,130,246,0.2)',
          }}>

          <div className="relative p-6 sm:p-8">
            {/* Animated glow orbs */}
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 animate-pulse pointer-events-none"
              style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-15 animate-pulse pointer-events-none"
              style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', animationDelay: '1s' }} />

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Text block */}
              <div className="flex-1" dir="rtl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl">🃏</div>
                  <h2 className="text-xl font-black text-white">רישום ידיים מקצועי</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/30 text-blue-300 border border-blue-400/30">BETA</span>
                </div>
                <p
                  className="text-base font-semibold leading-relaxed mb-3 animate-gradient-text"
                  style={{
                    background: 'linear-gradient(90deg, #93c5fd, #22d3ee, #f59e0b, #93c5fd)',
                    backgroundSize: '300% auto',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  תעדו ידיים, קבלו ניתוח מקצועי וצורו סרטונים לשיתוף בכמה לחיצות בלבד.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <button
                    onClick={handleRegisterClick}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 16px rgba(59,130,246,0.5)' }}
                  >
                    <span>+ רשום יד</span><span className="text-lg">←</span>
                  </button>
                  {hasAccess && totalHands > 0 && (
                    <Link to="/hands"
                      className="text-sm text-blue-300 hover:text-white font-bold transition-colors underline-offset-2 hover:underline">
                      כל הידיים שלי ({totalHands}) →
                    </Link>
                  )}
                </div>
              </div>

              {/* Illustration */}
              <PokerWinIllustration />
            </div>

            {/* Recent hands preview */}
            {hasAccess && recentHands.length > 0 && (
              <div className="mt-6 pt-5 border-t" style={{ borderColor: 'rgba(29,78,216,0.12)' }} dir="rtl">
                <div className="flex items-center justify-between mb-3">
                  <Link to="/hands" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    כל הידיים →
                  </Link>
                  <span className="text-xs font-bold text-slate-400">ידיים אחרונות</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recentHands.map(h => <HandPreview key={h.id} hand={h} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
