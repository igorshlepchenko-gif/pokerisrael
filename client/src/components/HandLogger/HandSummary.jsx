import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import HandVideoCanvas from './HandVideoCanvas';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const MAX_SAVED_HANDS = 20;

function buildWhatsAppText(narrative) {
  const text = `🃏 Hand History via PokerIsrael.org\n\n${narrative}\n\nPokerIsrael.org 🂡`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export default function HandSummary({ handState, narrative, onSaveSuccess, onReset }) {
  const { user } = useAuth();
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [handCount, setHandCount] = useState(null); // null = טוען
  const [limitErr, setLimitErr]   = useState('');

  // טוען כמות ידיים קיימות (רק למחוברים)
  useEffect(() => {
    if (!user) return;
    api.get('/hand-histories', { params: { limit: 1 } })
      .then(res => setHandCount(res.data.total ?? 0))
      .catch(() => setHandCount(0));
  }, [user]);

  const copyNarrative = () => {
    navigator.clipboard.writeText(narrative).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  };

  const saveHand = async () => {
    setSaving(true);
    setLimitErr('');
    try {
      const payload = {
        game_type:        handState.game_type,
        tournament_stage: handState.tournament_stage,
        blind_sb:         handState.blind_sb,
        blind_bb:         handState.blind_bb,
        ante:             handState.ante,
        cash_stakes:      handState.cash_stakes,
        players_count:    handState.players_count || 2,
        hero_position:    handState.hero_position,
        hero_stack:       handState.hero_stack,
        hero_cards:       handState.hero_cards,
        hand_data:        handState.hand_data,
        result:           handState.result,
        hero_profit:      handState.hero_profit,
        narrative,
        notes:            handState.notes,
      };
      await api.post('/hand-histories', payload);
      setSaved(true);
      setHandCount(c => (c ?? 0) + 1);
      onSaveSuccess?.();
    } catch (e) {
      const msg = e?.response?.data?.message || '';
      if (e?.response?.status === 403) {
        setLimitErr(msg || `הגעת למגבלת ${MAX_SAVED_HANDS} ידיים שמורות`);
      } else {
        alert('שגיאה בשמירת היד');
      }
    } finally {
      setSaving(false);
    }
  };

  const resultColor = handState.result === 'won'
    ? 'text-emerald-400' : handState.result === 'lost' ? 'text-red-400' : 'text-amber-400';
  const resultLabel = handState.result === 'won' ? '🏆 ניצחון'
    : handState.result === 'lost' ? '💀 הפסד' : '🤝 סיר מחולק';

  const atLimit = user && handCount !== null && handCount >= MAX_SAVED_HANDS;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Result badge */}
      <div className={`text-center text-2xl font-black ${resultColor}`}>{resultLabel}</div>

      {/* Narrative — זמין לכולם */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={copyNarrative}
            className="text-xs text-slate-500 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-blue-500/10">
            {copyDone ? '✅ הועתק' : '📋 העתק'}
          </button>
          <h3 className="text-sm font-bold text-slate-300">📝 רישום מקצועי</h3>
        </div>
        <p className="text-slate-200 text-sm leading-relaxed text-right font-mono bg-slate-900/50 rounded-xl p-3 max-h-40 overflow-y-auto">
          {narrative}
        </p>
      </div>

      {/* WhatsApp טקסט — זמין לכולם */}
      <a href={buildWhatsAppText(narrative)} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/10 transition-all">
        <span className="text-lg">💬</span>
        שתף ב-WhatsApp (טקסט)
      </a>

      {/* וידאו — זמין לכולם */}
      <HandVideoCanvas handState={handState} narrative={narrative} />

      {/* ────── אזור שמירה ────── */}
      {!user ? (
        /* לא מחובר — עידוד הרשמה */
        <div className="rounded-2xl border border-slate-600/50 bg-slate-800/40 p-4 text-center space-y-3">
          <p className="text-slate-300 text-sm font-bold">🔒 שמירת ידיים למשתמשים רשומים בלבד</p>
          <p className="text-slate-500 text-xs leading-relaxed">
            הצטרף בחינם וקבל עד {MAX_SAVED_HANDS} ידיים שמורות.<br />
            ניתן להעתיק את הנרטיב או לשתף סרטון ללא הרשמה.
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/register"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-all">
              הצטרף בחינם
            </Link>
            <Link to="/login"
              className="px-5 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:border-blue-500/50 transition-all">
              כניסה
            </Link>
          </div>
        </div>
      ) : atLimit ? (
        /* מחובר — הגיע למגבלה */
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-2">
          <p className="text-amber-300 text-sm font-bold">
            🗂️ הגעת למגבלת {MAX_SAVED_HANDS} ידיים שמורות
          </p>
          <p className="text-slate-500 text-xs">מחק ידיים ישנות כדי לפנות מקום</p>
          <Link to="/hands"
            className="inline-block px-4 py-2 rounded-xl border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-500/10 transition-all">
            נהל ידיים שמורות →
          </Link>
        </div>
      ) : saved ? (
        /* נשמר בהצלחה */
        <div className="flex-1 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm text-center">
          ✅ היד נשמרה! ({handCount}/{MAX_SAVED_HANDS})
        </div>
      ) : (
        /* מחובר + יש מקום — כפתור שמירה */
        <div className="space-y-1.5">
          {limitErr && (
            <p className="text-red-400 text-xs text-center">{limitErr}</p>
          )}
          <div className="flex gap-2">
            <button onClick={saveHand} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 transition-all">
              {saving ? 'שומר...' : `💾 שמור יד (${handCount ?? '…'}/${MAX_SAVED_HANDS})`}
            </button>
            <button onClick={onReset}
              className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm font-bold hover:border-slate-500 hover:text-slate-200 transition-all">
              יד חדשה
            </button>
          </div>
        </div>
      )}

      {/* כפתור יד חדשה תמיד זמין (לא-מחובר / גבול / נשמר) */}
      {(!user || atLimit || saved) && (
        <button onClick={onReset}
          className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-500 text-sm font-bold hover:border-slate-500 hover:text-slate-300 transition-all">
          + יד חדשה
        </button>
      )}
    </div>
  );
}
