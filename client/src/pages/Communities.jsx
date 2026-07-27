import { useState } from 'react';
import { COMMUNITIES } from '../data/communities';

function WhatsappIcon(props) {
  return (
    <svg viewBox="0 0 448 512" fill="currentColor" {...props}>
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224-99.6 224-222 0-59.3-25.2-115-67-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.3-63.3-28.3-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.5 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
    </svg>
  );
}

function TelegramIcon(props) {
  return (
    <svg viewBox="0 0 496 512" fill="currentColor" {...props}>
      <path d="M248,8C111.033,8,0,119.033,0,256S111.033,504,248,504,496,392.967,496,256,384.967,8,248,8ZM362.952,176.66c-3.732,39.215-19.881,134.378-28.1,178.3-3.476,18.584-10.322,24.816-16.948,25.425-14.4,1.328-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25,5.343-39.5,3.65-3.793,67.108-61.51,68.335-66.746.153-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608,69.142-14.845,10.194-26.894,9.938c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7,18.45-13.7,108.446-47.248,144.628-62.3c68.872-28.647,83.183-33.623,92.511-33.789,2.052-.034,6.639.474,9.61,2.885a10.452,10.452,0,0,1,3.53,6.716A43.765,43.765,0,0,1,362.952,176.66Z" />
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.061C22 6.505 17.523 2 12 2S2 6.505 2 12.061c0 5.022 3.657 9.184 8.438 9.939v-7.03H7.898v-2.909h2.54V9.845c0-2.522 1.492-3.915 3.777-3.915 1.094 0 2.238.196 2.238.196v2.476h-1.26c-1.243 0-1.63.775-1.63 1.57v1.889h2.773l-.443 2.909h-2.33V22c4.78-.755 8.437-4.917 8.437-9.939z" />
    </svg>
  );
}

function YoutubeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const TYPE_META = {
  whatsapp: {
    title: 'קבוצות וואטסאפ',
    Icon: WhatsappIcon,
    color: '#25D366',
    cta: 'הצטרפות לקבוצה',
  },
  telegram: {
    title: 'טלגרם',
    Icon: TelegramIcon,
    color: '#26A5E4',
    cta: 'הצטרפות',
  },
  facebook: {
    title: 'קבוצות פייסבוק',
    Icon: FacebookIcon,
    color: '#1877F2',
    cta: 'הצטרפות לקבוצה',
  },
  youtube: {
    title: 'ערוצי יוטיוב',
    Icon: YoutubeIcon,
    color: '#FF0000',
    cta: 'צפייה בערוץ',
  },
};

function CommunityAvatar({ community, Icon, color }) {
  const [imgError, setImgError] = useState(false);

  if (community.logo && !imgError) {
    return (
      <img
        src={community.logo}
        alt={community.name}
        onError={() => setImgError(true)}
        className="w-11 h-11 rounded-xl object-cover border border-slate-700 shrink-0"
      />
    );
  }
  return (
    <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700"
      style={{ color }}>
      <Icon className="w-5 h-5" />
    </span>
  );
}

function CommunityCard({ community }) {
  const meta = TYPE_META[community.type];
  if (!meta) return null;
  const { Icon, color } = meta;
  const cta = community.cta || meta.cta;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-3"
      style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-start gap-3">
        <CommunityAvatar community={community} Icon={Icon} color={color} />
        <h3 className="text-base font-black text-white min-w-0">{community.name}</h3>
      </div>

      {community.description && (
        <p className="text-sm text-slate-400 flex-1">{community.description}</p>
      )}

      <a href={community.url} target="_blank" rel="noopener noreferrer"
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: color }}>
        <Icon className="w-4 h-4" />
        {cta}
      </a>
    </div>
  );
}

function CommunitySection({ type }) {
  const items = COMMUNITIES.filter(c => c.type === type);
  if (items.length === 0) return null;
  const meta = TYPE_META[type];

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-black text-white">
        <meta.Icon className="w-5 h-5" style={{ color: meta.color }} />
        {meta.title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map(c => <CommunityCard key={c.id} community={c} />)}
      </div>
    </section>
  );
}

export default function Communities() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {/* Header */}
      <div className="border-b border-blue-500/20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 py-10 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">קהילות</h1>
          <p className="text-slate-400 text-sm">הצטרפו לקהילות הפוקר הכי פעילות בישראל — וואטסאפ, טלגרם, פייסבוק ויוטיוב</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {COMMUNITIES.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center text-slate-500 text-sm">
            👥 הקהילות יופיעו כאן בקרוב
          </div>
        ) : (
          <>
            <CommunitySection type="whatsapp" />
            <CommunitySection type="telegram" />
            <CommunitySection type="facebook" />
            <CommunitySection type="youtube" />
          </>
        )}
      </div>
    </div>
  );
}
