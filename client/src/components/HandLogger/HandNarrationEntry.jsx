/**
 * "ספר לי את היד" — free-text entry into the Hand Logger.
 *
 * Three screens, in the order that costs the player the least:
 *   1. write   — one textarea, nothing else
 *   2. gaps    — everything still missing, on ONE screen, answered by tapping
 *   3. review  — what we understood, editable, before it becomes a hand
 *
 * Deliberately not a chat. Fixture runs showed most hands need zero or one
 * answer, so a question-at-a-time loop would spend 2-4s of round trip per
 * question to ask things the player can answer with a thumb. The gap list comes
 * from the server's deterministic checker (services/narrationGaps.js), not from
 * the model, so it is the same every time.
 */

import { useState, useEffect, useRef } from 'react';
import CardPicker from './CardPicker';
import PositionSelector from './PositionSelector';
import api from '../../utils/api';
import { stageNarrationDraft } from '../../utils/narrationToDraft';
import { seatsFor } from '../../utils/pokerPositions';
import { startRecording, isRecordingSupported } from '../../utils/handAudioRecorder';

const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLORS = { s: 'text-slate-200', h: 'text-red-400', d: 'text-red-400', c: 'text-slate-200' };

const GAME_LABELS = {
  tournament: '🏆 טורניר לייב',
  cash: '💰 קאש לייב',
  tournament_online: '🖥️ טורניר אונליין',
  cash_online: '💻 קאש אונליין',
};

const RESULT_LABELS = {
  won: '🏆 ניצחתי',
  lost: '💀 הפסדתי',
  split: '🤝 חצי חצי',
  unknown: '🤔 נקודת החלטה',
};

const ACTION_LABELS = {
  fold: 'פולד', check: 'צ׳ק', limp: 'לימפ', call: 'קול',
  bet: 'הימור', 'three-bet': '3-בט', 'four-bet': '4-בט', allin: 'אול-אין',
};

const STREET_LABELS = { preflop: 'פרה-פלופ', flop: 'פלופ', turn: 'טרן', river: 'ריבר' };

const EXAMPLE = 'ישבתי בבאטן עם AK, ה-UTG פתח ל-300, אני 3בטתי ל-900 והוא קרא. ' +
  'פלופ בא A 7 2, הוא צ׳ק, הימרתי 1200 והוא קיפל.';

/**
 * Downscales before upload. A modern phone photo is 3-4000px and several MB;
 * the vision model gains nothing above ~1568px on the long edge, and the
 * smaller payload is the difference between a snappy read and a slow one on
 * table wifi. Falls back to the original file if anything here fails.
 */
const MAX_EDGE = 1568;

function downscaleImage(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 2 * 1024 * 1024) return resolve(file);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], 'hand.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function Card({ card }) {
  if (!card) return null;
  return (
    <span className={`font-bold ${SUIT_COLORS[card.suit] || 'text-slate-300'}`}>
      {card.rank}{SUIT_SYMBOLS[card.suit] || ''}
    </span>
  );
}

/** Tap-first control for one missing field. Kind comes from the server. */
function GapControl({ gap, value, onChange, playersCount }) {
  if (gap.kind === 'choice' || gap.kind === 'stakes') {
    return (
      <div className="flex flex-wrap gap-2">
        {gap.options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 min-h-[44px]
              ${value === o.value
                ? 'bg-blue-600 text-white ring-2 ring-blue-400/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {GAME_LABELS[o.value] || o.label}
          </button>
        ))}
      </div>
    );
  }

  if (gap.kind === 'position') {
    return (
      <PositionSelector
        selected={value || ''}
        onChange={onChange}
        playersCount={playersCount}
      />
    );
  }

  if (gap.kind === 'cards') {
    return (
      <CardPicker
        selected={value || gap.have || []}
        onChange={onChange}
        max={gap.count}
      />
    );
  }

  if (gap.kind === 'blinds') {
    const v = value || { sb: '', bb: '' };
    return (
      <div className="flex items-center gap-2" dir="ltr">
        <input
          type="number" inputMode="numeric" placeholder="SB" value={v.sb}
          onChange={e => onChange({ ...v, sb: e.target.value, bb: v.bb || String(+e.target.value * 2 || '') })}
          className="w-24 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-center min-h-[44px]"
        />
        <span className="text-slate-500 font-bold">/</span>
        <input
          type="number" inputMode="numeric" placeholder="BB" value={v.bb}
          onChange={e => onChange({ ...v, bb: e.target.value })}
          className="w-24 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-center min-h-[44px]"
        />
      </div>
    );
  }

  // 'actions' and anything else the server adds later: free text, re-parsed on
  // submit rather than guessed at in the client.
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      rows={2}
      dir="rtl"
      placeholder="לדוגמה: פתחתי ל-300, הוא קרא"
      className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm resize-none"
    />
  );
}

const ACTION_VALUES = ['fold', 'check', 'limp', 'call', 'bet', 'three-bet', 'four-bet', 'allin'];

/**
 * One action, editable in place. The parser gets the order right most of the
 * time but not always: a note reading "they check to me, I bet 5" came back
 * with the bet on the wrong player. Only the person who was there knows what
 * really happened, so the review card lets them say so. Actor and action are
 * closed lists; the amount is free text because sizes are.
 */
function ActionRow({ action, actors, onChange, onRemove }) {
  const cls = 'rounded-md border border-slate-700 bg-slate-900 text-slate-200 text-xs px-1.5 py-1 min-h-[32px]';
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800/60 px-1.5 py-1">
      <select className={cls} value={action.actor}
        onChange={e => onChange({ ...action, actor: e.target.value })}>
        {actors.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
      <select className={cls} value={action.action}
        onChange={e => onChange({ ...action, action: e.target.value })}>
        {ACTION_VALUES.map(v => <option key={v} value={v}>{ACTION_LABELS[v]}</option>)}
      </select>
      <input
        className={`${cls} w-16 text-center`} inputMode="numeric" placeholder="—"
        value={action.amount ?? ''}
        onChange={e => onChange({ ...action, amount: e.target.value || null })}
      />
      <button onClick={onRemove} aria-label="הסר פעולה"
        className="text-slate-600 hover:text-red-400 px-1 text-sm transition-colors">×</button>
    </span>
  );
}

/**
 * Inline correction on the review card. These are all closed choices, so a
 * change applies instantly instead of going back through the model — a dropdown
 * that takes three seconds to reflect a tap is worse than no dropdown.
 */
function FixSelect({ label, value, options, onChange, inferred }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-slate-400">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className={`rounded-lg border px-2 py-1 text-sm font-bold min-h-[36px] cursor-pointer
          bg-slate-900 hover:border-blue-500 transition-colors
          ${inferred ? 'border-amber-500/50 text-amber-300' : 'border-slate-600 text-slate-200'}`}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Compact, honest picture of what we understood — the last stop before saving. */
function ReviewCard({ state, contradictions, dropped, overrides, onOverride,
                     onEditAction, onApplyFix, busy }) {
  // Which street's actions are open for editing, if any.
  const [editing, setEditing] = useState(null);
  // What the card shows is the parse with the player's corrections laid over it.
  const val = (field) => (field in overrides ? overrides[field] : state[field]);
  // `state` is the ANALYZED state from the server, which keeps streets and
  // opponents at the top level. Only `wizardState` nests them under hand_data —
  // reading hand_data here silently rendered an empty hand.
  const streets = state.streets || {};
  const opponents = state.opponents || [];
  const inferred = new Set((state._inferred || []).map(i => i.field));
  const nameOf = (actor) => actor === 'hero' ? 'אני'
    : opponents.find(o => o.label === actor)?.label || actor;
  const actorOptions = [
    { value: 'hero', label: 'אני' },
    ...opponents.map(o => ({ value: o.label, label: o.label })),
  ];

  const blinds = state.blind_sb && state.blind_bb
    ? `${state.blind_sb}/${state.blind_bb}` : state.cash_stakes || '';

  return (
    <div className="space-y-3" dir="rtl">
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <FixSelect
            label="משחק:"
            value={val('game_type')}
            inferred={inferred.has('game_type') && !('game_type' in overrides)}
            onChange={v => onOverride('game_type', v)}
            options={Object.entries(GAME_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {blinds && <span className="text-slate-400">{blinds}</span>}
          <FixSelect
            label="עמדה:"
            value={val('hero_position')}
            onChange={v => onOverride('hero_position', v)}
            options={seatsFor(state.players_count).map(p => ({ value: p, label: p }))}
          />
          <span className="flex items-center gap-1">
            <span className="text-slate-400">קלפים:</span>
            {(state.hero_cards || []).map((c, i) => <Card key={i} card={c} />)}
          </span>
          <FixSelect
            label="תוצאה:"
            value={val('result')}
            inferred={inferred.has('result') && !('result' in overrides)}
            onChange={v => onOverride('result', v)}
            options={Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          כל שדה עם רשימה נפתחת ניתן לתיקון כאן. ערך <span className="text-amber-400/80">כתום</span> הושלם אוטומטית.
        </p>
      </div>

      {['preflop', 'flop', 'turn', 'river'].map(st => {
        const s = streets[st] || {};
        const acts = s.actions || [];
        const board = s.board || [];
        if (!acts.length && !board.length) return null;
        const isEditing = editing === st;
        return (
          <div key={st} className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-black text-blue-400">{STREET_LABELS[st]}</span>
              <span className="flex items-center gap-1.5">
                {board.map((c, i) => <Card key={i} card={c} />)}
              </span>
              <button
                onClick={() => setEditing(isEditing ? null : st)}
                className="mr-auto text-[11px] text-slate-500 hover:text-blue-400 transition-colors"
              >
                {isEditing ? 'סיום עריכה' : '✎ ערוך'}
              </button>
            </div>

            {isEditing ? (
              <div className="flex flex-wrap gap-1.5">
                {acts.map((a, i) => (
                  <ActionRow
                    key={i} action={a} actors={actorOptions}
                    onChange={v => onEditAction(st, i, v)}
                    onRemove={() => onEditAction(st, i, null)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                {acts.map((a, i) => (
                  <span key={i}>
                    <b className="text-slate-300">{nameOf(a.actor)}</b>{' '}
                    {ACTION_LABELS[a.action] || a.action}
                    {a.amount != null && <span className="text-amber-400/80"> {a.amount}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {contradictions.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="text-xs font-black text-amber-400 mb-2">⚠️ משהו לא מסתדר</div>
          <ul className="space-y-2">
            {contradictions.map((c, i) => (
              <li key={i} className="text-xs text-amber-200/90">
                <div>• {c.description}</div>
                {c.fix && (
                  <button
                    onClick={() => onApplyFix(c.fix)}
                    disabled={busy}
                    className="mt-1.5 mr-3 px-3 py-1.5 rounded-lg text-[11px] font-bold
                      bg-amber-500/20 text-amber-200 border border-amber-500/40
                      hover:bg-amber-500/30 transition-all disabled:opacity-40 min-h-[32px]"
                  >
                    ✓ {c.fix.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-200/60 mt-2 leading-relaxed">
            אפשר גם פשוט להמשיך — היד תישמר כפי שסיפרת אותה. או ללחוץ <b>✎ ערוך</b> על
            הרחוב ולתקן את הפעולות בעצמך.
          </p>
        </div>
      )}

      {(state._inferred || []).length > 0 && (
        <details className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
          <summary className="text-xs font-bold text-slate-400 cursor-pointer">
            {state._inferred.length} פרטים שהושלמו אוטומטית
          </summary>
          <ul className="mt-2 space-y-1">
            {state._inferred.map((f, i) => (
              <li key={i} className="text-[11px] text-slate-500">• {f.why}</li>
            ))}
          </ul>
        </details>
      )}

      {dropped.length > 0 && (
        <details className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <summary className="text-xs font-bold text-red-400/80 cursor-pointer">
            {dropped.length} פרטים שלא הצלחנו לקרוא
          </summary>
          <ul className="mt-2 space-y-1">
            {dropped.map((d, i) => <li key={i} className="text-[11px] text-red-300/70">• {d}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function HandNarrationEntry({ onClose, onHandOff }) {
  const [screen, setScreen] = useState('write'); // write | gaps | review // write | gaps | review
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  // Set once an image has been read, so the player knows the text in the box
  // came from a picture and is worth a second look before parsing.
  const [fromImage, setFromImage] = useState(false);
  // Set once a recording has been transcribed, so the player knows the text
  // in the box came from speech and is worth reading before parsing.
  const [fromVoice, setFromVoice] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const fileRef = useRef(null);
  const audioRef = useRef(null);
  const recorderRef = useRef(null);
  const [error, setError] = useState('');

  const [state, setState] = useState(null);
  // buildState()-shaped, returned by the server only once nothing required is missing.
  const [wizardState, setWizardState] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [contradictions, setContradictions] = useState([]);
  const [dropped, setDropped] = useState([]);
  const [answers, setAnswers] = useState({});
  // Corrections the player makes on the review card. Kept apart from `state` so
  // what the parser understood stays visible and a correction is never mistaken
  // for something the narration actually said.
  const [overrides, setOverrides] = useState({});

  const playersCount = state?.players_count || 6;

  // Same body-scroll lock HandLoggerWizard uses. "overflow: hidden" alone is
  // not enough on iOS Safari — the scroll escapes to the page behind and moves
  // the address bar — so the body is taken out of flow entirely and its
  // position restored on close. This app is used mostly on a phone at the table.
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const applyResponse = (data) => {
    setState(data.state);
    setWizardState(data.wizardState || null);
    setGaps(data.gaps || []);
    setContradictions(data.contradictions || []);
    setDropped(data.dropped || []);
    setAnswers({});
    setOverrides({});
    setScreen(data.ready ? 'review' : 'gaps');
  };


  // A visible timer, because a recording with no feedback is indistinguishable
  // from a broken button — and this runs on a phone at a noisy table.
  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // Closing mid-recording must release the microphone; otherwise the browser's
  // recording indicator stays lit and the site looks like it is listening.
  useEffect(() => () => recorderRef.current?.cancel(), []);

  const beginRecording = async () => {
    setError('');
    try {
      recorderRef.current = await startRecording();
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      recorderRef.current = null;
      setError(e?.message === 'unsupported'
        ? 'הדפדפן הזה לא תומך בהקלטה. אפשר לכתוב או להעלות תמונה.'
        : 'אין גישה למיקרופון. אשר את ההרשאה בדפדפן ונסה שוב.');
    }
  };

  /**
   * Sends audio for transcription. Shared by the in-page recorder and the file
   * picker — a recording made elsewhere (a phone voice memo, a WhatsApp voice
   * note) is the same thing to everything downstream.
   */
  const transcribeAudio = async (file) => {
    if (!file) return;
    setTranscribing(true);
    setError('');
    try {
      const form = new FormData();
      form.append('audio', file);
      const res = await api.post('/hand-narration/transcribe', form);
      // Appended rather than replacing: a player may have typed context first,
      // or recorded a second time to add something they forgot.
      setText(t => (t.trim() ? `${t.trim()}\n${res.data.text}` : res.data.text));
      setFromVoice(true);
    } catch (e) {
      setError(e?.response?.data?.message || 'לא הצלחנו לתמלל את ההקלטה.');
    } finally {
      setTranscribing(false);
      if (audioRef.current) audioRef.current.value = '';
    }
  };

  const finishRecording = async () => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (!rec) return;

    const file = await rec.stop();
    if (!file) { setError('לא נקלט אודיו. נסה שוב.'); return; }
    await transcribeAudio(file);
  };

  const cancelRecording = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
  };

  const readImage = async (file) => {
    if (!file) return;
    setReading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', await downscaleImage(file));
      const res = await api.post('/hand-narration/read-image', form);
      // Appended, not replaced — a player may have typed context the picture
      // doesn't show ("this was the bubble"), and losing it would be rude.
      setText(t => (t.trim() ? `${t.trim()}
${res.data.text}` : res.data.text));
      setFromImage(true);
    } catch (e) {
      setError(e?.response?.data?.message || 'לא הצלחנו לקרוא את התמונה.');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const parse = async (message, priorState = null, answers = null) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/hand-narration/parse', { message, priorState, answers });
      applyResponse(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'לא הצלחנו לנתח את היד. נסה שוב.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Gap answers go back through the parser as a plain sentence rather than
   * being merged client-side. It keeps one source of truth for how an answer
   * becomes state, and it means a free-text answer ("קיפלתי לרייז") is handled
   * the same as a tapped one.
   */
  const submitAnswers = () => {
    // Gaps marked `direct` are arithmetic, not language — sending "באלפים" back
    // through the model to be re-read would be a slower way to get a worse
    // answer. They travel as structured values instead.
    const direct = {};
    const parts = [];

    for (const g of gaps) {
      const v = answers[g.field];
      if (v == null || v === '') continue;
      if (g.direct) { direct[g.field] = v; continue; }
      if (g.kind === 'cards') {
        parts.push(`${g.label} ${v.map(c => `${c.rank}${c.suit}`).join(' ')}`);
      } else if (g.kind === 'blinds') {
        parts.push(`הבליינדים היו ${v.sb}/${v.bb}`);
      } else if (g.kind === 'choice') {
        parts.push(`${g.label} ${GAME_LABELS[v] || v}`);
      } else {
        parts.push(`${g.label} ${v}`);
      }
    }

    const hasDirect = Object.keys(direct).length > 0;
    if (!parts.length && !hasDirect) { setScreen('review'); return; }
    // An empty message would be rejected, so a direct-only answer re-sends the
    // original narration; the model returns the same reading and the answer is
    // applied on top of it.
    parse(parts.length ? parts.join('. ') : text.trim(), state, hasDirect ? direct : null);
  };

  /**
   * Re-validates an edited hand. Hits the deterministic checker only — no model
   * — so a correction gets its warnings back straight away instead of after a
   * parse round trip.
   */
  const recheck = async (nextState, fix = null) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/hand-narration/recheck', { state: nextState, fix });
      setState(res.data.state);
      setWizardState(res.data.wizardState || null);
      setContradictions(res.data.contradictions || []);
      setDropped(res.data.dropped || []);
      // Gaps can reappear if an edit removed something required.
      setGaps(res.data.gaps || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'לא הצלחנו לאמת את השינוי.');
    } finally {
      setBusy(false);
    }
  };

  /** A null `next` deletes the action. */
  const editAction = (street, index, next) => {
    const copy = JSON.parse(JSON.stringify(state));
    const acts = copy.streets?.[street]?.actions;
    if (!acts) return;
    if (next === null) acts.splice(index, 1);
    else acts[index] = next;
    recheck(copy);
  };

  const handOff = () => {
    if (!wizardState) { setError('היד עדיין לא שלמה — חזור והשלם את החסר.'); return; }
    // Review-card corrections are top-level in buildState's shape too, so they
    // lay straight over the wizard state on the way out.
    stageNarrationDraft({ ...wizardState, ...overrides });
    onHandOff();
  };

  const answered = gaps.filter(g => {
    const v = answers[g.field];
    if (v == null || v === '') return false;
    if (g.kind === 'cards') return v.length === g.count;
    if (g.kind === 'blinds') return v.sb && v.bb;
    return true;
  }).length;

  return (
    <div
      className="modal-overlay fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.8)' }}
    >
      <div
        className="always-dark rounded-2xl border border-slate-700 w-full max-w-2xl my-4"
        style={{ background: 'linear-gradient(135deg, rgba(13,21,38,0.99) 0%, rgba(6,9,26,0.99) 100%)' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">✍️</span>
            <h3 className="text-base font-black text-white">ספר לי את היד</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/25 text-purple-300 border border-purple-400/30">
              פיילוט
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {screen === 'write' && (
            <>
              <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                כתוב את מהלך היד בשפה שלך — עברית, אנגלית, קיצורים, איך שנוח.
                נשלים איתך רק את מה שבאמת חסר.
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={6}
                placeholder={EXAMPLE}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-700 text-white text-sm
                  leading-relaxed resize-none focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
              />
              {fromImage && (
                <p className="text-[11px] text-amber-300/80 mt-2 leading-relaxed">
                  📷 הטקסט נקרא מהתמונה. <b>בדוק במיוחד את הקלפים והצבעים</b> — בצילומי מסך
                  קטנים הסמלים זעירים והקריאה שלהם לא תמיד מדויקת.
                </p>
              )}
              {fromVoice && (
                <p className="text-[11px] text-amber-300/80 mt-2 leading-relaxed">
                  🎤 הטקסט תומלל מההקלטה. <b>עבור עליו לפני שממשיכים</b> — בחדר רועש
                  מספרים וקלפים מתחלפים בקלות.
                </p>
              )}

              {recording && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-black text-red-300 tabular-nums">
                    {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                    {String(seconds % 60).padStart(2, '0')}
                  </span>
                  <span className="text-xs text-red-200/70">מקליט — ספר את היד</span>
                  <button
                    onClick={finishRecording}
                    className="mr-auto px-4 py-2 rounded-xl text-xs font-black text-white
                      bg-red-600 hover:bg-red-500 transition-all min-h-[44px]"
                  >
                    ⏹ סיים
                  </button>
                  <button
                    onClick={cancelRecording}
                    className="text-xs text-red-200/60 hover:text-red-200 px-2 transition-colors"
                  >
                    בטל
                  </button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={e => readImage(e.target.files?.[0])}
              />

              <input
                ref={audioRef}
                type="file"
                // Deliberately broad: a voice memo can arrive as m4a from an
                // iPhone, opus from WhatsApp, or amr from an older Android, and
                // some of those carry an empty MIME type on Windows. The server
                // and Whisper decide what they can actually read.
                accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.webm,.amr,.aac"
                className="hidden"
                onChange={e => transcribeAudio(e.target.files?.[0])}
              />

              <div className="flex items-center justify-between mt-4 gap-3">
                <div className="flex items-center gap-3">
                  {isRecordingSupported() && !recording && (
                    <button
                      onClick={beginRecording}
                      disabled={transcribing || busy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white
                        transition-all disabled:opacity-40 min-h-[44px]"
                      style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
                    >
                      {transcribing ? '🎤 מתמלל…' : '🎤 הקלט'}
                    </button>
                  )}
                  <button
                    onClick={() => audioRef.current?.click()}
                    disabled={transcribing || busy || recording}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300
                      bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-40 min-h-[44px]"
                  >
                    {transcribing ? '🎧 מתמלל…' : '🎧 העלה הקלטה'}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={reading || busy || recording}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300
                      bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-40 min-h-[44px]"
                  >
                    {reading ? '📷 קורא…' : '📷 העלה תמונה'}
                  </button>
                  <button
                    onClick={() => setText(EXAMPLE)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    הראה לי דוגמה
                  </button>
                </div>
                <button
                  onClick={() => parse(text.trim())}
                  disabled={busy || reading || recording || transcribing || text.trim().length < 10}
                  className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all
                    hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 min-h-[44px]"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                >
                  {busy ? 'מנתח…' : 'נתח את היד ←'}
                </button>
              </div>
            </>
          )}

          {screen === 'gaps' && (
            <>
              <p className="text-sm text-slate-400 mb-4">
                כמעט שם — חסרים {gaps.length} פרטים:
              </p>
              <div className="space-y-5">
                {gaps.map(gap => (
                  <div key={gap.field}>
                    <div className="text-sm font-bold text-slate-200 mb-2">{gap.label}</div>
                    <GapControl
                      gap={gap}
                      value={answers[gap.field]}
                      onChange={v => setAnswers(a => ({ ...a, [gap.field]: v }))}
                      playersCount={playersCount}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setScreen('write')}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  → חזרה לטקסט
                </button>
                <button
                  onClick={submitAnswers}
                  disabled={busy}
                  className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all
                    hover:scale-105 active:scale-95 disabled:opacity-40 min-h-[44px]"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                >
                  {busy ? 'מעדכן…' : answered === gaps.length ? 'המשך ←' : `המשך בלי להשלים (${answered}/${gaps.length})`}
                </button>
              </div>
            </>
          )}

          {screen === 'review' && state && (
            <>
              <p className="text-sm text-slate-400 mb-3">זה מה שהבנתי — תקן מה שצריך לפני שנשמור.</p>
              <ReviewCard
                state={state}
                contradictions={contradictions}
                dropped={dropped}
                overrides={overrides}
                busy={busy}
                onOverride={(field, value) => setOverrides(o => ({ ...o, [field]: value }))}
                onEditAction={editAction}
                onApplyFix={fix => recheck(state, fix)}
              />
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setScreen('write')}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  → תקן את הטקסט
                </button>
                <button
                  onClick={handOff}
                  className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all
                    hover:scale-105 active:scale-95 min-h-[44px]"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                >
                  פתח באשף ושמור ←
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
