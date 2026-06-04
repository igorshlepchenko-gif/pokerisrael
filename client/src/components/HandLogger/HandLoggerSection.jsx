import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
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

export default function HandLoggerSection() {
  const { user } = useAuth();

  // הצג רק למי שיש אישור גישה (או אדמין)
  if (!user || (!user.hand_logger_access && user.role !== 'admin')) return null;
  const [wizardOpen, setWizardOpen] = useState(false);
  const [recentHands, setRecentHands] = useState([]);
  const [totalHands, setTotalHands] = useState(0);

  const fetchHands = async () => {
    if (!user) return;
    try {
      const res = await api.get('/hand-histories', { params: { limit: 3 } });
      setRecentHands(res.data.hands || []);
      setTotalHands(res.data.total || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchHands(); }, [user]);

  return (
    <>
      {wizardOpen && (
        <HandLoggerWizard
          onClose={() => setWizardOpen(false)}
          onSaved={() => { fetchHands(); }}
        />
      )}

      <section className="max-w-7xl mx-auto px-4 mb-10">
        <div className="rounded-3xl overflow-hidden border"
          style={{ background: 'linear-gradient(135deg, rgba(13,21,38,0.95) 0%, rgba(6,9,26,0.95) 100%)', borderColor: 'rgba(29,78,216,0.2)' }}>

          <div className="relative p-6 sm:p-8">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-[0.04] pointer-events-none"
              style={{ background: 'radial-gradient(circle, #1d4ed8, transparent)' }} />

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Text block */}
              <div className="flex-1" dir="rtl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl">🃏</div>
                  <h2 className="text-xl font-black text-white">רישום ידיים</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-300 border border-blue-500/30 bg-blue-500/10">חדש</span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed mb-3">
                  תעד ידיים שיחקת, קבל ניתוח מקצועי בעברית וצור סרטון לשיתוף — בכמה לחיצות בלבד.
                </p>
                {user ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    <button onClick={() => setWizardOpen(true)}
                      className="px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 0 20px rgba(29,78,216,0.4)' }}>
                      + רשום יד חדשה
                    </button>
                    {totalHands > 0 && (
                      <Link to="/hands"
                        className="text-sm text-blue-400 hover:text-blue-300 font-bold transition-colors underline-offset-2 hover:underline">
                        כל הידיים שלי ({totalHands}) →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Link to="/login"
                      className="px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 0 20px rgba(29,78,216,0.3)' }}>
                      התחבר לרישום ידיים
                    </Link>
                    <span className="text-xs text-slate-500">נדרשת התחברות</span>
                  </div>
                )}
              </div>

              {/* Feature highlights */}
              <div className="flex sm:flex-col gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                {[
                  { icon: '📝', text: 'נרטיב מקצועי' },
                  { icon: '🎬', text: 'סרטון לשיתוף'  },
                  { icon: '💬', text: 'שיתוף WhatsApp' },
                ].map(f => (
                  <div key={f.text}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-700/40 border border-slate-600/40 flex-shrink-0"
                    dir="rtl">
                    <span className="text-sm">{f.icon}</span>
                    <span className="text-xs text-slate-300 font-bold">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent hands preview */}
            {user && recentHands.length > 0 && (
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
