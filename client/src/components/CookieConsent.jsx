import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const bannerRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('pli_cookie_consent')) {
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // מפרסם את גובה הבאנר בפועל כ-CSS variable, כדי שמודלים יוכלו לשמור מרווח
  // ולא ייחסמו על ידו (הבאנר הוא z-[80], מעליהם). הגובה שונה מהותית בין
  // מובייל (~210px, פריסה אנכית) לדסקטופ (~111px) — לכן נמדד ולא מקובע.
  useEffect(() => {
    const root = document.documentElement;
    if (!show || !bannerRef.current) {
      root.style.removeProperty('--cookie-banner-h');
      return;
    }
    const el = bannerRef.current;
    const apply = () => root.style.setProperty('--cookie-banner-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--cookie-banner-h'); };
  }, [show]);

  const accept = () => {
    localStorage.setItem('pli_cookie_consent', '1');
    setShow(false);
  };

  if (!show) return null;

  // z-[80]: מעל כל המודלים (z-50/60) כדי שאישור העוגיות תמיד יהיה נגיש.
  // ווידג'ט הנגישות הוא z-[90] — הוא חופף גיאומטרית לבאנר וחייב להישאר לחיץ.
  return (
    <div ref={bannerRef} className="fixed bottom-0 inset-x-0 z-[80] p-3 sm:p-4 animate-slide-up" dir="rtl">
      <div className="max-w-3xl mx-auto rounded-2xl border shadow-2xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row items-center gap-3"
        style={{ background: 'rgba(13,21,38,0.97)', borderColor: 'rgba(29,78,216,0.4)', backdropFilter: 'blur(8px)' }}>
        <span className="text-2xl shrink-0">🍪</span>
        <p className="text-sm text-slate-300 flex-1 text-center sm:text-right leading-relaxed">
          אנו משתמשים בעוגיות חיוניות לצורך תפעול האתר ושמירת ההתחברות שלך.{' '}
          <Link to="/privacy" className="text-blue-400 hover:underline">למידע נוסף — מדיניות הפרטיות</Link>
        </p>
        <button onClick={accept}
          className="btn-primary text-sm shrink-0 whitespace-nowrap px-6">
          הבנתי ✓
        </button>
      </div>
    </div>
  );
}
