import { useState, useEffect, useRef } from 'react';

/**
 * סרטון הסבר קצר לפיצ'ר "מצא טורניר קרוב אליי" — רץ בלופ ליד הכפתור.
 *
 * מושתק (חובה — דפדפנים חוסמים ניגון אוטומטי עם קול), loop, ו-playsInline
 * כדי ש-iOS לא יפתח אותו במסך מלא.
 *
 * הסרטון יושב ב-Volume של Railway ולא בריפו, כלומר הוא לא מגיע עם הבנייה:
 * סביבה חדשה או Volume שאותחל -> הקובץ חסר. לכן בודקים HEAD לפני שמרנדרים,
 * אחרת היה נשאר כאן ריבוע שחור ריק.
 */
export default function NearbyPromoVideo({ src = '/uploads/videos/nearby-promo-loop.mp4' }) {
  const [available, setAvailable] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: 'HEAD' })
      .then(r => { if (!cancelled) setAvailable(r.ok); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [src]);

  // כיבוד prefers-reduced-motion — לאתר יש הצהרת נגישות, ווידאו שרץ בלולאה
  // בלי הפסקה הוא בדיוק סוג התנועה שההעדפה הזו נועדה לעצור. במצב כזה הסרטון
  // מוצג עם פקדים ולא מתנגן מעצמו.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (!available) return null;

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay={!reduceMotion}
      loop
      muted
      playsInline
      controls={reduceMotion}
      preload="auto"
      aria-label="סרטון הסבר קצר — מציאת טורניר קרוב"
      className="w-full max-w-[320px] rounded-2xl shadow-2xl border border-slate-700/60 bg-black"
    />
  );
}
