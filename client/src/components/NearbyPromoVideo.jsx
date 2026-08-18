import { useState, useEffect, useRef } from 'react';

/**
 * באנר "מצא טורניר קרוב אליי" — סרטון שרץ בלופ, והכפתור מוטמע בתוכו.
 *
 * muted + playsInline הם חובה ולא סגנון: דפדפנים חוסמים ניגון אוטומטי עם קול,
 * ובלי playsInline מכשירי iOS פותחים את הסרטון במסך מלא במקום להריץ אותו במקום.
 *
 * הכפתור (children) מרונדר תמיד — גם לפני שידוע אם הסרטון קיים וגם אם הוא חסר.
 * הסרטון יושב ב-Volume ולא בריפו, כלומר Volume שאותחל או סביבה חדשה נשארים
 * בלעדיו; במצב כזה הבאנר נופל חזרה לכפתור על רקע מדורג, בלי חור בממשק.
 *
 * הרוחב מוגבל מול ה-viewport ולא מול ההורה בכוונה: עמודת הטקסט של ההירו היא
 * flex item עם min-width:auto, ולכן היא מסרבת להצטמצם מתחת לרוחב התוכן שלה
 * ויוצאת רחבה מהמסך במובייל (402px בתוך 343px). באנר ב-w-full היה יורש את
 * הרוחב הזה ונחתך בקצוות.
 */
export default function NearbyPromoVideo({ src = '/uploads/videos/nearby-promo-loop.mp4', children }) {
  const [available, setAvailable] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: 'HEAD' })
      .then(r => { if (!cancelled) setAvailable(r.ok); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [src]);

  // React מגדיר את muted כתכונה (property) אך לא כאטריביוט ב-DOM, ומדיניות
  // ה-autoplay של הדפדפן בודקת את האטריביוט בזמן החיבור — כך שהסרטון נחשב
  // "עם קול" ומושתק אוטומטית מלהתנגן. מגדירים ידנית ומפעילים בעצמנו.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.setAttribute('muted', '');
    const start = () => el.play().catch(() => {});
    start();
    // אם המדיה עדיין לא מוכנה בזמן ההרכבה — לנסות שוב כשהיא כן
    el.addEventListener('canplay', start);
    return () => el.removeEventListener('canplay', start);
  }, [available, src]);

  if (!available) {
    // בלי סרטון — הכפתור לבדו, כפי שהיה
    return <div className="flex justify-center">{children}</div>;
  }

  return (
    <div className="relative w-full max-w-[min(420px,calc(100vw-2rem))] mx-auto rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="block w-full aspect-video object-cover"
      />

      {/* שכבת הכהיה — הכפתור יושב מעל וידאו שהבהירות שלו משתנה כל הזמן,
          ובלי זה הטקסט היה קריא בחלק מהפריימים ובחלק לא */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/25 pointer-events-none" />

      {/* pointer-events-none על העטיפה כדי שרק הכפתור עצמו ילכוד לחיצות,
          ולא כל שטח הסרטון */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}
