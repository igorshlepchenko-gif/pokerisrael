import { parseScene, splitCards } from '../utils/cardText';

// ── קלפים לשאלות השעשועון ───────────────────────────────────────────────────
// חפיסת ארבעה צבעים (כמו באונליין): ♠ שחור, ♥ אדום, ♦ כחול, ♣ ירוק — קל להבדיל
// בין הסדרות במבט אחד, גם כשהשעון רץ.
const SUIT_COLOR = { '♠': '#111827', '♥': '#dc2626', '♦': '#1d4ed8', '♣': '#15803d' };
const SUIT_NAME = { '♠': 'עלה', '♥': 'לב', '♦': 'יהלום', '♣': 'תלתן' };

const SIZES = {
  lg: { box: 'w-11 h-[62px] sm:w-14 sm:h-20', rank: 'text-lg sm:text-2xl', suit: 'text-2xl sm:text-3xl' },
  md: { box: 'w-10 h-14 sm:w-12 sm:h-[68px]', rank: 'text-base sm:text-xl', suit: 'text-xl sm:text-2xl' },
};

export function PlayingCard({ rank, suit, size = 'lg' }) {
  const s = SIZES[size];
  return (
    <span role="img" aria-label={`${rank} ${SUIT_NAME[suit] || ''}`}
      className={`${s.box} inline-flex flex-col items-center justify-center rounded-lg bg-white shadow-[0_2px_6px_rgba(0,0,0,0.45)] border border-slate-300 leading-none select-none`}
      style={{ color: SUIT_COLOR[suit], direction: 'ltr' }}>
      <span className={`${s.rank} font-black tracking-tighter`}>{rank === '10' ? '10' : rank}</span>
      <span className={s.suit} aria-hidden="true">{suit}</span>
    </span>
  );
}

// קלף קטן בתוך משפט (תשובות, שאלות בלי שולחן)
function MiniCard({ rank, suit }) {
  return (
    <bdi className="inline-flex items-center mx-0.5 px-1 rounded bg-white font-black text-[0.95em] leading-tight align-baseline shadow-sm"
      style={{ color: SUIT_COLOR[suit], direction: 'ltr' }} aria-label={`${rank} ${SUIT_NAME[suit] || ''}`}>
      {rank}{suit}
    </bdi>
  );
}

export function CardText({ text }) {
  return (
    <>
      {splitCards(text).map((p, i) => (p.card ? <MiniCard key={i} {...p.card} /> : <span key={i}>{p.text}</span>))}
    </>
  );
}

function Row({ cards, size }) {
  return (
    <div className="flex gap-1 sm:gap-1.5 justify-center" style={{ direction: 'ltr' }}>
      {cards.map((c, i) => <PlayingCard key={i} {...c} size={size} />)}
    </div>
  );
}

function Seat({ seat, hero }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Row cards={seat.cards} size="md" />
      <span className={`px-2 py-0.5 rounded-full text-xs font-black ${hero ? 'bg-amber-400 text-slate-950' : 'bg-slate-950/70 text-slate-100 border border-white/20'}`}>
        {seat.label}
      </span>
    </div>
  );
}

// שולחן פוקר: הבורד באמצע, הידיים סביבו. מחזיר null אם בשאלה אין קלפים בפורמט מוכר
export function CardScene({ scene }) {
  if (!scene) return null;
  const seats = [...scene.seats, ...(scene.hero ? [{ ...scene.hero, hero: true }] : [])];
  return (
    <div className="rounded-[2.5rem] p-2 mb-4" style={{ background: 'linear-gradient(180deg,#7c4a1e,#4a2a10)' }}>
      <div className="rounded-[2rem] px-2 py-4 sm:px-4 sm:py-5 border border-black/40"
        style={{ background: 'radial-gradient(ellipse at center, #1f8a4c 0%, #15693a 55%, #0d4a28 100%)', boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)' }}>
        {scene.board.length > 0 && (
          <div className="mb-4">
            <p className="text-center text-[11px] font-bold text-emerald-100/80 mb-1.5 tracking-wide">{scene.street || 'בורד'}</p>
            <Row cards={scene.board} size="lg" />
          </div>
        )}
        {seats.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-3" style={{ direction: 'rtl' }}>
            {seats.map((s, i) => <Seat key={i} seat={s} hero={s.hero} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// השאלה כמו שהיא מוצגת: שולחן (אם יש בורד/ידיים) + שאר הטקסט, או טקסט עם קלפים קטנים
export function QuestionText({ text, className = '' }) {
  const scene = parseScene(text);
  return (
    <>
      {scene && <CardScene scene={scene} />}
      <span className={className}><CardText text={scene ? scene.text : text} /></span>
    </>
  );
}
