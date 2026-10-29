import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuizAccess } from '../utils/quizAccess';
import QuizRulesModal from './QuizRulesModal';

/**
 * באנר השקת השעשועון — קופץ בעמוד הבית, פעם אחת לכל מבקר (נזכר ב-localStorage).
 * מוצג רק כשהשעשועון פתוח לכולם (app_settings.quiz_open_to_all) — בשלב הסגור לא קופץ.
 * להציג שוב לכולם (למשל בהשקה של פיצ'ר חדש): להחליף את STORAGE_KEY.
 */
const STORAGE_KEY = 'pli_quiz_launch_v1';
const SHOW_DELAY_MS = 1200;

export default function QuizLaunchPopup() {
  const quiz = useQuizAccess();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [rules, setRules] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (pathname !== '/' || quiz.loading || !quiz.open) return undefined;
    // localStorage חסום בחלק מדפדפני הפרטיות — אז פשוט מציגים
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (dismissed) return undefined;
    const t = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname, quiz.loading, quiz.open]);

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };
  const play = () => { close(); navigate('/quiz'); };

  // Escape כשכרטיס החוקים פתוח — סוגר רק אותו (הוא מטפל בזה בעצמו)
  const rulesRef = useRef(false);
  rulesRef.current = rules;
  useEffect(() => {
    if (!show) return undefined;
    const handler = (e) => { if (e.key === 'Escape' && !rulesRef.current) close(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [show]);

  if (!show || pathname !== '/') return null;

  // z-[70] כמו ברכת החג: מעל המודלים הרגילים, מתחת לבאנר העוגיות (z-[80]) ולווידג'ט הנגישות (z-[90])
  return createPortal(
    <>
      <div role="dialog" aria-modal="true" aria-labelledby="quiz-launch-title"
        className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={close} />

        <div className="always-dark relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl animate-slide-up"
          style={{ background: '#040a1c', border: '1px solid rgba(251,191,36,0.45)', boxShadow: '0 0 40px rgba(29,78,216,0.35), 0 0 0 1px rgba(29,78,216,0.25) inset' }}>

          <button ref={closeRef} onClick={close} aria-label="סגור" title="סגור"
            className="absolute top-3 left-3 z-20 flex items-center justify-center w-9 h-9 rounded-full
                       bg-slate-900/80 hover:bg-red-500 text-amber-100 hover:text-white border border-amber-300/60 shadow-lg
                       transition-all duration-200 hover:scale-110 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>

          {/* הבאנר עצמו — חותכים את השוליים הריקים למעלה ולמטה (התמונה 1400×800, התוכן באמצע) */}
          <div className="overflow-hidden" style={{ aspectRatio: '1400 / 560' }}>
            <img src="/quiz/banner.webp" width="1400" height="800" className="w-full h-full object-cover block"
              alt="שולם בליינד — קלפי הטריוויה של PokerIsrael.org. הידע שלך. הצ'יפים שלך." />
          </div>

          <div className="px-5 pb-5 pt-1 sm:px-8 sm:pb-7 text-center">
            <p className="text-xs font-bold tracking-wide text-amber-300">🆕 חדש באתר — השעשועון של קהילת הפוקר</p>
            <h2 id="quiz-launch-title" className="mt-1 text-xl sm:text-2xl font-black text-white leading-snug">
              חושבים שאתם יודעים פוקר? <span className="text-sky-300">שימו צ'יפים על זה.</span>
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              מתחילים עם 1,000 צ'יפים, רואים את הנושא והקושי — ומחליטים כמה להמר.
              <br className="hidden sm:block" /> סט יומי, לפי נושא, נגד השעון וטבלאות מובילים.
            </p>
            <p className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold text-slate-900" style={{ background: '#fbbf24' }}>
              חינם · בלי כסף אמיתי · הצ'יפים וירטואליים
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-center">
              <button onClick={play} className="btn-gold min-h-[44px] px-8 text-base">🎲 לשחק עכשיו</button>
              <button onClick={() => setRules(true)}
                className="min-h-[44px] px-6 rounded-xl border text-sm font-bold text-sky-200 hover:bg-white/5 transition-colors"
                style={{ borderColor: 'rgba(56,189,248,0.45)' }}>
                📖 איך משחקים?
              </button>
            </div>
          </div>
        </div>
      </div>
      {rules && <QuizRulesModal onClose={() => setRules(false)} />}
    </>,
    document.body
  );
}
