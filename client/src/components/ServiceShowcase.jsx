import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LESSONS } from '../data/lessons';
import { COMMUNITIES } from '../data/communities';
import { PODCASTS, getSpotifyEmbedUrl } from '../data/podcasts';

const ROTATE_MS = 6000;
const LESSON_ACCENT = '#f59e0b';
const TYPE_ACCENT = { whatsapp: '#25D366', telegram: '#26A5E4', facebook: '#1877F2', youtube: '#FF0000' };
const TYPE_EMOJI  = { whatsapp: '💬', telegram: '✈️', facebook: '📘', youtube: '▶️' };
const TYPE_LABEL  = { whatsapp: 'קהילת וואטסאפ', telegram: 'קהילת טלגרם', facebook: 'קבוצת פייסבוק', youtube: 'ערוץ יוטיוב' };

// שואב אוטומטית מכל מקורות התוכן באתר — כל קורס/קהילה/פודקאסט שקיים כרגע
// (וכל דבר עתידי שיתווסף) מופיע כאן בלי צורך לעדכן את הרכיב הזה בנפרד.
function buildSlides() {
  const lessonSlides = LESSONS.map(l => ({
    image: l.logo || null,
    logoFit: l.logoFit,
    emoji: '🎓',
    title: l.name,
    subtitle: '🎓 לימודי פוקר',
    to: '/lessons',
    accent: LESSON_ACCENT,
  }));

  const communitySlides = COMMUNITIES.map(c => ({
    image: c.logo || null,
    logoFit: c.logoFit,
    emoji: TYPE_EMOJI[c.type] || '👥',
    title: c.name,
    subtitle: `👥 ${TYPE_LABEL[c.type] || 'קהילה'}`,
    to: '/communities',
    accent: TYPE_ACCENT[c.type] || '#60a5fa',
    // ערוץ יוטיוב — אפשר לצפות ישירות מהקרוסלה, לא רק לנווט לעמוד הקהילות
    playExternal: c.type === 'youtube' ? c.url : null,
    playLabel: c.type === 'youtube' ? 'צפייה בערוץ' : null,
  }));

  const podcastSlides = PODCASTS.map(p => ({
    image: p.logo || null,
    emoji: p.emoji || '🎙️',
    title: p.name,
    subtitle: '🎙️ פודקאסטים',
    to: '/podcasts',
    accent: p.color || '#a855f7',
    // פודקאסט — הפעלת נגן ספוטיפיי מוטמע ישירות בשקופית
    playEmbed: getSpotifyEmbedUrl(p.spotifyUrl),
    playLabel: 'האזנה',
  }));

  const handLoggerSlide = {
    emoji: '🃏',
    title: 'רישום ידיים מקצועי',
    subtitle: '🎬 תעדו וקבלו ניתוח לכל יד',
    to: '/hands',
    accent: '#22d3ee',
  };

  return [...lessonSlides, ...communitySlides, ...podcastSlides, handLoggerSlide];
}

const SLIDES = buildSlides();

function SlideImage({ slide }) {
  const [failed, setFailed] = useState(false);
  if (slide.image && !failed) {
    return (
      <img
        src={slide.image}
        alt=""
        onError={() => setFailed(true)}
        className={`w-full h-full ${slide.logoFit === 'cover' ? 'object-cover' : 'object-contain'} transition-transform duration-[6000ms] ease-linear group-hover:scale-105`}
        style={slide.logoFit !== 'cover' ? { backgroundColor: '#0f172a' } : undefined}
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center text-7xl"
      style={{ background: `linear-gradient(135deg, ${slide.accent}33, #0f172a)` }}>
      {slide.emoji}
    </div>
  );
}

export default function ServiceShowcase() {
  const [index, setIndex] = useState(0);
  const [playingEmbed, setPlayingEmbed] = useState(false);
  const pausedRef = useRef(false);
  const navigate = useNavigate();
  const total = SLIDES.length;

  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current && !playingEmbed) setIndex(i => (i + 1) % total);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [total, playingEmbed]);

  // מעבר שקופית סוגר נגן פתוח
  useEffect(() => { setPlayingEmbed(false); }, [index]);

  if (total === 0) return null;
  const current = SLIDES[index];
  const go = (to) => navigate(to);

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (current.playEmbed) setPlayingEmbed(true);
    else if (current.playExternal) window.open(current.playExternal, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="relative w-full max-w-[380px] mx-auto rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-2xl cursor-pointer group"
      style={{ aspectRatio: '4 / 3' }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onClick={() => { if (!playingEmbed) go(current.to); }}
      onKeyDown={(e) => { if (!playingEmbed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(current.to); } }}
      role="button"
      tabIndex={0}
      aria-label={`${current.title} — מעבר לעמוד`}
    >
      {playingEmbed && current.playEmbed ? (
        <div className="absolute inset-0 z-20 bg-slate-950" onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label="סגור נגן"
            onClick={() => setPlayingEmbed(false)}
            className="absolute top-2 left-2 z-30 w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-sm">
            ✕
          </button>
          <iframe
            title={`${current.title} — Spotify`}
            src={current.playEmbed}
            width="100%"
            height="100%"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      ) : (
        SLIDES.map((s, i) => (
          <div key={i}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <SlideImage slide={s} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-transparent" />

            {(s.playEmbed || s.playExternal) && i === index && (
              <button type="button" onClick={handlePlayClick}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center text-xl shadow-xl transition-transform hover:scale-110"
                style={{ top: '30%' }}
                aria-label={s.playLabel}>
                ▶
              </button>
            )}

            <div className="absolute bottom-0 inset-x-0 p-5">
              <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: s.accent }}>{s.subtitle}</p>
              <h3 className="text-lg font-black text-white leading-snug line-clamp-2">{s.title}</h3>
            </div>
          </div>
        ))
      )}

      {/* חצי ניווט ידני */}
      {!playingEmbed && (
        <>
          <button type="button" aria-label="הקודם"
            onClick={(e) => { e.stopPropagation(); setIndex(i => (i - 1 + total) % total); }}
            className="absolute top-1/2 -translate-y-1/2 right-2 z-10 w-8 h-8 rounded-full bg-slate-950/50 hover:bg-slate-950/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            ‹
          </button>
          <button type="button" aria-label="הבא"
            onClick={(e) => { e.stopPropagation(); setIndex(i => (i + 1) % total); }}
            className="absolute top-1/2 -translate-y-1/2 left-2 z-10 w-8 h-8 rounded-full bg-slate-950/50 hover:bg-slate-950/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            ›
          </button>

          {/* פס התקדמות — בלי מספור שקופיות */}
          <div className="absolute top-0 inset-x-0 z-10 p-3">
            <div className="h-1 rounded-full bg-white/20 overflow-hidden">
              <div key={index} className="h-full bg-white/90 rounded-full animate-showcase-progress" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
