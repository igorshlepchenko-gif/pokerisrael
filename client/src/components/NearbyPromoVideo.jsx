import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * סרטון הסבר קצר לפיצ'ר "מצא טורניר קרוב אליי".
 *
 * preload="none" בכוונה: הסרטון ~2MB, ורוב המבקרים לא ילחצו עליו. טעינה
 * אוטומטית בעמוד הבית הייתה עולה חבילת גלישה לכל כניסה במובייל בלי תמורה.
 * הבייטים יורדים רק אחרי לחיצה מפורשת.
 */
export default function NearbyPromoVideo({ src = '/video/nearby-promo.mp4' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-xs font-semibold
          border border-slate-600 hover:border-slate-400 rounded-full px-3 min-h-[36px] transition-all"
      >
        ▶️ איך זה עובד
      </button>
      {open && <VideoModal src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

function VideoModal({ src, onClose }) {
  const videoRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => { closeRef.current?.focus(); }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="סרטון הסבר — מצא טורניר קרוב אליי"
      className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl">
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="סגור"
          className="absolute -top-11 left-0 flex items-center justify-center w-9 h-9 rounded-full bg-slate-700 hover:bg-red-500/80 text-slate-200 hover:text-white transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          playsInline
          className="w-full rounded-2xl shadow-2xl bg-black max-h-[80vh]"
        />
      </div>
    </div>,
    document.body
  );
}
