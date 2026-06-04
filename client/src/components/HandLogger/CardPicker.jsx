const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

const SUITS = [
  { key: 's', symbol: '♠', color: '#1e293b', bgLabel: '#94a3b8', hover: '#334155' },
  { key: 'h', symbol: '♥', color: '#dc2626', bgLabel: '#f87171', hover: '#ef4444' },
  { key: 'd', symbol: '♦', color: '#1d4ed8', bgLabel: '#60a5fa', hover: '#2563eb' },
  { key: 'c', symbol: '♣', color: '#15803d', bgLabel: '#4ade80', hover: '#16a34a' },
];

function cardKey(rank, suit) { return `${rank}${suit}`; }

export default function CardPicker({ selected = [], onChange, max = 2, disabled = [] }) {
  const disabledSet = new Set(disabled.map(c => cardKey(c.rank, c.suit)));
  const selectedSet = new Set(selected.map(c => cardKey(c.rank, c.suit)));

  const toggle = (rank, suit) => {
    const key = cardKey(rank, suit);
    if (disabledSet.has(key)) return;
    if (selectedSet.has(key)) {
      onChange(selected.filter(c => cardKey(c.rank, c.suit) !== key));
    } else if (selected.length < max) {
      onChange([...selected, { rank, suit }]);
    }
  };

  // Responsive grid: suit-symbol col + 13 equal-width card cols
  const gridStyle = { gridTemplateColumns: 'repeat(13, 1fr)', gap: '2px' };

  return (
    <div className="w-full" dir="ltr">
      {/* Card rows */}
      {SUITS.map(suit => (
        <div key={suit.key} className="grid mb-1" style={gridStyle}>
          {/* Cards */}
          {RANKS.map(rank => {
            const key = cardKey(rank, suit.key);
            const isSel = selectedSet.has(key);
            const isDis = disabledSet.has(key);
            return (
              <button
                key={key}
                onClick={() => toggle(rank, suit.key)}
                disabled={isDis}
                title={`${rank}${suit.symbol}`}
                className="rounded aspect-[2/3] text-xs font-black border transition-all duration-100 select-none w-full"
                style={
                  isSel ? {
                    background: suit.hover,
                    borderColor: '#fff',
                    color: '#fff',
                    boxShadow: `0 0 8px ${suit.color}cc`,
                    transform: 'scale(1.12)',
                  } : isDis ? {
                    background: '#1e293b',
                    borderColor: '#334155',
                    color: '#475569',
                    cursor: 'not-allowed',
                    opacity: 0.4,
                  } : {
                    background: suit.color,
                    borderColor: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }
                }
              >
                {rank}
              </button>
            );
          })}
        </div>
      ))}

      {/* Selected card display */}
      {selected.length > 0 && (
        <div className="flex gap-3 mt-4 justify-center">
          {selected.map(c => {
            const s = SUITS.find(x => x.key === c.suit);
            return (
              <div key={cardKey(c.rank, c.suit)}
                className="flex flex-col items-center justify-center w-14 h-20 rounded-xl border-2 shadow-xl"
                style={{ background: s?.color, borderColor: '#fff', boxShadow: `0 4px 20px ${s?.color}60` }}>
                <span className="text-2xl font-black leading-none text-white">{c.rank}</span>
                <span className="text-2xl leading-none text-white">{s?.symbol}</span>
              </div>
            );
          })}
          {Array.from({ length: max - selected.length }).map((_, i) => (
            <div key={i}
              className="flex items-center justify-center w-14 h-20 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/30">
              <span className="text-slate-600 text-2xl">?</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
