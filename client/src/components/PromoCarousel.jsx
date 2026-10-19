import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { activePromos, CLUBS, PROMO_TAG } from '../data/onlineClubs';
import { logOnlineClick } from '../utils/api';
import { useOnlineVisible } from '../utils/onlineAccess';

const ROTATE_MS = 5000;

// אחרי כמה טורנירים ברשימה בעמוד הבית משתלב הפרסום הממומן
export const PROMO_SLOT_AFTER = 4;

// פרסום ממומן בתוך רשימת הטורנירים (תצוגת רשימה) — שורה נמוכה עם תמונות מוקטנות של
// פרסומי השבוע, כדי לא לשבור את קצב הרשימה עם פוסטר אנכי ענק. לחיצה ← עמוד האונליין.
export function PromoListRow({ source }) {
  const [promos] = useState(() => activePromos());
  const visible = useOnlineVisible();
  if (!visible || promos.length === 0) return null;
  const clubNames = [...new Set(promos.map(p => CLUBS.find(c => c.id === p.clubId)?.name).filter(Boolean))];
  return (
    <Link to="/online" onClick={() => logOnlineClick('promo', promos[0].clubId, source)}
      className="flex items-center gap-4 px-4 py-3 bg-violet-950/40 hover:bg-violet-900/40 transition-colors" dir="rtl">
      <div className="flex -space-x-3 space-x-reverse shrink-0">
        {promos.slice(0, 3).map(p => (
          <img key={p.id} src={p.image} alt="" loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="w-14 h-[4.5rem] object-cover rounded-lg border-2 border-slate-900 shadow-lg" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-200">{PROMO_TAG} · ממומן</span>
        <p className="font-black text-white mt-1 truncate">{clubNames.join(' · ')} — טורנירי השבוע באונליין</p>
        <p className="text-xs text-slate-400 truncate">{promos.map(p => p.alt.split('—')[1]?.trim()).filter(Boolean).join(' · ')}</p>
      </div>
      <span className="hidden sm:inline-flex shrink-0 items-center min-h-[40px] px-4 rounded-xl bg-violet-600 text-white text-sm font-bold">לכל הפרטים ←</span>
    </Link>
  );
}

// קרוסלת פרסומי הקלאבים — מתחלפת לבד, ואפשר לדפדף ידנית (חצים, נקודות, החלקה במגע).
// עוצרת כשהעכבר מעליה / אחרי מגע, כדי שלא תברח למשתמש באמצע קריאה.
// המעבר הוא דפדוף עמוד: העמוד היוצא מסתובב סביב "שדרת הספר" ונחשף העמוד הבא שמתחתיו.
// המסגרת ריבועית וקבועה (שום דבר בעמוד לא זז בהחלפה) — פשרה בין פוסטר אנכי לפלייר לרוחב.
// השטח הפנוי סביב הפלייר מתמלא באותו פלייר מוגדל ומטושטש (כמו אינסטגרם/ספוטיפיי) במקום פסים שחורים.
// לחיצה על פרסום פותחת אותו בגודל מלא, עם כפתור הפעולה מתחת.
// to: לאן לחיצה על הפרסום מובילה (ברירת מחדל: עמוד האונליין). hrefFor(promo) — קישור חיצוני במקום
// (למשל וואטסאפ לסוכן, בעמוד האונליין עצמו). לא מרנדרת כלום כשאין פרסומים בתוקף.
const TURN_MS = 900;

export default function PromoCarousel({ source, to = '/online', hrefFor = null, className = '' }) {
  const [allPromos] = useState(() => activePromos());
  // פרסום שהתמונה שלו לא נטענת (למשל נמחק מהשרת בזמן שהדף היה פתוח) — יורד מהסבב במקום מסגרת ריקה
  const [brokenIds, setBrokenIds] = useState(() => new Set());
  const promos = useMemo(() => allPromos.filter(p => !brokenIds.has(p.id)), [allPromos, brokenIds]);
  const markBroken = (id) => setBrokenIds(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
  const visible = useOnlineVisible();
  const [index, setIndex] = useState(0);
  const [turning, setTurning] = useState(null); // { from, dir: 'next' | 'prev' } בזמן דפדוף
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const touchX = useRef(null);
  const turnTimer = useRef(null);
  const resumeTimer = useRef(null);
  const [zoomed, setZoomed] = useState(null); // הפרסום שפתוח בגודל מלא
  const zoomedRef = useRef(null);
  const swipedAt = useRef(0); // החלקה לא נחשבת כהקשה — שלא תפתח את ההגדלה בטעות
  zoomedRef.current = zoomed;
  const total = promos.length;
  useEffect(() => {
    if (index >= total && total > 0) { indexRef.current = 0; setIndex(0); setTurning(null); }
  }, [index, total]);

  useEffect(() => () => { clearTimeout(turnTimer.current); clearTimeout(resumeTimer.current); }, []);

  // טעינה מראש של כל הפוסטרים — כדי שהעמוד שנחשף בדפדוף כבר יהיה מוכן ולא יהבהב
  useEffect(() => {
    // וגם מזהה מראש פרסום שהקובץ שלו חסר — יורד מהסבב עוד לפני שמגיעים אליו
    allPromos.forEach(p => { const img = new Image(); img.onerror = () => markBroken(p.id); img.src = p.image; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPromos]);

  const goTo = (next, dir) => {
    if (next === indexRef.current) return;
    // דפדוף באמצע דפדוף (למשל החלקה בזמן החלפה אוטומטית) — קוטעים את הקודם ומתחילים מיד,
    // כדי שהמגע תמיד ירגיש מגיב
    clearTimeout(turnTimer.current);
    // הדפדוף מוצג תמיד, גם למי שכיבה אנימציות במערכת ההפעלה — החלטת בעל האתר (2026-10-12)
    const from = indexRef.current;
    indexRef.current = next;
    setIndex(next);
    setTurning({ from, dir });
    turnTimer.current = setTimeout(() => setTurning(null), TURN_MS);
  };
  const go = (delta) => goTo((indexRef.current + delta + total) % total, delta > 0 ? 'next' : 'prev');

  useEffect(() => {
    if (total < 2) return;
    const timer = setInterval(() => {
      if (!pausedRef.current && !zoomedRef.current) go(1);
    }, ROTATE_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  if (!visible || total === 0) return null;

  const promo = promos[index] || promos[0];
  const club = CLUBS.find(c => c.id === promo.clubId);

  // במגע אין "העכבר יצא" — עוצרים בזמן המגע וממשיכים לבד 8 שניות אחרי המגע האחרון
  const onTouchStart = (e) => {
    pausedRef.current = true;
    clearTimeout(resumeTimer.current);
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { pausedRef.current = false; }, 8000);
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    // RTL: החלקה שמאלה = הבא
    if (Math.abs(dx) > 40) { swipedAt.current = Date.now(); go(dx < 0 ? 1 : -1); }
    touchX.current = null;
  };

  const arrow = 'absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 text-white text-xl flex items-center justify-center z-20 transition-colors';
  const openZoom = () => {
    if (Date.now() - swipedAt.current < 500) return;
    logOnlineClick('promo', promo.clubId, `${source}:${promo.id}`);
    setZoomed(promo);
  };
  const frameStyle = { perspective: '1800px', aspectRatio: '1 / 1' };

  // ספר עברי: השדרה מימין. "הבא" — העמוד מתהפך סביב הקצה הימני; "הקודם" — סביב השמאלי
  const leaving = turning && promos[turning.from];
  const turnNext = turning?.dir === 'next';

  return (
    <div className={`relative ${className}`} dir="rtl"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      aria-roledescription="carousel" aria-label="פרסומי קלאבים">
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/40 bg-black"
        style={frameStyle}>
        <span className="absolute top-2 right-2 z-20 text-[11px] font-bold px-2 py-0.5 rounded-md bg-black/70 text-violet-200">
          {PROMO_TAG}{club ? ` · ${club.name}` : ''}
        </span>

        {/* העמוד הנוכחי — מתחת לעמוד שמתהפך. לחיצה = פתיחה בגודל מלא */}
        <button type="button" onClick={openZoom} className="absolute inset-0 w-full h-full cursor-zoom-in"
          aria-label={`הגדלת הפרסום: ${promo.alt}`}>
          <PromoPage promo={promo} onBroken={markBroken} />
        </button>

        {/* העמוד היוצא — מסתובב סביב השדרה ומתכהה קלות, כמו דף שמתרומם מהספר */}
        {leaving && (
          <div key={`${turning.from}-${index}`}
            className={`absolute inset-0 z-10 pointer-events-none ${turnNext ? 'animate-page-turn-next' : 'animate-page-turn-prev'}`}
            style={{ transformOrigin: turnNext ? 'right center' : 'left center', backfaceVisibility: 'hidden', willChange: 'transform' }}>
            <PromoPage promo={leaving} onBroken={markBroken} />
            <div className="absolute inset-0 animate-page-shade"
              style={{ background: `linear-gradient(${turnNext ? 'to left' : 'to right'}, rgba(0,0,0,0.05), rgba(0,0,0,0.8))` }} />
          </div>
        )}

        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className={`${arrow} right-2`} aria-label="הקודם">›</button>
            <button type="button" onClick={() => go(1)} className={`${arrow} left-2`} aria-label="הבא">‹</button>
          </>
        )}
      </div>
      {zoomed && (
        <PromoLightbox promo={zoomed} hrefFor={hrefFor} to={to} source={source} onClose={() => setZoomed(null)} />
      )}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {promos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => goTo(i, i > index ? 'next' : 'prev')} aria-label={`פרסום ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-500 ${i === index ? 'w-6 bg-violet-500' : 'w-2 bg-slate-600 hover:bg-slate-400'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// עמוד אחד בקרוסלה: הפלייר עצמו במלואו (contain), ומאחוריו אותו פלייר מוגדל ומטושטש שממלא את הריבוע
function PromoPage({ promo, onBroken }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <img src={promo.image} alt="" aria-hidden="true" draggable="false"
        className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60" />
      <img src={promo.image} alt={promo.alt} draggable="false" onError={() => onBroken?.(promo.id)}
        className="relative w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.7)]" />
    </div>
  );
}

// הפלייר בגודל מלא — כדי שאפשר יהיה לקרוא את כל הפרטים הקטנים (שעות, באי-אין, GTD) גם בטלפון
function PromoLightbox({ promo, hrefFor, to, source, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const cta = 'inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl text-base font-bold text-white transition-colors';
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in" dir="rtl"
      role="dialog" aria-modal="true" aria-label={promo.alt} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="סגירה"
        className="absolute top-3 left-3 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center">✕</button>
      <img src={promo.image} alt={promo.alt} onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-[calc(100dvh-8rem)] object-contain rounded-xl shadow-2xl" />
      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
        {hrefFor ? (
          <a href={hrefFor(promo)} target="_blank" rel="noopener noreferrer"
            onClick={() => logOnlineClick('whatsapp', promo.clubId, `${source}:lightbox`)}
            className={`${cta} bg-[#25D366] hover:bg-[#1da851]`}>
            💬 לפרטים בוואטסאפ
          </a>
        ) : (
          <Link to={to} onClick={onClose} className={`${cta} bg-violet-600 hover:bg-violet-500`}>
            לכל הפרטים ←
          </Link>
        )}
      </div>
    </div>,
    document.body
  );
}
