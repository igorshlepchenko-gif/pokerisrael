import { useState } from 'react';

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

const SUITS = [
  { key: 's', symbol: '♠', color: '#1e293b', bgLabel: '#94a3b8', hover: '#334155' },
  { key: 'h', symbol: '♥', color: '#dc2626', bgLabel: '#f87171', hover: '#ef4444' },
  { key: 'd', symbol: '♦', color: '#1d4ed8', bgLabel: '#60a5fa', hover: '#2563eb' },
  { key: 'c', symbol: '♣', color: '#15803d', bgLabel: '#4ade80', hover: '#16a34a' },
];

function cardKey(rank, suit) { return `${rank}${suit}`; }

export default function CardPicker({ selected = [], onChange, max = 2, disabled = [] }) {
  const [pendingSwap, setPendingSwap] = useState(null); // key of card being replaced

  const disabledSet = new Set(disabled.map(c => cardKey(c.rank, c.suit)));
  const selectedSet = new Set(selected.map(c => cardKey(c.rank, c.suit)));

  const sortCards = (cards) =>
    [...cards].sort((a, b) => {
      const rankDiff = RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
      if (rankDiff !== 0) return rankDiff;
      return SUITS.findIndex(s => s.key === a.suit) - SUITS.findIndex(s => s.key === b.suit);
    });

  const toggle = (rank, suit) => {
    const key = cardKey(rank, suit);
    if (disabledSet.has(key)) return;

    if (pendingSwap) {
      if (key === pendingSwap) {
        // לחיצה שנייה על אותו קלף — ביטול החלפה
        setPendingSwap(null);
        return;
      }
      if (selectedSet.has(key)) return; // לא מחליפים בקלף שכבר נבחר
      const newSelected = selected.map(c =>
        cardKey(c.rank, c.suit) === pendingSwap ? { rank, suit } : c
      );
      onChange(sortCards(newSelected));
      setPendingSwap(null);
      return;
    }

    if (selectedSet.has(key)) {
      // סימון להחלפה במקום מחיקה
      setPendingSwap(key);
    } else if (selected.length < max) {
      onChange(sortCards([...selected, { rank, suit }]));
    }
  };

  const gridStyle = { gridTemplateColumns: 'repeat(13, 1fr)', gap: '2px' };

  return (
    <div className="w-full" dir="ltr">
      {/* Card rows */}
      {SUITS.map(suit => (
        <div key={suit.key} className="grid mb-1" style={gridStyle}>
          {RANKS.map(rank => {
            const key = cardKey(rank, suit.key);
            const isSel   = selectedSet.has(key);
            const isDis   = disabledSet.has(key);
            const isPending = pendingSwap === key;
            return (
              <button
                key={key}
                onClick={() => toggle(rank, suit.key)}
                disabled={isDis}
                title={`${rank}${suit.symbol}`}
                className="rounded aspect-[2/3] text-xs font-black border transition-all duration-100 select-none w-full"
                style={
                  isPending ? {
                    background: '#f97316',
                    borderColor: '#fff',
                    color: '#fff',
                    boxShadow: '0 0 12px #f9731699, 0 0 4px #fff8',
                    transform: 'scale(1.15)',
                    animation: 'pulse 1s infinite',
                  } : isSel ? {
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
            const key     = cardKey(c.rank, c.suit);
            const s       = SUITS.find(x => x.key === c.suit);
            const isPending = pendingSwap === key;
            return (
              <div
                key={key}
                onClick={() => toggle(c.rank, c.suit)}
                className="flex flex-col items-center justify-center w-14 h-20 rounded-xl border-2 shadow-xl cursor-pointer transition-all duration-150 hover:scale-105"
                style={isPending ? {
                  background: '#f97316',
                  borderColor: '#fff',
                  boxShadow: '0 0 20px #f9731699, 0 0 6px #fff8',
                  transform: 'scale(1.1)',
                } : {
                  background: s?.color,
                  borderColor: '#fff',
                  boxShadow: `0 4px 20px ${s?.color}60`,
                }}
              >
                <span className="text-2xl font-black leading-none text-white">{c.rank}</span>
                <span className="text-2xl leading-none text-white">{s?.symbol}</span>
                {isPending && (
                  <span className="text-[9px] text-white/80 font-bold mt-0.5">החלף</span>
                )}
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

      {/* הנחיה בזמן המתנה להחלפה */}
      {pendingSwap && (
        <p className="text-center text-xs text-orange-400 mt-2 font-bold" dir="rtl">
          בחר קלף חלופי מהטבלה • לחץ שוב לביטול
        </p>
      )}
    </div>
  );
}
