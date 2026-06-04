import { useState, useEffect } from 'react';

const ACTIONS = [
  { key: 'fold',      label: 'פולד',      color: 'text-red-400   border-red-500/40   hover:bg-red-500/10'  },
  { key: 'check',     label: "צ'ק",       color: 'text-slate-300 border-slate-500/40 hover:bg-slate-700'   },
  { key: 'limp',      label: 'לימפ',      color: 'text-slate-300 border-slate-500/40 hover:bg-slate-700'   },
  { key: 'call',      label: 'קול',       color: 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10' },
  { key: 'raise',     label: 'רייז',      color: 'text-blue-400  border-blue-500/40  hover:bg-blue-500/10'  },
  { key: 'three-bet', label: '3bet',      color: 'text-violet-400 border-violet-500/40 hover:bg-violet-500/10' },
  { key: 'four-bet',  label: '4bet',      color: 'text-pink-400  border-pink-500/40  hover:bg-pink-500/10'  },
  { key: 'allin',     label: 'אול-אין',   color: 'text-amber-400 border-amber-500/40 hover:bg-amber-500/10' },
];

const NEEDS_AMOUNT = ['raise', 'three-bet', 'four-bet', 'limp'];

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

// Input is always absolute (chips for tournament, ₪ for cash) → returns BB equivalent
function bbHint(amount, blindBb) {
  if (!amount || !blindBb || blindBb <= 0) return null;
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return null;
  const bbs = Number((num / blindBb).toFixed(1));
  return `= ${bbs}BB`;
}

const ACTION_LABELS = {
  fold: 'פולד', check: "צ'ק", limp: 'לימפ', call: 'קול',
  raise: 'רייז', 'three-bet': '3bet', 'four-bet': '4bet', allin: 'אול-אין',
};

export default function ActionSelector({
  actor, label, unit = 'BB', street = 'preflop',
  onAction, onUndo, priorActions = [], blindBb = null, actorPosted = 0,
}) {
  const [chosen, setChosen] = useState(null);
  const [amount, setAmount] = useState('');
  const [amountMode, setAmountMode] = useState('number'); // 'number' | 'percent'
  const [done, setDone] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  // כשאחר פועל — אפשר לשחקן לפעול שוב (סיבוב חדש)
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
  const bgColor = isHero ? 'bg-blue-500/5' : 'bg-orange-500/5';

  const hasAggression = priorActions.some(a =>
    ['raise', 'three-bet', 'four-bet', 'allin'].includes(a.action)
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
    if (key === 'fold' || key === 'check' || key === 'allin') {
      submit(key, null);
    } else if (key === 'call') {
      const lastRaise = [...priorActions].reverse()
        .find(a => ['raise', 'three-bet', 'four-bet'].includes(a.action) && a.amount);
      // חישוב DELTA: כמה השחקן צריך להוסיף מעל מה שכבר שילם כ-blind
      const raiseAmt = lastRaise?.amount ? parseFloat(lastRaise.amount) : 0;
      const netCall = raiseAmt > 0 ? Math.max(0, raiseAmt - actorPosted) : null;
      submit('call', netCall || null);
    } else {
      setChosen(key);
    }
  };

  const actorLabel = label || (isHero ? '🦸 הירו' : '😈 יריב');
  const hint = bbHint(amount, blindBb);

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
          // For 'call': show the FULL raise amount (not the stored delta)
          let displayNum = num;
          if (lastAction.action === 'call') {
            const lastRaise = [...priorActions].reverse()
              .find(pa => ['raise', 'three-bet', 'four-bet'].includes(pa.action) && pa.amount);
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
          if (street === 'preflop' && a.key === 'check') return false;
          if (street !== 'preflop' && ['limp', 'three-bet', 'four-bet'].includes(a.key)) return false;
          if (street === 'preflop' && a.key === 'limp' && hasAggression) return false;
          if (street !== 'preflop' && a.key === 'check' && hasAggression) return false;
          // 'call' תמיד זמין
          return true;
        }).map(a => (
          <button key={a.key}
            onClick={() => handleAction(a.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all duration-150 ${a.color}
              ${chosen === a.key ? 'ring-2 ring-white/20 scale-105' : ''}`}>
            {a.label}
          </button>
        ))}
      </div>

      {chosen && NEEDS_AMOUNT.includes(chosen) && (
        <div className="mt-3 space-y-2">
          {/* Mode toggle */}
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
                  onClick={() => amount && submit(chosen, amount)}
                  disabled={!amount}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-all flex-shrink-0">
                  אישור
                </button>
                <input
                  type="number" min="0"
                  placeholder={unit === 'BB' ? "צ'יפים" : '₪'}
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm text-right focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
              {hint && (
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
