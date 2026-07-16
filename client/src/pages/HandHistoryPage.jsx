import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import HandVideoCanvas from '../components/HandLogger/HandVideoCanvas';

const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLORS  = { s: '#e2e8f0', h: '#f87171', d: '#f87171', c: '#e2e8f0' };

function CardDisplay({ card }) {
  if (!card) return null;
  return (
    <span style={{ color: SUIT_COLORS[card.suit] }} className="font-bold text-sm">
      {card.rank}{SUIT_SYMBOLS[card.suit]}
    </span>
  );
}

function HandCard({ hand, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cards = hand.hero_cards || [];
  const resultColor = hand.result === 'won' ? 'border-l-emerald-500' : hand.result === 'lost' ? 'border-l-red-500' : 'border-l-amber-500';
  const resultIcon  = hand.result === 'won' ? '🏆' : hand.result === 'lost' ? '💀' : '🤝';
  const isTournament = hand.game_type === 'tournament' || hand.game_type === 'tournament_online';
  const isOnline = hand.game_type === 'tournament_online' || hand.game_type === 'cash_online';
  const typeLabel = isTournament
    ? `${isOnline ? '💻' : '🏆'} טורניר${isOnline ? ' אונליין' : ''}${hand.tournament_stage ? ' · ' + hand.tournament_stage : ''}`
    : `${isOnline ? '🖥️' : '💰'} קאש${isOnline ? ' אונליין' : ''} ${hand.cash_stakes || ''}${hand.cash_stakes ? '₪' : ''}`;

  const contextLine = isTournament
    ? hand.blind_sb && hand.blind_bb ? `${hand.blind_sb}/${hand.blind_bb} BB` : ''
    : '';

  const handleDelete = async () => {
    if (!confirm('למחוק יד זו?')) return;
    setDeleting(true);
    try {
      await api.delete(`/hand-histories/${hand.id}`);
      onDelete(hand.id);
    } catch { alert('שגיאה במחיקה'); } finally { setDeleting(false); }
  };

  return (
    <div className={`card border-l-4 ${resultColor} p-4 hover:border-blue-500/30 transition-all cursor-pointer`}
      onClick={() => setExpanded(e => !e)} dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{resultIcon}</span>
            <div className="flex items-center gap-1">
              {cards.map((c, i) => <CardDisplay key={i} card={c} />)}
            </div>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400 font-bold">{hand.hero_position}</span>
            {hand.hero_profit !== null && hand.hero_profit !== undefined && (
              <span className={`text-xs font-bold ${hand.result === 'won' ? 'text-emerald-400' : hand.result === 'lost' ? 'text-red-400' : 'text-amber-400'}`}>
                {hand.result === 'won' ? '+' : ''}{hand.hero_profit}
                {isTournament ? 'BB' : '₪'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-500">{typeLabel}</span>
            {contextLine && <span className="text-xs text-slate-600">· {contextLine}</span>}
          </div>
          {hand.narrative && !expanded && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{hand.narrative}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[11px] text-slate-600">
            {new Date(hand.created_at).toLocaleDateString('he-IL')}
          </span>
          <button onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting}
            className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors px-1 py-0.5 rounded hover:bg-red-500/10">
            {deleting ? '...' : 'מחק'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(29,78,216,0.1)' }}>
          {hand.narrative && (
            <p className="text-sm text-slate-300 leading-relaxed mb-3 bg-slate-900/40 rounded-xl p-3 font-mono text-right">
              {hand.narrative}
            </p>
          )}
          {hand.notes && (
            <div className="text-xs text-slate-500 bg-slate-800/40 rounded-xl p-2 text-right">
              <span className="font-bold text-slate-400">הערות: </span>{hand.notes}
            </div>
          )}
          <div className="flex gap-3 mt-2 text-xs text-slate-600">
            {hand.players_count && <span>{hand.players_count} שחקנים</span>}
            {hand.hero_stack && <span>ערימה: {hand.hero_stack}{hand.game_type === 'tournament' ? 'BB' : '₪'}</span>}
          </div>
          <div className="mt-3" onClick={e => e.stopPropagation()}>
            <HandVideoCanvas handState={hand} narrative={hand.narrative} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function HandHistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hands, setHands] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 15;

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading]);

  const fetchHands = async (off = 0) => {
    setPageLoading(true);
    try {
      const res = await api.get('/hand-histories', { params: { limit: LIMIT, offset: off } });
      setHands(res.data.hands || []);
      setTotal(res.data.total || 0);
      setOffset(off);
    } catch { /* ignore */ } finally { setPageLoading(false); }
  };

  useEffect(() => { if (user) fetchHands(); }, [user]);

  const deleteHand = (id) => setHands(prev => { const n = prev.filter(h => h.id !== id); setTotal(t => t - 1); return n; });

  if (loading || !user) return null;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6" dir="rtl">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              🃏 הידיים שלי
            </h1>
            {total > 0 && <p className="text-sm text-slate-400 mt-0.5">{total} ידיים רשומות</p>}
          </div>
          <button onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl border border-slate-600 text-slate-400 text-sm font-bold hover:border-blue-500/50 hover:text-slate-200 transition-all">
            ← חזור
          </button>
        </div>

        {/* Hands list */}
        {pageLoading ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3 animate-pulse">🂡</div>
            <div>טוען ידיים...</div>
          </div>
        ) : hands.length === 0 ? (
          <div className="text-center py-16" dir="rtl">
            <div className="text-5xl mb-4">🃏</div>
            <h2 className="text-lg font-bold text-slate-300 mb-2">עדיין אין ידיים מתועדות</h2>
            <p className="text-slate-500 text-sm mb-6">רשום את הידיים שלך מהעמוד הראשי</p>
            <button onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              → עמוד ראשי
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {hands.map(h => <HandCard key={h.id} hand={h} onDelete={deleteHand} />)}
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={() => fetchHands(Math.max(0, offset - LIMIT))} disabled={offset === 0}
              className="px-4 py-2 rounded-xl border border-slate-600 text-slate-400 text-sm disabled:opacity-40 hover:border-slate-500 transition-all">
              ← הקודמים
            </button>
            <span className="px-4 py-2 text-slate-500 text-sm">
              {offset + 1}–{Math.min(offset + LIMIT, total)} מתוך {total}
            </span>
            <button onClick={() => fetchHands(offset + LIMIT)} disabled={offset + LIMIT >= total}
              className="px-4 py-2 rounded-xl border border-slate-600 text-slate-400 text-sm disabled:opacity-40 hover:border-slate-500 transition-all">
              הבאים →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
