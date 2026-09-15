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

// editingHandId: set when this is a saved hand opened for editing. The player
// then chooses: update that hand in place, or save the edited version as a new
// hand and keep the original (the hand limit applies only to the second).
export default function HandSummary({ handState, narrative, onSaveSuccess, onReset, editingHandId = null }) {
  const { user } = useAuth();
  const [saving, setSaving]     = useState(null);  // null | 'update' | 'new'
  const [saved, setSaved]       = useState(null);  // null | 'update' | 'new'
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

  // mode 'update' = overwrite the hand being edited; 'new' = add a hand
  const saveHand = async (mode) => {
    setSaving(mode);
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
      if (mode === 'update' && editingHandId) {
        await api.put(`/hand-histories/${editingHandId}`, payload);
      } else {
        await api.post('/hand-histories', payload);
        setHandCount(c => (c ?? 0) + 1);
      }
      setSaved(mode);
      onSaveSuccess?.();
    } catch (e) {
      // Shown inline with the server's reason — a bare "error saving" alert
      // left no way to tell a lost session from a limit from a deleted hand.
      // (A 401 also triggers the global redirect to login in utils/api.js.)
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || '';
      if (status === 403) {
        setLimitErr(msg || `הגעת למגבלת ${MAX_SAVED_HANDS} ידיים שמורות`);
      } else if (mode === 'update' && status === 404) {
        setLimitErr('היד המקורית כבר לא קיימת (אולי נמחקה) — אפשר לשמור כיד חדשה');
      } else {
        setLimitErr(`שגיאה בשמירת היד${msg ? `: ${msg}` : status ? ` (${status})` : ' — בדוק את החיבור ונסה שוב'}`);
      }
    } finally {
      setSaving(null);
    }
  };

  const resultColor = handState.result === 'won' ? 'text-emerald-400'
    : handState.result === 'lost' ? 'text-red-400'
    : handState.result === 'unknown' ? 'text-blue-400'
    : 'text-amber-400';
  const resultLabel = handState.result === 'won' ? '🏆 ניצחון'
    : handState.result === 'lost' ? '💀 הפסד'
    : handState.result === 'unknown' ? '🤔 מה היית עושה?'
    : '🤝 קופה מחולקת';

  const limitReached = !!user && handCount !== null && handCount >= MAX_SAVED_HANDS;
  // When editing, updating in place is always possible — the limit only blocks
  // the "save as a new hand" option, not the whole save area.
  const atLimit = !editingHandId && limitReached;

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
          {saved === 'update'
            ? '✅ היד המקורית עודכנה!'
            : editingHandId
              ? `✅ נשמרה כיד חדשה — המקורית נשארה (${handCount}/${MAX_SAVED_HANDS})`
              : `✅ היד נשמרה! (${handCount}/${MAX_SAVED_HANDS})`}
        </div>
      ) : editingHandId ? (
        /* עריכת יד שמורה — לעדכן במקום, או לשמור כיד חדשה ולהשאיר את המקורית */
        <div className="space-y-1.5">
          {limitErr && (
            <p className="text-red-400 text-xs text-center">{limitErr}</p>
          )}
          <p className="text-slate-400 text-xs text-center">איך לשמור את היד הערוכה?</p>
          <div className="flex gap-2">
            <button onClick={() => saveHand('update')} disabled={!!saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 transition-all">
              {saving === 'update' ? 'מעדכן...' : '💾 עדכן את היד הקיימת'}
            </button>
            <button onClick={() => saveHand('new')} disabled={!!saving || limitReached}
              title={limitReached ? `הגעת למגבלת ${MAX_SAVED_HANDS} ידיים שמורות` : undefined}
              className="flex-1 py-2.5 rounded-xl border border-blue-500/50 text-blue-300 font-bold text-sm hover:bg-blue-500/10 disabled:opacity-40 transition-all">
              {saving === 'new' ? 'שומר...' : `➕ שמור כיד חדשה (${handCount ?? '…'}/${MAX_SAVED_HANDS})`}
            </button>
          </div>
          {limitReached && (
            <p className="text-amber-400/80 text-[11px] text-center">
              הגעת למגבלת {MAX_SAVED_HANDS} ידיים — אפשר לעדכן את היד הקיימת, או למחוק יד ישנה כדי לשמור כחדשה
            </p>
          )}
          <button onClick={onReset}
            className="w-full py-2 rounded-xl border border-slate-700 text-slate-500 text-xs font-bold hover:border-slate-500 hover:text-slate-300 transition-all">
            יד חדשה
          </button>
        </div>
      ) : (
        /* מחובר + יש מקום — כפתור שמירה */
        <div className="space-y-1.5">
          {limitErr && (
            <p className="text-red-400 text-xs text-center">{limitErr}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => saveHand('new')} disabled={!!saving}
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
