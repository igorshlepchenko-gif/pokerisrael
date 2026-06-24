const ALL_POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'];

const SEAT_ANGLES = {
  BTN: 0, SB: 45, BB: 90, UTG: 135,
  'UTG+1': 180, MP: 225, HJ: 270, CO: 315,
};

function polarToXY(angleDeg, rx, ry, cx, cy) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
}

export default function PositionSelector({ selected, onChange, playersCount = 9 }) {
  const visiblePositions = ALL_POSITIONS.slice(0, Math.max(2, Math.min(playersCount, 8)));
  const cx = 170, cy = 108;
  const feltRx = 128, feltRy = 76;
  const railRx = feltRx + 10, railRy = feltRy + 10;
  const woodRx = feltRx + 20, woodRy = feltRy + 20;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="-15 -20 370 260" className="w-full max-w-[340px] select-none drop-shadow-2xl">
        <defs>
          {/* Felt gradient — lighter center, dark edges */}
          <radialGradient id="pg-felt" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#1a6b3d" />
            <stop offset="100%" stopColor="#0a3520" />
          </radialGradient>
          {/* Rail gradient — deep crimson */}
          <radialGradient id="pg-rail" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#991b1b" />
            <stop offset="100%" stopColor="#450a0a" />
          </radialGradient>
          {/* Wood rail gradient — warm amber */}
          <linearGradient id="pg-wood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#92400e" />
            <stop offset="50%"  stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          {/* Outer glow */}
          <filter id="pg-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Seat glow for selected */}
          <filter id="pg-seat-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── Outer shadow ── */}
        <ellipse cx={cx} cy={cy + 4} rx={woodRx} ry={woodRy}
          fill="rgba(0,0,0,0.45)" />

        {/* ── Wood outer frame ── */}
        <ellipse cx={cx} cy={cy} rx={woodRx} ry={woodRy}
          fill="url(#pg-wood)" stroke="#451a03" strokeWidth="2.5" />

        {/* ── Crimson rail ── */}
        <ellipse cx={cx} cy={cy} rx={railRx} ry={railRy}
          fill="url(#pg-rail)" stroke="#7f1d1d" strokeWidth="1.5" />

        {/* ── Green felt surface ── */}
        <ellipse cx={cx} cy={cy} rx={feltRx} ry={feltRy}
          fill="url(#pg-felt)" stroke="#15803d" strokeWidth="1" />

        {/* ── Gold decorative inner line ── */}
        <ellipse cx={cx} cy={cy} rx={feltRx - 14} ry={feltRy - 14}
          fill="none" stroke="#b45309" strokeWidth="1.2"
          strokeDasharray="10 6" opacity="0.8" />

        {/* ── Center logo ── */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#166534"
          fontSize="9" fontWeight="bold" fontFamily="sans-serif" opacity="0.7">
          POKER
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="#166534"
          fontSize="9" fontWeight="bold" fontFamily="sans-serif" opacity="0.7">
          ISRAEL
        </text>

        {/* ── Seats ── */}
        {visiblePositions.map(pos => {
          const angle = SEAT_ANGLES[pos];
          const { x, y } = polarToXY(angle, feltRx + 28, feltRy + 24, cx, cy);
          const isSel = selected === pos;
          return (
            <g key={pos} onClick={() => onChange(pos)} style={{ cursor: 'pointer' }}>
              {/* Glow ring for selected */}
              {isSel && (
                <circle cx={x} cy={y} r={22}
                  fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.4"
                  filter="url(#pg-seat-glow)" />
              )}
              {/* Chip outer ring */}
              <circle cx={x} cy={y} r={19}
                fill={isSel ? '#1e40af' : '#0f172a'}
                stroke={isSel ? '#3b82f6' : '#475569'}
                strokeWidth={isSel ? 2.5 : 1.5} />
              {/* Chip inner ring */}
              <circle cx={x} cy={y} r={14}
                fill={isSel ? '#2563eb' : '#1e293b'}
                stroke={isSel ? '#60a5fa' : '#334155'}
                strokeWidth="1" />
              {/* Position label */}
              <text x={x} y={y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill={isSel ? '#fff' : '#94a3b8'}
                fontSize={pos.length > 3 ? '6.5' : '8'}
                fontWeight="bold" fontFamily="sans-serif">
                {pos}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Text button fallback */}
      <div className="flex flex-wrap gap-2 justify-center">
        {visiblePositions.map(pos => (
          <button key={pos} onClick={() => onChange(pos)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all duration-150
              ${selected === pos
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-blue-500 hover:text-white'
              }`}>
            {pos}
          </button>
        ))}
      </div>
    </div>
  );
}
