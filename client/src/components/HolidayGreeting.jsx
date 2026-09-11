import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ברכת ראש השנה — מוצגת פעם אחת לכל מבקר, עם X לסגירה.
 *
 * ההודעה נסגרת לצמיתות (localStorage) ברגע שהמשתמש סוגר אותה, ולכן המפתח
 * כולל את שנת החג: בשנה הבאה זה מפתח אחר, וכל המבקרים יראו את הברכה מחדש
 * בלי שנצטרך לנקות אחסון אצל אף אחד.
 */
const STORAGE_KEY = 'pli_holiday_greeting_rosh_hashanah_5787';

/**
 * חלון התצוגה. מחוץ לטווח הזה הברכה פשוט לא נטענת — כך היא נעלמת מעצמה
 * בתום החג בלי דיפלוי נוסף.
 * להצגה בשנה הבאה: לעדכן את שלושת הקבועים (כולל שנת החג ב-STORAGE_KEY).
 * להצגה תמידית: להחזיר true מ-withinHolidayWindow.
 */
const WINDOW_START = new Date('2026-09-06T00:00:00+03:00'); // כשבוע לפני ערב החג
const WINDOW_END   = new Date('2026-09-21T23:59:59+03:00'); // סוף עשרת ימי תשובה

// עיכוב קצר לפני ההופעה: נותן לעמוד להיטען ולא קופץ למשתמש באמצע הרינדור.
const SHOW_DELAY_MS = 900;

function withinHolidayWindow(now = new Date()) {
  return now >= WINDOW_START && now <= WINDOW_END;
}

// ניצוצות זהב מרחפים מעל התמונה. מיקומים קבועים ולא אקראיים כדי שהפריסה
// תהיה זהה בכל רינדור (ולא "תקפוץ" אחרי setState כלשהו).
const SPARKLES = [
  { left: '6%',  top: '72%', size: 7,  delay: '0s',   duration: '5.5s' },
  { left: '14%', top: '38%', size: 5,  delay: '1.4s', duration: '6.5s' },
  { left: '22%', top: '84%', size: 9,  delay: '2.6s', duration: '5s'   },
  { left: '31%', top: '22%', size: 6,  delay: '0.7s', duration: '7s'   },
  { left: '39%', top: '63%', size: 8,  delay: '3.3s', duration: '5.8s' },
  { left: '47%', top: '15%', size: 5,  delay: '1.9s', duration: '6.2s' },
  { left: '55%', top: '78%', size: 7,  delay: '0.3s', duration: '5.2s' },
  { left: '63%', top: '34%', size: 10, delay: '2.2s', duration: '6.8s' },
  { left: '71%', top: '58%', size: 6,  delay: '4.1s', duration: '5.6s' },
  { left: '79%', top: '18%', size: 8,  delay: '1.1s', duration: '7.2s' },
  { left: '86%', top: '69%', size: 5,  delay: '3.7s', duration: '6s'   },
  { left: '93%', top: '42%', size: 7,  delay: '2.9s', duration: '5.4s' },
];

export default function HolidayGreeting() {
  const [show, setShow] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!withinHolidayWindow()) return;

    // localStorage חסום בחלק מדפדפני הפרטיות — שם עדיף להציג את הברכה
    // מאשר לקרוס על השגיאה.
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (dismissed) return;

    const t = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!show) return;
    const handler = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [show]);

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  // z-[70]: מעל המודלים הרגילים (z-50/60) ומתחת לבאנר העוגיות (z-[80])
  // ולווידג'ט הנגישות (z-[90]) — שניהם חייבים להישאר לחיצים.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="holiday-greeting-title"
      className="modal-overlay fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={close} />

      <div className="modal-panel-h relative w-full sm:max-w-2xl flex flex-col overflow-hidden rounded-3xl shadow-2xl animate-slide-up holiday-panel">

        {/* כפתור סגירה — קטן אבל ברור: עיגול מלא עם ניגודיות גבוהה מעל התמונה */}
        <button
          ref={closeRef}
          onClick={close}
          aria-label="סגור את הברכה"
          title="סגור"
          className="absolute top-3 left-3 z-20 flex items-center justify-center w-9 h-9 rounded-full
                     bg-slate-900/80 hover:bg-red-500 text-amber-100 hover:text-white
                     border border-amber-300/60 shadow-lg backdrop-blur
                     transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>

        {/* התמונה: זום/תזוזה איטיים (Ken Burns) + הבזק אור חולף + ניצוצות */}
        <div className="relative overflow-hidden holiday-shine">
          <picture>
            <source srcSet="/holidays/rosh-hashanah.webp" type="image/webp" />
            <img
              src="/holidays/rosh-hashanah.jpg"
              alt="שנה טובה מאתר PokerIsrael — תפוח בדבש, קלפים ודגל ישראל"
              className="w-full block holiday-kenburns"
              width="1600"
              height="900"
            />
          </picture>

          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {SPARKLES.map((s, i) => (
              <span
                key={i}
                className="holiday-sparkle"
                style={{
                  left: s.left,
                  top: s.top,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  '--sparkle-delay': s.delay,
                  '--sparkle-duration': s.duration,
                }}
              />
            ))}
          </div>
        </div>

        {/* כותרת וכפתור */}
        <div className="always-dark px-5 py-4 sm:px-6 sm:py-5 text-center holiday-footer">
          <h2 id="holiday-greeting-title" className="text-lg sm:text-2xl font-black holiday-title">
            🍎🍯 שנה טובה ומתוקה!
          </h2>
          <p className="mt-1.5 text-sm sm:text-base text-amber-100/80 leading-relaxed">
            שתהיה שנה של ראנים טובים, פוטים גדולים ובעיקר בריאות — מצוות PokerIsrael 🃏
          </p>
          <button onClick={close} className="btn-gold mt-4 text-sm sm:text-base px-8">
            שנה טובה! ✨
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
