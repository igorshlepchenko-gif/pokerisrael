import { useState, useEffect } from 'react';

// שעון חי לפי שעון ישראל — ללא תלות במיקום הצופה
export default function IsraelClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const time = now.toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jerusalem',
  });
  const date = now.toLocaleDateString('he-IL', {
    weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem',
  });

  return (
    <div
      title="שעון ישראל"
      className="flex items-center gap-2 px-3 py-1 rounded-lg border bg-blue-950/40"
      style={{ borderColor: 'rgba(34,211,238,0.25)' }}
    >
      <span className="text-base leading-none">🇮🇱</span>
      <div className="text-right leading-tight">
        <div className="font-mono font-bold text-cyan-300 text-sm tabular-nums tracking-tight">{time}</div>
        <div className="text-[10px] text-slate-400">{date} · שעון ישראל</div>
      </div>
    </div>
  );
}
