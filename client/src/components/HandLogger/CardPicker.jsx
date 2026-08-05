import { useState, useRef } from 'react';

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
  const [dragKey, setDragKey] = useState(null);          // key of card currently being dragged
  const [dragPos, setDragPos] = useState(null);          // {x,y} pointer position while dragging
  const [overDeck, setOverDeck] = useState(false);        // is the drag currently over the deck grid?
  const deckRef = useRef(null);
  // "לחיצה" (click) מגיעה אחרי pointerup בכל גרירה, גם כשלא זזנו — הדגל הזה
  // מונע מ-toggle להריץ את לוגיקת ה-pendingSwap הרגילה אחרי גרירה שהושלמה
  // בפועל (במקום זה, שהחזירה כבר מחקה את הקלף)
  const justDraggedRef = useRef(false);

  const disabledSet = new Set(disabled.map(c => cardKey(c.rank, c.suit)));
  const selectedSet = new Set(selected.map(c => cardKey(c.rank, c.suit)));

  const sortCards = (cards) =>
    [...cards].sort((a, b) => {
      const rankDiff = RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
      if (rankDiff !== 0) return rankDiff;
      return SUITS.findIndex(s => s.key === a.suit) - SUITS.findIndex(s => s.key === b.suit);
    });

  const toggle = (rank, suit) => {
    if (justDraggedRef.current) { justDraggedRef.current = false; return; }
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

  // גרירת קלף נבחר בחזרה לאזור החבילה — מוציאה אותו מהיד/מהבורד ומשאירה את
  // המקום ריק, בלי להחליף אוטומטית באף קלף (לעומת לחיצה, שנכנסת ל-pendingSwap)
  const dragStartPosRef = useRef(null);

  const handleDragStart = (e, card) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPendingSwap(null);
    justDraggedRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    setDragKey(cardKey(card.rank, card.suit));
    setDragPos({ x: e.clientX, y: e.clientY });
    setOverDeck(false);
  };

  const handleDragMove = (e) => {
    if (!dragKey) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    if (deckRef.current) {
      const r = deckRef.current.getBoundingClientRect();
      setOverDeck(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    }
  };

  const handleDragEnd = (e) => {
    if (!dragKey) return;
    const start = dragStartPosRef.current;
    // תזוזה משמעותית (גם אם לא שוחרר מעל החבילה) = הייתה כאן גרירה של ממש,
    // לא לחיצה — מדכאים את ה-click הפאנטומי כדי שלא "יכנס" בטעות למצב
    // pendingSwap (ההחלפה הרגילה) כתוצאה מגרירה שהתבטלה
    const moved = start && (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8);
    if (overDeck) {
      onChange(selected.filter(c => cardKey(c.rank, c.suit) !== dragKey));
    }
    if (overDeck || moved) {
      justDraggedRef.current = true;
      // לא סומכים רק על ה-click הבא כדי לאפס את הדגל — אם הקלף שגררנו הוסר
      // (overDeck), ה-React מסיר את האלמנט הזה מה-DOM בעדכון שמגיע מ-onChange,
      // וייתכן שה-click הפאנטומי שהדפדפן שולח אחרי pointerup בכלל לא יגיע
      // לשום מאזין — מה שהיה משאיר את הדגל תקוע על true ובולע לחיצה תמימה
      // הבאה במקום אחר בקומפוננטה. טיימר של טיק אחד מבטיח איפוס תמיד.
      setTimeout(() => { justDraggedRef.current = false; }, 0);
    }
    dragStartPosRef.current = null;
    setDragKey(null);
    setDragPos(null);
    setOverDeck(false);
  };

  const gridStyle = { gridTemplateColumns: 'repeat(13, 1fr)', gap: '2px' };
  const draggedCard = dragKey ? selected.find(c => cardKey(c.rank, c.suit) === dragKey) : null;
  const draggedSuit = draggedCard ? SUITS.find(s => s.key === draggedCard.suit) : null;

  return (
    <div className="w-full" dir="ltr">
      {/* Card rows — deck (also the drop target for removing a selected card) */}
      <div ref={deckRef}
        className="rounded-xl transition-all duration-150"
        style={overDeck ? { boxShadow: '0 0 0 3px #60a5fa99', background: 'rgba(96,165,250,0.08)' } : undefined}>
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
      </div>

      {/* Selected card display */}
      {selected.length > 0 && (
        <div className="flex gap-3 mt-4 justify-center">
          {selected.map(c => {
            const key     = cardKey(c.rank, c.suit);
            const s       = SUITS.find(x => x.key === c.suit);
            const isPending = pendingSwap === key;
            const isDragging = dragKey === key;
            return (
              <div
                key={key}
                onClick={() => toggle(c.rank, c.suit)}
                onPointerDown={e => handleDragStart(e, c)}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
                className="flex flex-col items-center justify-center w-14 h-20 rounded-xl border-2 shadow-xl cursor-pointer transition-all duration-150 hover:scale-105"
                style={{
                  touchAction: 'none',
                  opacity: isDragging ? 0.3 : 1,
                  background: isPending ? '#f97316' : s?.color,
                  borderColor: '#fff',
                  boxShadow: isPending ? '0 0 20px #f9731699, 0 0 6px #fff8' : `0 4px 20px ${s?.color}60`,
                  transform: isPending ? 'scale(1.1)' : undefined,
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

      {/* Floating ghost card while dragging */}
      {draggedCard && dragPos && (
        <div
          style={{
            position: 'fixed', left: dragPos.x, top: dragPos.y,
            transform: 'translate(-50%,-50%) scale(1.1)',
            pointerEvents: 'none', zIndex: 9999,
            background: draggedSuit?.color, borderColor: '#fff',
            boxShadow: `0 8px 24px ${draggedSuit?.color}80`,
          }}
          className="flex flex-col items-center justify-center w-14 h-20 rounded-xl border-2"
        >
          <span className="text-2xl font-black leading-none text-white">{draggedCard.rank}</span>
          <span className="text-2xl leading-none text-white">{draggedSuit?.symbol}</span>
        </div>
      )}

      {/* הנחיה בזמן גרירה */}
      {dragKey && (
        <p className="text-center text-xs text-blue-400 mt-2 font-bold" dir="rtl">
          {overDeck ? 'שחרר כדי להחזיר את הקלף ולהשאיר מקום ריק' : 'גרור לאזור החבילה כדי להחזיר את הקלף'}
        </p>
      )}

      {/* הנחיה בזמן המתנה להחלפה */}
      {!dragKey && pendingSwap && (
        <p className="text-center text-xs text-orange-400 mt-2 font-bold" dir="rtl">
          בחר קלף חלופי מהטבלה • לחץ שוב לביטול
        </p>
      )}
    </div>
  );
}
