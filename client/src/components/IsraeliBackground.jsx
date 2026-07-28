/* רקע גאווה ישראלית × פוקר — קלפים וכוכבי דוד ברקמה אחת, קבוע מאחורי כל התוכן */

const GLYPHS = [
  { type: 'star', top: '4%',  left: '2%',   size: 110, opacity: 0.22, delay: 0 },
  { type: 'suit', suit: 's',  top: '8%',  right: '4%',  size: 80,  opacity: 0.18, delay: 1.2 },
  { type: 'suit', suit: 'd',  top: '22%', left: '8%',   size: 60,  opacity: 0.16, delay: 2.5 },
  { type: 'star', top: '30%', right: '7%',  size: 130, opacity: 0.20, delay: 0.8 },
  { type: 'suit', suit: 'h',  top: '48%', left: '1%',   size: 75,  opacity: 0.17, delay: 3.1 },
  { type: 'star', top: '52%', right: '2%',  size: 75,  opacity: 0.20, delay: 1.7 },
  { type: 'suit', suit: 'c',  top: '65%', left: '6%',   size: 90,  opacity: 0.18, delay: 0.4 },
  { type: 'star', top: '70%', right: '9%',  size: 65,  opacity: 0.16, delay: 2.2 },
  { type: 'suit', suit: 's',  top: '82%', left: '3%',   size: 105, opacity: 0.20, delay: 1.5 },
  { type: 'star', top: '88%', right: '3%',  size: 80,  opacity: 0.18, delay: 0.9 },
  { type: 'suit', suit: 'd',  top: '15%', left: '45%',  size: 55,  opacity: 0.12, delay: 3.8 },
  { type: 'suit', suit: 'h',  top: '60%', left: '48%',  size: 65,  opacity: 0.14, delay: 2.0 },
];

const SUIT_PATHS = {
  s: 'M50,8 C33,26 10,40 10,60 C10,76 24,84 37,79 C42,77 47,72 49,66 C47,76 42,85 28,90 L72,90 C58,85 53,76 51,66 C53,72 58,77 63,79 C76,84 90,76 90,60 C90,40 67,26 50,8 Z',
  h: 'M50,88 C33,70 10,56 10,36 C10,20 24,12 37,17 C44,20 48,26 50,34 C52,26 56,20 63,17 C76,12 90,20 90,36 C90,56 67,70 50,88 Z',
  d: 'M50,6 L86,50 L50,94 L14,50 Z',
  c: 'M50,20 C40,20 32,28 32,38 C32,44 35,49 40,52 C30,50 20,55 20,64 C20,74 28,82 38,80 C42,79 45,77 47,74 C45,80 42,86 34,90 L66,90 C58,86 55,80 53,74 C55,77 58,79 62,80 C72,82 80,74 80,64 C80,55 70,50 60,52 C65,49 68,44 68,38 C68,28 60,20 50,20 Z',
};

function StarOfDavid({ size, opacity, style, delay }) {
  const s = size;
  const cx = s / 2, cy = s / 2, r = s * 0.38;

  const t1 = [
    [cx, cy - r],
    [cx + r * Math.sin(Math.PI / 3 * 2), cy + r * 0.5],
    [cx - r * Math.sin(Math.PI / 3 * 2), cy + r * 0.5],
  ].map(p => p.join(',')).join(' ');

  const t2 = [
    [cx, cy + r],
    [cx + r * Math.sin(Math.PI / 3 * 2), cy - r * 0.5],
    [cx - r * Math.sin(Math.PI / 3 * 2), cy - r * 0.5],
  ].map(p => p.join(',')).join(' ');

  return (
    <svg
      width={s} height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ position: 'absolute', opacity, animationDelay: `${delay}s`, ...style }}
      className="animate-float-y motion-reduce:animate-none"
    >
      <polygon points={t1} fill="none" stroke="#6BA3FF" strokeWidth={s * 0.04} />
      <polygon points={t2} fill="none" stroke="#6BA3FF" strokeWidth={s * 0.04} />
    </svg>
  );
}

function SuitGlyph({ suit, size, opacity, style, delay }) {
  const s = size;
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 100 100"
      style={{ position: 'absolute', opacity, animationDelay: `${delay}s`, ...style }}
      className="animate-float-y motion-reduce:animate-none"
    >
      <path d={SUIT_PATHS[suit]} fill="none" stroke="#6BA3FF" strokeWidth={3.2} strokeLinejoin="round" />
    </svg>
  );
}

export default function IsraeliBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* רצועות כחולות כמו בדגל — למעלה ולמטה */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: '10px',
          background: 'linear-gradient(90deg, transparent 0%, #6BA3FF 10%, #6BA3FF 90%, transparent 100%)',
          opacity: 0.55,
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '10px',
          background: 'linear-gradient(90deg, transparent 0%, #6BA3FF 10%, #6BA3FF 90%, transparent 100%)',
          opacity: 0.55,
        }}
      />

      {/* זוהר כחול עמוק מהצדדים */}
      <div
        className="absolute inset-y-0 left-0 w-56"
        style={{ background: 'linear-gradient(90deg, rgba(0,56,184,0.22) 0%, transparent 100%)' }}
      />
      <div
        className="absolute inset-y-0 right-0 w-56"
        style={{ background: 'linear-gradient(270deg, rgba(0,56,184,0.22) 0%, transparent 100%)' }}
      />

      {/* כוכבי דוד + סימני קלפים — פוקר וישראל ברקמה אחת */}
      {GLYPHS.map((g, i) => {
        const { type, suit, top, left, right, size, opacity, delay } = g;
        return type === 'star'
          ? <StarOfDavid key={i} size={size} opacity={opacity} delay={delay} style={{ top, left, right }} />
          : <SuitGlyph key={i} suit={suit} size={size} opacity={opacity} delay={delay} style={{ top, left, right }} />;
      })}
    </div>
  );
}
