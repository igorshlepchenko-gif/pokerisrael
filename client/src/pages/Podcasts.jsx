import { useState } from 'react';
import { PODCASTS, getSpotifyEmbedUrl } from '../data/podcasts';

function SpotifyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.061C22 6.505 17.523 2 12 2S2 6.505 2 12.061c0 5.022 3.657 9.184 8.438 9.939v-7.03H7.898v-2.909h2.54V9.845c0-2.522 1.492-3.915 3.777-3.915 1.094 0 2.238.196 2.238.196v2.476h-1.26c-1.243 0-1.63.775-1.63 1.57v1.889h2.773l-.443 2.909h-2.33V22c4.78-.755 8.437-4.917 8.437-9.939z"/>
    </svg>
  );
}

function YoutubeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

const LINKS = [
  { key: 'spotifyUrl', label: 'Spotify', Icon: SpotifyIcon, hoverClass: 'hover:text-[#1DB954] hover:border-[#1DB954]/40' },
  { key: 'instagramUrl', label: 'Instagram', Icon: InstagramIcon, hoverClass: 'hover:text-[#E1306C] hover:border-[#E1306C]/40' },
  { key: 'facebookUrl', label: 'Facebook', Icon: FacebookIcon, hoverClass: 'hover:text-[#1877F2] hover:border-[#1877F2]/40' },
  { key: 'youtubeUrl', label: 'YouTube', Icon: YoutubeIcon, hoverClass: 'hover:text-[#FF0000] hover:border-[#FF0000]/40' },
];

function PodcastAvatar({ podcast }) {
  const [imgError, setImgError] = useState(false);

  if (podcast.logo && !imgError) {
    return (
      <img
        src={podcast.logo}
        alt={podcast.name}
        onError={() => setImgError(true)}
        className="h-12 w-auto max-w-[180px] rounded-xl object-contain border border-slate-700 shrink-0"
      />
    );
  }
  return (
    <span className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-slate-800 border border-slate-700 shrink-0">
      {podcast.emoji}
    </span>
  );
}

function PodcastCard({ podcast }) {
  const embedUrl = getSpotifyEmbedUrl(podcast.spotifyUrl);
  const activeLinks = LINKS.filter(l => podcast[l.key]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-800"
        style={{ borderTop: `3px solid ${podcast.color}` }}>
        <div className="flex items-center gap-3 min-w-0">
          <PodcastAvatar podcast={podcast} />
          <h2 className="text-lg font-black text-white truncate">{podcast.name}</h2>
        </div>

        {activeLinks.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {activeLinks.map(({ key, label, Icon, hoverClass }) => (
              <a key={key} href={podcast[key]} target="_blank" rel="noopener noreferrer" title={label}
                className={`w-9 h-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-all ${hoverClass}`}>
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Spotify embed / placeholder */}
      <div className="p-5">
        {embedUrl ? (
          <div className="rounded-xl overflow-hidden">
            <iframe
              title={`${podcast.name} — Spotify`}
              src={embedUrl}
              width="100%"
              height="352"
              style={{ borderRadius: 12 }}
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-slate-500 text-sm">
            🎧 הפרקים יופיעו כאן בקרוב
          </div>
        )}
      </div>
    </div>
  );
}

export default function Podcasts() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {/* Header */}
      <div className="border-b border-blue-500/20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 py-10 text-center">
          <div className="text-4xl mb-3">🎙️</div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">פודקאסטים</h1>
          <p className="text-slate-400 text-sm">האזינו לפודקאסטים המובילים על פוקר בישראל — ישירות כאן, בלי לצאת מהאתר</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {PODCASTS.map(podcast => (
          <PodcastCard key={podcast.id} podcast={podcast} />
        ))}

        <p className="text-center text-xs text-slate-600 pt-2">
          🎧 ניגון בתוך האתר מוגבל ל-30 שניות לתצוגה מקדימה (מגבלת Spotify למאזינים ללא Premium מחובר) — ללחוצים על סמל ה-Spotify, הפרק המלא נפתח באפליקציה.
        </p>
      </div>
    </div>
  );
}
