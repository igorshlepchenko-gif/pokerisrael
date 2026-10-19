import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ACTIVE_CLUBS, ONLINE_ENABLED, STORE_LINKS, AGENT, SEVEN_XL, JOIN_VIDEO_URL,
  GAMBLING_HELP_URL, STAKE_LEVELS, waLink, agentFor, agentNumberFor,
} from '../data/onlineClubs';
import PromoCarousel from '../components/PromoCarousel';
import { useAuth } from '../context/AuthContext';
import { useOnlineVisible, ONLINE_ADMIN_ONLY } from '../utils/onlineAccess';
import { logOnlineClick } from '../utils/api';
import { shuffleArray } from '../utils/shuffle';

const ACCENT = '#7c3aed';

// זיהוי מכשיר — כדי להבליט את כפתור החנות הנכון (אייפד חדש מתחזה ל-Mac, לכן גם בדיקת מגע)
function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

function CopyField({ label, value, onCopied }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // דפדפן ישן / הקשר לא מאובטח — נפילה לבחירת טקסט ידנית
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" onClick={copy}
      className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 min-h-[44px] hover:border-violet-500 transition-colors">
      <span className="text-right">
        <span className="block text-[11px] text-slate-500">{label}</span>
        <span className="block font-mono tabular-nums font-bold text-white" dir="ltr">{value}</span>
      </span>
      <span className={`text-xs font-bold shrink-0 ${copied ? 'text-green-400' : 'text-violet-300'}`}>
        {copied ? '✓ הועתק' : '📋 העתק'}
      </span>
    </button>
  );
}

// תיאור קלאב — טקסט ארוך מקוצר ל-3 שורות עם "קרא עוד" (אותו דפוס כמו LessonDescription)
function ClubNote({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 140 || text.split('\n').length > 3;
  return (
    <div>
      <p className={`text-slate-400 whitespace-pre-line ${!expanded && isLong ? 'line-clamp-3' : ''}`}>{text}</p>
      {isLong && (
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="mt-1 text-xs font-bold text-slate-400 hover:text-violet-300 transition-colors">
          {expanded ? 'הצג פחות' : 'קרא עוד'}
        </button>
      )}
    </div>
  );
}

function ClubCard({ club }) {
  const agent = agentFor(club);
  const agentNumber = agentNumberFor(club);
  const hasNumbers = club.clubNumber && agentNumber;
  return (
    <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-3"
      style={{ borderTop: `3px solid ${ACCENT}` }}>
      {club.sample && (
        <span className="absolute -top-3 -left-2 -rotate-6 px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-black">
          דוגמה בלבד
        </span>
      )}
      <div className="flex items-start gap-3">
        {club.logo ? (
          <img src={club.logo} alt={club.name} className="w-11 h-11 rounded-xl object-contain bg-slate-800 border border-slate-700 shrink-0" />
        ) : (
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/10 border border-violet-500/30 text-xl">♠️</span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-black text-white">{club.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {club.games?.map(g => (
              <span key={g} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-200 border border-violet-500/30">{g}</span>
            ))}
          </div>
        </div>
      </div>

      <dl className="text-sm text-slate-400 space-y-1">
        {club.stakes && <div><dt className="inline text-slate-500">גובה משחק: </dt><dd className="inline tabular-nums text-slate-300">{club.stakes}</dd></div>}
        {club.hours && <div><dt className="inline text-slate-500">שעות פעילות: </dt><dd className="inline text-slate-300">{club.hours}</dd></div>}
        {club.note && <ClubNote text={club.note} />}
      </dl>

      {hasNumbers ? (
        <div className="mt-auto flex gap-2">
          <CopyField label="מספר מועדון" value={club.clubNumber} onCopied={() => logOnlineClick('copy_club', club.id, 'online_page')} />
          <CopyField label="מספר סוכן" value={agentNumber} onCopied={() => logOnlineClick('copy_agent', club.id, 'online_page')} />
        </div>
      ) : (
        <p className="mt-auto rounded-xl border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400 text-center">
          את מספר המועדון ומספר הסוכן מקבלים מהסוכן {agent.name} בוואטסאפ
        </p>
      )}

      <a href={waLink(`שלום ${agent.name}, הגעתי מאתר פוקר ישראל ואני רוצה להצטרף לקלאב ${club.name}${club.clubNumber ? ` (${club.clubNumber})` : ''}`, agent.whatsapp)}
        target="_blank" rel="noopener noreferrer"
        onClick={() => logOnlineClick('whatsapp', club.id, 'online_page')}
        className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1da851] transition-colors">
        💬 להצטרפות — דברו עם {agent.name}
      </a>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="w-8 h-8 shrink-0 rounded-full bg-violet-600 text-white font-black flex items-center justify-center">{n}</span>
      <div className="min-w-0 pt-1">
        <h3 className="font-bold text-white">{title}</h3>
        <div className="text-sm text-slate-400 mt-1">{children}</div>
      </div>
    </li>
  );
}

function StoreButtons({ platform }) {
  const btn = (key, label, icon) => {
    const highlighted = platform === key;
    return (
      <a href={STORE_LINKS[key]} target="_blank" rel="noopener noreferrer"
        onClick={() => logOnlineClick(`store_${key}`, null, 'online_page')}
        className={`flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-bold transition-all ${
          highlighted
            ? 'bg-violet-600 text-white shadow-[0_0_14px_rgba(124,58,237,0.55)] hover:scale-105'
            : 'border border-slate-600 text-slate-200 hover:border-violet-400'
        }`}>
        <span>{icon}</span>{label}{highlighted && <span className="text-[11px] font-normal opacity-80">(המכשיר שלך)</span>}
      </a>
    );
  };
  // המכשיר של המשתמש ראשון
  const order = platform === 'android' ? ['android', 'ios'] : ['ios', 'android'];
  const meta = { ios: ['App Store', ''], android: ['Google Play', '▶'] };
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {order.map(k => <span key={k}>{btn(k, meta[k][0], meta[k][1])}</span>)}
    </div>
  );
}

export default function OnlinePoker() {
  const { loading } = useAuth() || {};
  const visible = useOnlineVisible();
  // מחכים שהמשתמש ייטען — אחרת גם האדמין היה מופנה החוצה לפני שהמערכת יודעת מי הוא
  if (loading) return null;
  // אין קלאבים פעילים, או שלב בדיקה ומי שגולש אינו אדמין — לא מציגים את העמוד
  if (!ONLINE_ENABLED || !visible) return <Navigate to="/" replace />;
  return <OnlinePokerPage />;
}

function OnlinePokerPage() {
  const [platform] = useState(detectPlatform);
  const [clubs] = useState(() => shuffleArray(ACTIVE_CLUBS));
  const [game, setGame] = useState(null);
  const [level, setLevel] = useState(null);

  const games = useMemo(() => [...new Set(clubs.flatMap(c => c.games || []))], [clubs]);
  const filtered = clubs.filter(c =>
    (!game || c.games?.includes(game)) && (!level || c.levels?.includes(level)));

  const chip = (active) => `px-3 min-h-[36px] rounded-full text-sm font-bold border transition-colors ${
    active ? 'bg-violet-600 border-violet-500 text-white' : 'border-slate-700 text-slate-300 hover:border-violet-400'}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {ONLINE_ADMIN_ONLY && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 text-amber-200 text-sm font-bold text-center px-4 py-2">
          👁️ תצוגת מנהל בלבד — העמוד והפרסומים לא גלויים לגולשים עדיין
        </div>
      )}
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-2">
        <div className="always-dark relative overflow-hidden rounded-3xl border border-violet-500/25 bg-hero-gradient">
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            <div className="absolute -top-10 right-10 w-48 h-48 rounded-full opacity-[0.18]"
              style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
            <div className="absolute -bottom-10 left-10 w-40 h-40 rounded-full opacity-[0.12]"
              style={{ background: 'radial-gradient(circle, #22d3ee, transparent)' }} />
          </div>
          <div className="relative px-6 py-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl bg-violet-500/10 border border-violet-500/30">🌐</div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
              פוקר{' '}
              <span style={{
                background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>אונליין</span>
            </h1>
            <p className="text-slate-300 text-sm max-w-lg mx-auto">
              אנחנו מפנים אתכם לסוכן שפעיל במגוון קלאבים ב-ClubGG וב-7XL — כך תמיד יש שולחן בגובה שמתאים לכם, עם ליווי אישי בוואטסאפ.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              <span className="font-mono tabular-nums font-bold text-violet-300">{clubs.length}</span> קלאבים זמינים · 18+ בלבד
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* פרסומי הקלאבים — לחיצה פותחת וואטסאפ לסוכן עם שם הפרסום */}
        <PromoCarousel source="online_page" className="max-w-md mx-auto"
          hrefFor={(promo) => waLink(`שלום ${AGENT.name}, הגעתי מאתר פוקר ישראל בעקבות הפרסום: ${promo.alt}`)} />

        {/* הסוכן */}
        <section aria-labelledby="agent-title" className="rounded-2xl border border-violet-500/40 bg-violet-950/30 p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-violet-500/15 border border-violet-500/40 flex items-center justify-center text-3xl" aria-hidden="true">🐼</span>
          <div className="flex-1 min-w-0">
            <h2 id="agent-title" className="font-black text-white text-lg">הסוכן: {AGENT.name}</h2>
            <p className="text-sm text-slate-400">ההצטרפות לכל הקלאבים ול-7XL עוברת דרכו — הוא מאשר אתכם, עוזר בהתקנה ועונה על שאלות.</p>
          </div>
          <a href={waLink(`שלום ${AGENT.name}, הגעתי מאתר פוקר ישראל ואשמח לעזרה בהצטרפות`)}
            target="_blank" rel="noopener noreferrer"
            onClick={() => logOnlineClick('whatsapp', null, 'online_page_agent')}
            className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1da851] transition-colors">
            💬 וואטסאפ ל{AGENT.name}
          </a>
        </section>

        {/* מדריך הצטרפות */}
        <section aria-labelledby="join-title" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
          <h2 id="join-title" className="text-xl font-black text-white mb-5">איך מצטרפים — 4 שלבים</h2>
          {JOIN_VIDEO_URL && (
            <video src={JOIN_VIDEO_URL} controls playsInline preload="metadata"
              onPlay={() => logOnlineClick('video_play', null, 'online_page')}
              className="w-full max-w-xs mx-auto mb-6 rounded-2xl border border-slate-700 bg-black" />
          )}
          <ol className="space-y-5">
            <Step n="1" title="מורידים את ClubGG">
              האפליקציה חינמית, לאייפון ולאנדרואיד.
              <StoreButtons platform={platform} />
            </Step>
            <Step n="2" title="נרשמים לאפליקציה">יוצרים חשבון חדש באפליקציה (לוקח דקה).</Step>
            <Step n="3" title="מצטרפים לקלאב">
              בוחרים קלאב מהרשימה למטה, לוחצים באפליקציה על הצטרפות לקלאב, ומזינים את <b className="text-slate-200">מספר המועדון</b> ואת <b className="text-slate-200">מספר הסוכן</b> (כפתור "העתק" ליד כל מספר).
            </Step>
            <Step n="4" title="מקבלים אישור ומתחילים לשחק">
              שולחים הודעה לסוכן {AGENT.name} בוואטסאפ והוא מאשר אתכם מהר. <a href={waLink(`שלום ${AGENT.name}, הגעתי מאתר פוקר ישראל ואשמח לעזרה בהצטרפות לקלאב`)} target="_blank" rel="noopener noreferrer" onClick={() => logOnlineClick('whatsapp', null, 'online_page_help')} className="text-violet-300 font-bold hover:underline">תקועים? דברו עם {AGENT.name}</a>
            </Step>
          </ol>
        </section>

        {/* רשימת קלאבים */}
        <section aria-labelledby="clubs-title">
          <h2 id="clubs-title" className="text-xl font-black text-white mb-3">בחרו קלאב</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" className={chip(!game)} onClick={() => setGame(null)}>כל המשחקים</button>
            {games.map(g => <button key={g} type="button" className={chip(game === g)} onClick={() => setGame(game === g ? null : g)}>{g}</button>)}
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            <button type="button" className={chip(!level)} onClick={() => setLevel(null)}>כל הגבהים</button>
            {STAKE_LEVELS.map(l => <button key={l.key} type="button" className={chip(level === l.key)} onClick={() => setLevel(level === l.key ? null : l.key)}>{l.label}</button>)}
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-slate-500 text-sm">
              אין קלאב שמתאים לסינון הזה — נסו לשנות אותו
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(c => <ClubCard key={c.id} club={c} />)}
            </div>
          )}
        </section>

        {/* 7XL — רשת GG, לא קלאב */}
        <section aria-labelledby="sevenxl-title" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" style={{ borderTop: `3px solid ${ACCENT}` }}>
          <div className="flex items-center gap-3 mb-2">
            <img src={SEVEN_XL.logo} alt="7XL" className="w-16 h-12 shrink-0 rounded-xl object-contain bg-black border border-slate-700" />
            <div>
              <h2 id="sevenxl-title" className="text-xl font-black text-white">{SEVEN_XL.name}</h2>
              <p className="text-xs text-slate-500">אתר פוקר ברשת GG — לא קלאב</p>
            </div>
          </div>
          <ol className="text-sm text-slate-400 space-y-1.5 list-decimal pr-5 mb-4">
            <li>מורידים את האפליקציה (קישור אחד לכל המכשירים).</li>
            <li>נרשמים לחשבון חדש.</li>
            <li>שולחים הודעה ל{AGENT.name} בוואטסאפ והוא משייך אתכם ומלווה אתכם.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <a href={SEVEN_XL.downloadUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => logOnlineClick('store_7xl', null, 'online_page')}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 transition-colors">
              ⬇️ הורדת 7XL
            </a>
            <a href={waLink(`שלום ${AGENT.name}, הגעתי מאתר פוקר ישראל ואני רוצה להצטרף ל-7XL`)}
              target="_blank" rel="noopener noreferrer"
              onClick={() => logOnlineClick('whatsapp', '7xl', 'online_page')}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1da851] transition-colors">
              💬 להצטרפות — דברו עם {AGENT.name}
            </a>
          </div>
        </section>

        {/* שקיפות ובטיחות — בולט בכוונה, לא אותיות קטנות */}
        <section aria-labelledby="safety-title" className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-5">
          <h2 id="safety-title" className="font-black text-amber-300 mb-2">🛡️ שקיפות ובטיחות</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            הקלאבים המוצגים בעמוד עוברים בדיקות רגולציה ואבטחה, כולל ניסיון לאתר בוטים ושיתופי פעולה בין שחקנים.
            עם זאת, שום מערכת אינה הרמטית ואיננו יכולים להבטיח זאת ב-100%. נתקלתם במשהו חשוד? דווחו לסוכן מיד.
          </p>
          <a href={waLink(`שלום ${AGENT.name}, אני רוצה לדווח על פעילות חשודה בקלאב`)} target="_blank" rel="noopener noreferrer"
            onClick={() => logOnlineClick('report', null, 'online_page')}
            className="inline-flex items-center gap-2 mt-3 min-h-[40px] px-4 rounded-xl border border-amber-500/50 text-amber-200 text-sm font-bold hover:bg-amber-500/10">
            ⚠️ דווח על פעילות חשודה
          </a>
        </section>

        {/* משחק אחראי + גילוי נאות */}
        <section aria-labelledby="responsible-title" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400 space-y-2">
          <h2 id="responsible-title" className="font-black text-slate-200">🔞 משחק אחראי</h2>
          <p>המשחק מיועד לבני 18 ומעלה בלבד. הגדירו לעצמכם תקציב מראש, אל תרדפו אחרי הפסדים, ושחקו רק בכסף שאתם יכולים להרשות לעצמכם להפסיד.</p>
          <p>
            מרגישים שהמשחק יוצא משליטה? יש עזרה:{' '}
            <a href={GAMBLING_HELP_URL} target="_blank" rel="noopener noreferrer" className="text-violet-300 font-bold hover:underline">
              מוקדי טיפול בבעיית הימורים (כל-זכות)
            </a>
          </p>
          <p className="text-slate-500 pt-2 border-t border-slate-800">
            גילוי נאות: האתר מפנה שחקנים לסוכן בקלאבים ובאתרים המופיעים בעמוד ומקבל עמלה או תשלום על ההפניה. האתר אינו מקבל ואינו מעביר כספים.
          </p>
        </section>
      </div>
    </div>
  );
}
