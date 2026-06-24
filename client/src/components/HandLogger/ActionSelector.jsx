import { useState, useEffect } from 'react';

const ACTIONS = [
  { key: 'fold',   label: 'פולד',    color: 'text-red-400   border-red-500/40   hover:bg-red-500/10'  },
  { key: 'check',  label: "צ'ק",    color: 'text-slate-300 border-slate-500/40 hover:bg-slate-700'   },
  { key: 'limp',   label: 'לימפ',    color: 'text-slate-300 border-slate-500/40 hover:bg-slate-700'   },
  { key: 'call',   label: 'קול',     color: 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10' },
  { key: 'raise',  label: '',        color: 'text-blue-400  border-blue-500/40  hover:bg-blue-500/10'  },
  { key: 'allin',  label: 'אול-אין', color: 'text-amber-400 border-amber-500/40 hover:bg-amber-500/10' },
];

// לאחר הסרת 3bet/4bet מה-UI — הסוג נקבע דינמית לפי כמות הרייזים שכבר היו
const NEEDS_AMOUNT = ['bet', 'three-bet', 'four-bet'];

function getSizePresets(unit, street) {
  if (unit === 'BB') {
    if (street === 'preflop') return ['2', '2.5', '3', '4', '6', '10'];
    return ['25%', '33%', '50%', '66%', '75%', '100%'];
  }
  return ['10', '20', '30', '50', '100', '200'];
}

function formatPreset(val, unit, blindBb) {
  if (!val || val === 'שיפ') return { main: 'שיפ', bb: null };
  if (val.endsWith('%')) return { main: val, bb: null };
  const num = parseFloat(val);
  if (isNaN(num)) return { main: val, bb: null };
  if (unit === 'BB') {
    const chips = blindBb ? Math.round(num * blindBb).toLocaleString('he-IL') : val;
    return { main: chips, bb: `${num}BB` };
  } else {
    const bbs = blindBb && blindBb > 0 ? Number((num / blindBb).toFixed(1)).toString() : null;
    return { main: `₪${num}`, bb: bbs ? `${bbs}BB` : null };
  }
}

function bbHint(amount, blindBb) {
  if (!amount || !blindBb || blindBb <= 0) return null;
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return null;
  const bbs = Number((num / blindBb).toFixed(1));
  return `= ${bbs}BB`;
}

// מחשב מינימום הימור חוקי לפי גודל ההפרש (דלתא) בין ההימורים
function computeMinBet(priorActions, sb, bb, street) {
  if (!bb) return 0;
  const raises = priorActions
    .filter(a => ['bet', 'raise', 'three-bet', 'four-bet'].includes(a.action) && a.amount)
    .map(a => parseFloat(a.amount))
    .filter(n => !isNaN(n) && n > 0);

  if (raises.length === 0) {
    // first open: preflop min = 2×BB (TDA), post-flop min = 1 BB
    return street === 'preflop' ? 2 * bb : bb;
  }

  const last = raises[raises.length - 1];
  const prev = raises.length >= 2 ? raises[raises.length - 2]
    : (street === 'preflop' ? bb : 0);
  const delta = last - prev;
  return last + delta;
}

const ACTION_LABELS = {
  fold: 'פולד', check: "צ'ק", limp: 'לימפ', call: 'קול',
  bet: 'BET', 'three-bet': '3BET', 'four-bet': '4BET', allin: 'אול-אין',
};

export default function ActionSelector({
  actor, label, unit = 'BB', street = 'preflop',
  onAction, onUndo, priorActions = [], blindBb = null, blindSb = null, actorPosted = 0,
  playerStack = null,
}) {
  const [chosen, setChosen] = useState(null);
  const [amount, setAmount] = useState('');
  const [amountMode, setAmountMode] = useState('number');
  const [done, setDone] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  useEffect(() => {
    if (priorActions.length === 0) return;
    const last = priorActions[priorActions.length - 1];
    if (last && last.actor !== actor) {
      setDone(false);
      setLastAction(null);
    }
  }, [priorActions.length]);

  const isHero = actor === 'hero';
  const borderColor = isHero ? 'border-blue-500/40' : 'border-orange-500/40';
  const headerColor = isHero ? 'text-blue-300' : 'text-orange-300';
  const bgColor     = isHero ? 'bg-blue-500/5'  : 'bg-orange-500/5';

  // כמה פעמים כבר הורם בשלב הנוכחי
  const raiseCount = priorActions.filter(a =>
    ['bet', 'raise', 'three-bet', 'four-bet'].includes(a.action)
  ).length;
  const raiseType  = raiseCount === 0 ? 'bet' : raiseCount === 1 ? 'three-bet' : 'four-bet';
  const raiseLabel = raiseCount === 0 ? 'BET'  : raiseCount === 1 ? '3BET'      : '4BET';

  const hasAggression = priorActions.some(a =>
    ['bet', 'raise', 'three-bet', 'four-bet', 'allin'].includes(a.action)
  );

  const submit = (action, amt) => {
    const actionObj = { actor, action, amount: amt || undefined };
    onAction(actionObj);
    setLastAction({ action, amount: amt });
    setDone(true);
    setChosen(null);
    setAmount('');
    setAmountMode('number');
  };

  const handleUndo = () => {
    setDone(false);
    setLastAction(null);
    onUndo?.();
  };

  const handleAction = (key) => {
    if (key === 'fold' || key === 'check') {
      submit(key, null);
    } else if (key === 'limp') {
      // לימפ = קול על ה-BB. הסכום הוא נטו: bb - מה שכבר שולם כ-blind
      const limpAmt = Math.max(0, (blindBb || 0) - (actorPosted || 0));
      submit('limp', limpAmt > 0 ? limpAmt : null);
    } else if (key === 'allin') {
      submit('allin', playerStack != null ? playerStack : null);
    } else if (key === 'call') {
      const lastRaise = [...priorActions].reverse()
        .find(a => ['bet', 'raise', 'three-bet', 'four-bet', 'allin'].includes(a.action) && a.amount);
      const raiseAmt = lastRaise?.amount ? parseFloat(lastRaise.amount) : 0;
      // אם השחקן כבר הימר — סכום ה-BET הוא TOTAL (כולל blind),
      // אל תוסיף את ה-blind בנפרד. אם לא הימר — הוסף רק את ה-blind.
      const actorHasRaised = priorActions.some(a =>
        String(a.actor) === String(actor) &&
        ['bet', 'raise', 'three-bet', 'four-bet'].includes(a.action) && a.amount
      );
      const actorActionTotal = priorActions
        .filter(a => String(a.actor) === String(actor) && a.amount)
        .reduce((sum, a) => {
          const raw = String(a.amount);
          if (raw.endsWith('%')) return sum;
          const num = parseFloat(raw);
          return isNaN(num) ? sum : sum + num;
        }, 0);
      const alreadyIn = actorActionTotal + (actorHasRaised ? 0 : actorPosted);
      const netCall = raiseAmt > 0 ? Math.max(0, raiseAmt - alreadyIn) : null;
      // אם ה-call גדול מהארמה הנותרת — זה אול-אין כפוי
      if (netCall !== null && playerStack !== null && netCall >= playerStack) {
        submit('allin', playerStack);
      } else {
        submit('call', netCall || null);
      }
    } else if (key === 'raise') {
      // raise button → סוג נקבע לפי ספירת הרייזים
      setChosen(raiseType);
    } else {
      setChosen(key);
    }
  };

  const actorLabel = label || (isHero ? '🦸 הירו' : '😈 יריב');
  const hint = bbHint(amount, blindBb);
  const minBet = chosen && NEEDS_AMOUNT.includes(chosen)
    ? computeMinBet(priorActions, blindSb, blindBb, street)
    : 0;
  const enteredNum = parseFloat(amount);
  const isBelowMin = minBet > 0 && !!amount && !isNaN(enteredNum) && enteredNum < minBet;
  const minBetBbs = blindBb && blindBb > 0 ? Number((minBet / blindBb).toFixed(1)) : null;

  // ── Collapsed "done" state ──────────────────────────
  if (done && lastAction) {
    let amtLabel = '';
    if (lastAction.amount) {
      const raw = lastAction.amount.toString();
      if (raw.endsWith('%')) {
        amtLabel = ` — ${raw}`;
      } else {
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          let displayNum = num;
          if (lastAction.action === 'call') {
            const lastRaise = [...priorActions].reverse()
              .find(pa => ['bet', 'raise', 'three-bet', 'four-bet'].includes(pa.action) && pa.amount);
            if (lastRaise) displayNum = parseFloat(lastRaise.amount) || num;
          }
          const bbs = blindBb && blindBb > 0 ? Number((displayNum / blindBb).toFixed(1)) : null;
          if (unit === 'BB') {
            amtLabel = ` — ${displayNum.toLocaleString('he-IL')}${bbs ? ` (${bbs}BB)` : ''}`;
          } else {
            amtLabel = ` — ₪${displayNum.toLocaleString('he-IL')}${bbs ? ` (${bbs}BB)` : ''}`;
          }
        }
      }
    }
    return (
      <div className={`rounded-xl border ${borderColor} ${bgColor} px-3 py-2 flex items-center justify-between`}>
        <button onClick={handleUndo}
          className="text-slate-500 hover:text-red-400 transition-colors text-xs px-2 py-0.5 rounded hover:bg-red-500/10">
          ✕ שנה
        </button>
        <span className={`text-sm font-bold ${headerColor}`}>
          {actorLabel} — {ACTION_LABELS[lastAction.action] || lastAction.action}{amtLabel}
        </span>
      </div>
    );
  }

  // ── Full selector ──────────────────────────────────
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-3`}>
      <div className={`text-xs font-bold ${headerColor} mb-2 text-right`}>{actorLabel} — בחר פעולה:</div>
      <div className="flex flex-wrap gap-1.5 justify-end">
        {ACTIONS.filter(a => {
          // check: only when no open bet; preflop only if actor already paid full BB
          if (a.key === 'check') {
            if (hasAggression) return false;
            if (street === 'preflop' && (actorPosted || 0) < (blindBb || 0)) return false;
            return true;
          }
          // limp: preflop only, no aggression, actor hasn't paid full BB yet (BB can't limp)
          if (a.key === 'limp') {
            if (street !== 'preflop') return false;
            if (hasAggression) return false;
            if ((actorPosted || 0) >= (blindBb || 0)) return false;
            return true;
          }
          // fold: only when there's an open bet to fold to
          if (a.key === 'fold' && !hasAggression) return false;
          return true;
        }).map(a => {
          const isRaise   = a.key === 'raise';
          const dispLabel = isRaise ? raiseLabel : a.label;
          const isChosen  = isRaise ? (chosen === raiseType) : (chosen === a.key);
          return (
            <button key={a.key}
              onClick={() => handleAction(a.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all duration-150 ${a.color}
                ${isChosen ? 'ring-2 ring-white/20 scale-105' : ''}`}>
              {dispLabel}
            </button>
          );
        })}
      </div>

      {chosen && NEEDS_AMOUNT.includes(chosen) && (
        <div className="mt-3 space-y-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-600 w-fit mr-auto">
            <button
              onClick={() => { setAmountMode('number'); setAmount(''); }}
              className={`px-3 py-1 text-xs font-bold transition-all ${amountMode === 'number' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              סכום ישיר
            </button>
            <button
              onClick={() => { setAmountMode('percent'); setAmount(''); }}
              className={`px-3 py-1 text-xs font-bold transition-all ${amountMode === 'percent' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              % מהקופה
            </button>
          </div>

          {amountMode === 'number' ? (
            <div className="space-y-1.5">
              <div className="flex gap-2 items-center" dir="ltr">
                <button
                  onClick={() => !isBelowMin && amount && submit(chosen, amount)}
                  disabled={!amount || isBelowMin}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-all flex-shrink-0">
                  אישור
                </button>
                <input
                  type="number" min="0"
                  placeholder={unit === 'BB' ? "צ'יפים" : '₪'}
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className={`flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border text-white text-sm text-right focus:outline-none transition-colors
                    ${isBelowMin ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-blue-500'}`}
                  autoFocus
                />
              </div>
              {isBelowMin && (
                <div className="text-right text-[11px] text-red-400 font-bold" dir="rtl">
                  מינימום: {minBet.toLocaleString('he-IL')}{minBetBbs ? ` (${minBetBbs}BB)` : ''}
                </div>
              )}
              {!isBelowMin && hint && (
                <div className="text-right text-[11px] text-blue-400/70 font-mono">{hint}</div>
              )}
            </div>
          ) : (
            <div className="flex gap-2 items-center" dir="ltr">
              <button
                onClick={() => amount && submit(chosen, `${amount}%`)}
                disabled={!amount}
                className="px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-all flex-shrink-0">
                אישור
              </button>
              <div className="flex-1 flex items-center gap-1">
                <span className="text-slate-400 text-sm">%</span>
                <input
                  type="number" min="1" max="200"
                  placeholder="50"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm text-right focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
