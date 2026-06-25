const ALL_POSITIONS = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export default function OpponentManager({ opponents, onChange, heroPosition, unit = 'BB', heroStack }) {
  const usedPositions = new Set([heroPosition, ...opponents.map(o => o.position)]);

  const addOpponent = () => {
    const available = ALL_POSITIONS.find(p => !usedPositions.has(p));
    const newOpp = {
      id: Date.now(),
      label: `יריב ${opponents.length + 1}`,
      position: available || '',
      stack: parseInt(heroStack) || 100,
      stackTouched: false,
      cards: null,
    };
    onChange([...opponents, newOpp]);
  };

  const updateOpponent = (id, field, value) => {
    onChange(opponents.map(o => {
      if (o.id !== id) return o;
      if (field === 'stack') return { ...o, stack: value, stackTouched: true };
      return { ...o, [field]: value };
    }));
  };

  const removeOpponent = (id) => {
    onChange(opponents.filter(o => o.id !== id));
  };

  return (
    <div className="space-y-3">
      {opponents.map((opp, i) => (
        <div key={opp.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => removeOpponent(opp.id)}
              className="text-red-400/70 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-all">
              הסר
            </button>
            <span className="text-sm font-bold text-slate-300">יריב {i + 1}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* Name */}
            <div className="col-span-3">
              <input
                type="text" placeholder="שם/כינוי (אופציונלי)"
                value={opp.label}
                onChange={e => updateOpponent(opp.id, 'label', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none"
              />
            </div>
            {/* Position */}
            <div className="col-span-2">
              <label className="block text-[10px] text-slate-300 mb-1 text-right">עמדה</label>
              <select
                value={opp.position}
                onChange={e => updateOpponent(opp.id, 'position', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                dir="ltr">
                <option value="">בחר</option>
                {ALL_POSITIONS.filter(p => p !== heroPosition || p === opp.position).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {/* Stack */}
            <div>
              <label className="block text-[10px] text-slate-300 mb-1 text-right">ערימה ({unit})</label>
              <input
                type="number" min="1"
                value={opp.stack}
                onChange={e => updateOpponent(opp.id, 'stack', parseInt(e.target.value) || 0)}
                onFocus={e => { if (!opp.stackTouched) e.target.select(); }}
                className={`w-full px-2 py-1.5 rounded-lg bg-slate-900 border text-sm text-right focus:border-blue-500 focus:outline-none transition-colors
                  ${opp.stackTouched
                    ? 'border-slate-600 text-slate-200'
                    : 'border-slate-700 text-slate-500'}`}
              />
            </div>
          </div>
        </div>
      ))}

      {opponents.length < 7 && (
        <button onClick={addOpponent}
          className="w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 text-sm font-bold transition-all hover:bg-blue-500/5">
          + הוסף יריב
        </button>
      )}
    </div>
  );
}
