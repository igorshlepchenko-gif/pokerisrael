import { Link } from 'react-router-dom';
import { PROMO_TAG } from '../data/onlineClubs';
import { useOnlineVisible } from '../utils/onlineAccess';
import { logOnlineClick } from '../utils/api';

// מיקומי פרסום לעמוד פוקר אונליין. שניהם לא מרנדרים כלום כל עוד אין קלאבים
// (ONLINE_ENABLED) — כך שאפשר לשתול אותם בכל מקום בלי להשאיר קישור לעמוד ריק.

// שורה עדינה מתחת ל"ההרשמה נסגרה" — הצעה במקום מבוי סתום. מסגרת מקווקוות ולא כפתור
// מלא, כדי שלא תתחרה בפעולה הראשית של הכרטיס.
// compact — לעמודת הכפתורים הצרה בשורת הרשימה בדסקטופ
export function OnlineNudge({ source, compact = false, className = '' }) {
  if (!useOnlineVisible()) return null;
  return (
    <Link to="/online"
      onClick={(e) => { e.stopPropagation(); logOnlineClick('promo', null, source); }}
      className={compact
        ? `flex items-center justify-center rounded-xl border border-dashed border-violet-500/60 py-1.5 px-3 text-[11px] font-bold text-violet-300 whitespace-nowrap hover:bg-violet-500/10 transition-colors ${className}`
        : `flex items-center justify-center gap-1.5 w-full min-h-[40px] rounded-xl border border-dashed border-violet-500/60 px-3 text-xs font-bold text-violet-300 hover:bg-violet-500/10 transition-colors ${className}`}>
      {compact ? 'שחק עכשיו אונליין ←' : 'פספסת? יש שולחנות פתוחים עכשיו באונליין ←'}
    </Link>
  );
}

// כרטיס במקום מסך "לא נמצאו טורנירים" (חיפוש ריק / קרוב אליי)
export function OnlineEmptyCard({ source, title = 'באונליין תמיד יש משחק בגובה שלך', className = '' }) {
  if (!useOnlineVisible()) return null;
  return (
    <div className={`max-w-sm mx-auto rounded-2xl border border-violet-500/50 bg-violet-950/40 p-5 text-center ${className}`}>
      <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-200">{PROMO_TAG}</span>
      <h4 className="mt-2 font-black text-white">{title}</h4>
      <p className="text-sm text-slate-400 mt-1">מגוון קלאבים ב-ClubGG דרך סוכן אחד</p>
      <Link to="/online" onClick={() => logOnlineClick('promo', null, source)}
        className="mt-4 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors">
        הראו לי קלאבים
      </Link>
    </div>
  );
}
