import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * כרטיס החוקים של השעשועון (תמונה אחת) — נפתח מהבאנר בעמוד הבית ומ"איך זה עובד?" בשעשועון.
 * z-[75]: מעל באנר ההשקה (z-[70]) שממנו הוא נפתח, מתחת לבאנר העוגיות (z-[80]).
 */
export default function QuizRulesModal({ onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="חוקי שולם בליינד"
      className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl animate-slide-up"
        style={{ border: '1px solid rgba(251,191,36,0.4)', background: '#040a1c' }}>
        <button ref={closeRef} onClick={onClose} aria-label="סגור" title="סגור"
          className="sticky top-3 float-left ml-3 mt-3 z-10 flex items-center justify-center w-9 h-9 rounded-full
                     bg-slate-900/85 hover:bg-red-500 text-amber-100 hover:text-white border border-amber-300/60 shadow-lg
                     transition-all duration-200 hover:scale-110 active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <img src="/quiz/rules.webp" width="1240" height="1754" className="w-full h-auto block -mt-12"
          alt="שולם בליינד — מתחילים עם 1,000 צ'יפים, רואים נושא וקושי ומחליטים כמה להמר; נכון: ההימור חוזר ×1, ×1.5 או ×2; טעות או איחור: ההימור יורד; 20 שניות לשאלה. מצבי משחק: סט יומי, לפי נושא, נגד השעון, צ'אלנג' מועדון. חינם, ללא כסף אמיתי." />
      </div>
    </div>,
    document.body
  );
}
