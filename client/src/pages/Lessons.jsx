import { useState, useEffect } from 'react';
import { LESSONS } from '../data/lessons';
import { useAuth } from '../context/AuthContext';
import { logInquiry } from '../utils/api';

const ACCENT = '#f59e0b';
const DEFAULT_CTA = 'לפרטים נוספים';

// מוצג רק כשהמשתמש אינו מחובר — כמו RegistrationModal, כדי שפנייה של אורח
// תירשם עם שם אמיתי ולא רק "אנונימי"
function LessonContactModal({ lesson, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), phone.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="lesson-contact-modal-title"
         onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 id="lesson-contact-modal-title" className="font-black text-white text-lg">השאירו פרטים</h3>
            <p className="text-poker-green-light text-sm font-semibold truncate max-w-[220px]">{lesson.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-red-500/80 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">שם מלא *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field"
              placeholder="ישראל ישראלי"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">
              מספר טלפון <span className="text-slate-500 font-normal">(אופציונלי)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="input-field"
              placeholder="050-0000000"
              dir="ltr"
            />
          </div>

          <p className="text-xs text-slate-500 bg-slate-900/40 rounded-lg px-3 py-2">
            📋 הפרטים שלך יעזרו לנו לעקוב אחרי הפנייה.
            <br />
            <span className="text-slate-600">רוצה שהפרטים יישמרו? <a href="/login" className="text-poker-green-light hover:underline">התחבר</a> או <a href="/register" className="text-poker-green-light hover:underline">הירשם</a> למערכת.</span>
          </p>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-poker-gold disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-95 text-base shadow-lg"
          >
            {lesson.cta || DEFAULT_CTA}
          </button>
        </form>
      </div>
    </div>
  );
}

function LessonAvatar({ lesson }) {
  const [imgError, setImgError] = useState(false);

  if (lesson.logo && !imgError) {
    const fit = lesson.logoFit === 'cover' ? 'object-cover' : 'object-contain';
    const size = lesson.logoWide ? 'h-11 w-auto max-w-[11rem]' : 'w-11 h-11';
    return (
      <img
        src={lesson.logo}
        alt={lesson.name}
        onError={() => setImgError(true)}
        className={`${size} rounded-xl ${fit} bg-slate-800 border border-slate-700 shrink-0`}
      />
    );
  }
  return (
    <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-xl">
      🎓
    </span>
  );
}

function LessonDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 140;

  return (
    <div className="flex-1">
      <p className={`text-sm text-slate-400 whitespace-pre-line ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1 text-xs font-bold text-slate-400 hover:text-poker-gold transition-colors"
        >
          {expanded ? 'הצג פחות' : 'קרא עוד'}
        </button>
      )}
    </div>
  );
}

function LessonCard({ lesson }) {
  const cta = lesson.cta || DEFAULT_CTA;
  const { user } = useAuth();
  const [showContactModal, setShowContactModal] = useState(false);

  // לוג פנייה יורה-ושכח (sendBeacon), נקרא ממש לפני window.open — אותו דפוס
  // בדיוק כמו הרשמה לטורניר (ראה utils/api.js: logRegistration/logInquiry)
  const submitContact = (name, phone) => {
    logInquiry({
      lesson_id:      lesson.id,
      lesson_name:    lesson.name,
      inquirer_name:  name || 'אנונימי',
      inquirer_phone: phone || null,
      user_id:        user?.id || null,
    });
    window.open(lesson.url, '_blank', 'noopener,noreferrer');
  };

  // מחובר — ישר עם הפרטים מהמערכת, כמו הרשמה לטורניר. לא מחובר — חלון הזנת
  // פרטים קודם, כדי שהפנייה תירשם עם שם אמיתי ולא רק "אנונימי"
  const handleContact = () => {
    if (user) {
      submitContact(user.name, user.phone);
    } else {
      setShowContactModal(true);
    }
  };

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-3 transition-all duration-300 hover:border-slate-600 hover:shadow-2xl hover:shadow-poker-green/10"
      style={{ borderTop: `3px solid ${ACCENT}` }}>
      {lesson.badge && (
        <div className="absolute -top-3 -left-3 z-10 -rotate-6">
          <span className="inline-block px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black shadow-lg border-2 border-slate-950 whitespace-nowrap">
            {lesson.badge}
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <LessonAvatar lesson={lesson} />
        <h3 className="text-base font-black text-white min-w-0">{lesson.name}</h3>
      </div>

      {lesson.highlight && (
        <div className="flex items-center gap-2 rounded-lg bg-poker-gold/10 border border-poker-gold/30 px-3 py-2 text-sm font-bold text-poker-gold">
          <span>📅</span>
          <span>{lesson.highlight}</span>
        </div>
      )}

      {lesson.description && <LessonDescription text={lesson.description} />}

      <button onClick={handleContact}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white bg-poker-gold transition-opacity hover:opacity-90">
        {cta}
      </button>

      {lesson.secondaryUrl && (
        <a href={lesson.secondaryUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border border-poker-gold text-poker-gold transition-colors hover:bg-slate-800">
          {lesson.secondaryCta || 'לאתר'}
        </a>
      )}

      {showContactModal && (
        <LessonContactModal
          lesson={lesson}
          onClose={() => setShowContactModal(false)}
          onSubmit={(name, phone) => { setShowContactModal(false); submitContact(name, phone); }}
        />
      )}
    </div>
  );
}

export default function Lessons() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-2">
        <div className="always-dark relative overflow-hidden rounded-3xl border border-blue-500/20 bg-hero-gradient">
          {/* Ambient glow orbs */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            <div className="absolute -top-10 right-10 w-48 h-48 rounded-full opacity-[0.15]"
              style={{ background: 'radial-gradient(circle, #1d4ed8, transparent)' }} />
            <div className="absolute -bottom-10 left-10 w-40 h-40 rounded-full opacity-[0.12]"
              style={{ background: 'radial-gradient(circle, #22d3ee, transparent)' }} />
          </div>

          <div className="relative px-6 py-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl bg-poker-green/10 border border-poker-green/25">
              🎓
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
              לימודי{' '}
              <span style={{
                background: 'linear-gradient(135deg, #60a5fa, #22d3ee)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                פוקר
              </span>
            </h1>
            <p className="text-slate-400 text-sm">קורסים, מאמנים ותוכניות הכשרה לשיפור המשחק שלכם</p>
            {LESSONS.length > 0 && (
              <p className="mt-4 text-xs text-slate-500">
                <span className="font-mono tabular-nums font-bold text-poker-green-light">{LESSONS.length}</span> תוכניות זמינות כרגע
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {LESSONS.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center text-slate-500 text-sm">
            🎓 הקורסים יופיעו כאן בקרוב
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LESSONS.map(l => <LessonCard key={l.id} lesson={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
