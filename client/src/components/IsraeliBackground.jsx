/* רקע גאווה ישראלית — קבוע מאחורי כל התוכן */

const STARS = [
  { top: '4%',  left: '2%',   size: 110, opacity: 0.22, delay: 0 },
  { top: '8%',  right: '4%',  size: 90,  opacity: 0.18, delay: 1.2 },
  { top: '22%', left: '8%',   size: 70,  opacity: 0.16, delay: 2.5 },
  { top: '30%', right: '7%',  size: 130, opacity: 0.20, delay: 0.8 },
  { top: '48%', left: '1%',   size: 85,  opacity: 0.17, delay: 3.1 },
  { top: '52%', right: '2%',  size: 75,  opacity: 0.20, delay: 1.7 },
  { top: '65%', left: '6%',   size: 100, opacity: 0.18, delay: 0.4 },
  { top: '70%', right: '9%',  size: 65,  opacity: 0.16, delay: 2.2 },
  { top: '82%', left: '3%',   size: 120, opacity: 0.20, delay: 1.5 },
  { top: '88%', right: '3%',  size: 80,  opacity: 0.18, delay: 0.9 },
  { top: '15%', left: '45%',  size: 60,  opacity: 0.12, delay: 3.8 },
  { top: '60%', left: '48%',  size: 75,  opacity: 0.14, delay: 2.0 },
];

function StarOfDavid({ size, opacity, style, delay }) {
  const s = size;
  const cx = s / 2, cy = s / 2, r = s * 0.38;

  // משולש עולה
  const t1 = [
    [cx, cy - r],
    [cx + r * Math.sin(Math.PI / 3 * 2), cy + r * 0.5],
    [cx - r * Math.sin(Math.PI / 3 * 2), cy + r * 0.5],
  ].map(p => p.join(',')).join(' ');

  // משולש יורד
  const t2 = [
    [cx, cy + r],
    [cx + r * Math.sin(Math.PI / 3 * 2), cy - r * 0.5],
    [cx - r * Math.sin(Math.PI / 3 * 2), cy - r * 0.5],
  ].map(p => p.join(',')).join(' ');

  return (
    <svg
      width={s} height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{
        position: 'absolute',
        opacity,
        animationDelay: `${delay}s`,
        ...style,
      }}
      className="animate-israel-float"
    >
      <polygon points={t1} fill="none" stroke="#6BA3FF" strokeWidth={s * 0.04} />
      <polygon points={t2} fill="none" stroke="#6BA3FF" strokeWidth={s * 0.04} />
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
        style={{
          background: 'linear-gradient(90deg, rgba(0,56,184,0.22) 0%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-56"
        style={{
          background: 'linear-gradient(270deg, rgba(0,56,184,0.22) 0%, transparent 100%)',
        }}
      />

      {/* כוכבי דוד מפוזרים */}
      {STARS.map((s, i) => {
        const { top, left, right, size, opacity, delay } = s;
        return (
          <StarOfDavid
            key={i}
            size={size}
            opacity={opacity}
            delay={delay}
            style={{ top, left, right }}
          />
        );
      })}

      {/* דגלי ישראל */}
      <span
        className="absolute"
        style={{ top: '3%', left: '46%', opacity: 0.28, fontSize: '4rem', transform: 'rotate(-8deg)' }}
      >🇮🇱</span>
      <span
        className="absolute"
        style={{ bottom: '4%', left: '45%', opacity: 0.28, fontSize: '4rem', transform: 'rotate(6deg)' }}
      >🇮🇱</span>
      <span
        className="absolute"
        style={{ top: '44%', left: '49%', opacity: 0.18, fontSize: '3rem', transform: 'rotate(-3deg)' }}
      >🇮🇱</span>
    </div>
  );
}
