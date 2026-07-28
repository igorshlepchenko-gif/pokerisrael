import { useState } from 'react';
import { LESSONS } from '../data/lessons';

const ACCENT = '#f59e0b';
const DEFAULT_CTA = 'לפרטים נוספים';

function LessonAvatar({ lesson }) {
  const [imgError, setImgError] = useState(false);

  if (lesson.logo && !imgError) {
    return (
      <img
        src={lesson.logo}
        alt={lesson.name}
        onError={() => setImgError(true)}
        className="w-11 h-11 rounded-xl object-contain bg-slate-800 border border-slate-700 shrink-0"
      />
    );
  }
  return (
    <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-xl">
      🎓
    </span>
  );
}

function LessonCard({ lesson }) {
  const cta = lesson.cta || DEFAULT_CTA;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-3 transition-all duration-300 hover:border-slate-600 hover:shadow-2xl hover:shadow-poker-green/10"
      style={{ borderTop: `3px solid ${ACCENT}` }}>
      <div className="flex items-start gap-3">
        <LessonAvatar lesson={lesson} />
        <h3 className="text-base font-black text-white min-w-0">{lesson.name}</h3>
      </div>

      {lesson.description && (
        <p className="text-sm text-slate-400 flex-1">{lesson.description}</p>
      )}

      <a href={lesson.url} target="_blank" rel="noopener noreferrer"
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white bg-poker-gold transition-opacity hover:opacity-90">
        {cta}
      </a>

      {lesson.secondaryUrl && (
        <a href={lesson.secondaryUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border border-poker-gold text-poker-gold transition-colors hover:bg-slate-800">
          {lesson.secondaryCta || 'לאתר'}
        </a>
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
