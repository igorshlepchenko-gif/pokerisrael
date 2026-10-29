import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useQuizAccess, QUIZ_NAME } from '../utils/quizAccess';
import { QuestionsSection } from '../components/Admin/QuizAdmin';
import { QuestionText, CardText } from '../components/QuizCards';
import QuizRulesModal from '../components/QuizRulesModal';
import { rememberReturn } from '../utils/returnTo';

// ── שעשועון פוקר ───────────────────────────────────────────────────────────
// כל משחק מתחיל עם 1,000 צ'יפים. לפני כל שאלה רואים רק נושא + קושי ומהמרים; תשובה
// נכונה מכפילה את ההימור לפי הקושי. החוקים והניקוד בשרת (server/services/quiz.js).

const SITE = 'https://www.pokerisrael.org';
const CATEGORIES = {
  rules: { label: 'לפי הספר (TDA)', icon: '📖' },
  history: { label: 'היסטוריה', icon: '🏛️' },
  quotes: { label: 'משפטים מפורסמים', icon: '💬' },
  situations: { label: 'מצבים בשולחן', icon: '🃏' },
  math: { label: 'מתמטיקה וסיכויים', icon: '🧮' },
  terms: { label: 'מונחים', icon: '🔤' },
  media: { label: 'ספרים, טלוויזיה וסרטים', icon: '🎬' },
  club: { label: 'שאלות המועדון', icon: '🏠' },
};
const TOPICS = Object.keys(CATEGORIES).filter((k) => k !== 'club'); // שאלות מועדון — רק בצ'אלנג' של המועדון
const DIFF = { 1: 'קל', 2: 'בינוני', 3: 'קשה' };
const fmt = (n) => Number(n || 0).toLocaleString('he-IL');
const errMsg = (e) => e?.response?.data?.message || 'משהו השתבש — נסה שוב';

export default function Quiz() {
  const { loading, allowed, open, reviewer } = useQuizAccess();
  if (loading) return null;
  if (!allowed) return <ClosedBeta />;
  return <QuizPage open={open} reviewer={reviewer} />;
}

// שלב סגור — מי שלא אושר (או אורח) רואה הסבר במקום העמוד
function ClosedBeta() {
  const { user } = useAuth() || {};
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-3" aria-hidden="true">🔒</div>
        <h1 className="text-2xl font-black text-white">{QUIZ_NAME} — בשלב סגור</h1>
        <p className="text-slate-400 mt-3 leading-relaxed">
          שעשועון הפוקר שלנו עדיין בבדיקות, ופתוח רק למשתתפים שהוזמנו.
          {user ? ' עוד לא קיבלת גישה — נעדכן כשייפתח.' : ' אם הוזמנת — התחבר כדי להיכנס.'}
        </p>
        {!user && <Link to="/login" className="inline-flex mt-5 min-h-[44px] items-center px-6 rounded-xl bg-amber-500 text-slate-950 font-black">התחברות</Link>}
      </div>
    </div>
  );
}

function QuizPage({ open, reviewer }) {
  const { user } = useAuth() || {};
  const [reviewing, setReviewing] = useState(false); // מסך "בדיקת שאלות" לבודקים (לא אדמין — לאדמין יש את הפאנל)
  const [params] = useSearchParams();
  const clubId = /^\d+$/.test(params.get('club') || '') ? params.get('club') : null;
  const [me, setMe] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');

  const loadMe = useCallback(() => api.get('/quiz/me').then((r) => setMe(r.data)).catch(() => setMe({ loggedIn: false })), []);
  useEffect(() => { loadMe(); }, [loadMe, user?.id]);

  // משחק שהיה פתוח (רענון/חזרה לעמוד) — ממשיכים ממנו
  useEffect(() => {
    if (me?.activeGameId && !game) api.get(`/quiz/games/${me.activeGameId}`).then((r) => r.data.status === 'active' && setGame(r.data)).catch(() => {});
  }, [me?.activeGameId]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (mode, topic, club) => {
    setError('');
    try { setGame((await api.post('/quiz/games', { mode, topic, club })).data); window.scrollTo(0, 0); }
    catch (e) { setError(errMsg(e)); }
  };
  const back = () => { setGame(null); loadMe(); };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {!open && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 text-amber-200 text-sm font-bold text-center px-4 py-2">
          {user?.role === 'admin'
            ? '🔒 שלב סגור — רק משתמשים שאישרת בפאנל רואים את השעשועון. אתה רואה גם שאלות שעוד לא אישרת'
            : reviewer
              ? '🔍 אתה בודק שאלות — במשחק מופיעות גם שאלות שעוד לא אושרו, ואפשר לפסול שאלה אחרי כל תשובה'
              : '🔒 גרסת בטא סגורה — תודה שאתה עוזר לנו לבדוק!'}
        </div>
      )}
      {reviewer && user?.role !== 'admin' && !game && (
        <div className="max-w-2xl mx-auto px-4 pt-4 flex justify-center">
          <button onClick={() => setReviewing((v) => !v)}
            className={`px-4 min-h-[40px] rounded-xl text-sm font-bold border ${reviewing ? 'border-sky-400 bg-sky-600 text-white' : 'border-sky-500/50 text-sky-200'}`}>
            {reviewing ? '← חזרה לשעשועון' : '🔍 בדיקת שאלות — לאשר, לפסול, לערוך'}
          </button>
        </div>
      )}
      <div className={`${reviewing ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-4 py-8`}>
        {reviewing && !game ? <QuestionsSection /> : game
          ? <Game key={game.id} initial={game} onExit={back} onReplay={(mode, topic, club) => start(mode, topic, club)} isAdmin={reviewer} />
          : <Lobby me={me} onStart={start} error={error} reloadMe={loadMe} clubId={clubId} />}
      </div>
    </div>
  );
}

// ── לובי ───────────────────────────────────────────────────────────────────
function Lobby({ me, onStart, error, reloadMe, clubId }) {
  const [showTopics, setShowTopics] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [club, setClub] = useState(null);
  const logged = me?.loggedIn;
  // אורח: רואה את הלובי והטבלה, אבל משחק רק אחרי הרשמה (גם השרת חוסם — services/quiz.js startGame)
  const guest = !!me && !logged;
  const navigate = useNavigate();
  const here = `/quiz${clubId ? `?club=${clubId}` : ''}`;
  const play = (...args) => {
    if (!guest) return onStart(...args);
    rememberReturn(here);
    navigate('/register');
  };
  useEffect(() => {
    if (clubId) api.get(`/quiz/clubs/${clubId}`).then((r) => setClub(r.data)).catch(() => setClub(null));
  }, [clubId]);

  return (
    <>
      <header className="text-center mb-6">
        <img src="/quiz/logo-192.webp" alt="" width="96" height="96" className="w-24 h-24 mx-auto mb-2 drop-shadow-[0_0_18px_rgba(29,78,216,0.55)]" />
        <h1 className="text-3xl font-black text-white">{QUIZ_NAME}</h1>
        <p className="text-sm text-amber-300/80 font-bold">שעשועון הפוקר של פוקר ישראל</p>
        <p className="text-slate-400 mt-2 text-sm leading-relaxed">
          כל משחק מתחיל עם <b className="text-amber-300">1,000 צ'יפים</b>. לפני כל שאלה רואים רק את הנושא והקושי — ומהמרים.
          <br />יודע? תלך על זה. לא בטוח? תשלם רק את הבליינד.
        </p>
        <button onClick={() => setShowHow((v) => !v)} className="mt-2 text-xs text-sky-300 underline">{showHow ? 'סגור' : 'איך זה עובד?'}</button>
      </header>

      {showHow && (
        <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300 space-y-1.5">
          <p>💰 מתחילים עם 1,000 צ'יפים. בכל שאלה חייבים להמר לפחות את הבליינד, והוא עולה משאלה לשאלה.</p>
          <p>🎯 תשובה נכונה: זוכים בהימור × המכפיל — קלה ×1, בינונית ×1.5, קשה ×2.</p>
          <p>❌ טעות או שלא הספקת (20 שניות): ההימור הולך. 0 צ'יפים = הודחת.</p>
          <p>🏆 הניקוד של משחק = הצ'יפים שנשארו לך בסופו. הוא נצבר לטבלה היומית, לעונה (רבעון) ולכל הזמנים.</p>
          <p>🗓️ הסט היומי — אותן 10 שאלות לכולם, פעם אחת ביום. "לפי נושא" ו"נגד השעון" — עד 5 משחקים מדורגים ביום, ואחר כך אפשר להמשיך לשחק לכיף.</p>
          <button onClick={() => setShowRules(true)} className="mt-2 w-full min-h-[44px] rounded-xl border border-amber-500/50 text-amber-200 font-bold hover:bg-amber-500/10">
            📖 כרטיס החוקים המלא
          </button>
        </div>
      )}
      {showRules && <QuizRulesModal onClose={() => setShowRules(false)} />}

      {error && <p className="mb-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-200 text-sm p-3 text-center">{error}</p>}

      {guest && (
        <section className="mb-4 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-center">
          <p className="text-sky-100 font-black text-lg">🔒 כדי לשחק צריך חשבון</p>
          <p className="text-sm text-slate-300 mt-1">ההרשמה חינם ולוקחת דקה — ואז הניקוד שלך נכנס לטבלה.</p>
          <div className="mt-3 flex gap-2 justify-center">
            <Link to="/register" onClick={() => rememberReturn(here)} className="min-h-[44px] px-6 inline-flex items-center rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black">הרשמה חינם</Link>
            <Link to="/login" onClick={() => rememberReturn(here)} className="min-h-[44px] px-6 inline-flex items-center rounded-xl border border-sky-400/50 text-sky-100 font-bold hover:bg-white/5">יש לי חשבון</Link>
          </div>
        </section>
      )}

      {/* צ'אלנג' מועדון — מי שסרק את ה-QR בשולחן */}
      {club && (
        <section className="rounded-3xl border border-violet-500/50 bg-gradient-to-br from-violet-600/20 via-slate-900 to-slate-900 p-5 mb-4">
          <div className="flex items-center gap-3">
            {club.logo_url && <img src={club.logo_url} alt="" className="w-14 h-14 rounded-full object-cover bg-slate-800 border border-violet-400/40" />}
            <div>
              <h2 className="text-xl font-black text-violet-100">🏠 הצ'אלנג' של {club.name}</h2>
              <p className="text-sm text-slate-400">10 שאלות{club.questions ? `, חלקן על ${club.name}` : ''}. טבלה נפרדת לשחקני המועדון.</p>
            </div>
          </div>
          <button onClick={() => play('club', null, club.id)}
            className="mt-4 w-full min-h-[52px] rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-lg font-black transition-colors">
            לשחק את הצ'אלנג' של {club.name} ←
          </button>
          {logged && me.rankedLeft && <p className="text-xs text-slate-500 mt-2 text-center">משחקים מדורגים שנשארו היום: {me.rankedLeft.club}/3</p>}
        </section>
      )}

      {/* הסט היומי */}
      <section className="rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-900 p-5 mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-amber-200">🗓️ הסט היומי</h2>
            <p className="text-sm text-slate-400">10 שאלות, אותן שאלות לכולם. פעם אחת ביום.</p>
          </div>
          {logged && me.streak > 0 && <span className="text-sm font-bold text-orange-300">🔥 {me.streak} {me.streak === 1 ? 'יום' : 'ימים'} ברצף</span>}
        </div>
        {logged && me.daily && me.daily.status !== 'active' ? (
          <div className="mt-4">
            <p className="text-slate-200">שיחקת היום: <b className="text-amber-300 text-lg">{fmt(me.daily.points)}</b> צ'יפים {me.daily.status === 'busted' && '(הודחת 💀)'}</p>
            <p className="text-2xl tracking-wider mt-1" dir="ltr">{me.daily.share}</p>
            <ShareButton points={me.daily.points} line={me.daily.share} day={me.day} />
            <p className="text-xs text-slate-500 mt-2">סט חדש מחר ב-00:00</p>
            {me.reviewer && (
              <button onClick={() => play('daily')}
                className="mt-3 w-full min-h-[44px] rounded-xl border border-amber-500/50 text-amber-200 font-bold hover:bg-amber-500/10">
                🔁 לשחק שוב (לא נספר בטבלה)
              </button>
            )}
          </div>
        ) : (
          <button onClick={() => play('daily')}
            className="mt-4 w-full min-h-[52px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-lg font-black transition-colors">
            {logged && me.daily ? 'להמשיך את הסט היומי ←' : 'לשחק את הסט היומי ←'}
          </button>
        )}
      </section>

      {/* מצבים נוספים */}
      <div className="grid sm:grid-cols-2 gap-3 mb-2">
        <button onClick={() => play('clock')}
          className="text-right rounded-2xl border border-slate-700 bg-slate-900 hover:border-sky-400 p-4 transition-colors">
          <p className="text-lg font-black text-white">⏱️ נגד השעון</p>
          <p className="text-sm text-slate-400">90 שניות. כל שאלה על הבליינד — כמה שיותר נכונות.</p>
        </button>
        <button onClick={() => setShowTopics((v) => !v)} aria-expanded={showTopics}
          className={`text-right rounded-2xl border bg-slate-900 p-4 transition-colors ${showTopics ? 'border-emerald-400' : 'border-slate-700 hover:border-emerald-400'}`}>
          <p className="text-lg font-black text-white">📚 לפי נושא</p>
          <p className="text-sm text-slate-400">10 שאלות מנושא שאתה בוחר.</p>
        </button>
      </div>
      {showTopics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          {TOPICS.map((k) => [k, CATEGORIES[k]]).map(([k, c]) => (
            <button key={k} onClick={() => play('topic', k)}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-3 text-sm font-bold text-emerald-100">
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}
      {logged && me.rankedLeft && (
        <p className="text-xs text-slate-500 text-center mb-6">
          משחקים מדורגים שנשארו היום: נגד השעון {me.rankedLeft.clock}/5 · לפי נושא {me.rankedLeft.topic}/5
        </p>
      )}

      <Leaderboard me={me} reloadMe={reloadMe} club={club} />
    </>
  );
}

function ShareButton({ points, line, day }) {
  const [msg, setMsg] = useState('');
  const date = day ? day.split('-').reverse().slice(0, 2).join('.') : '';
  const text = `🎲 ${QUIZ_NAME} · פוקר ישראל · ${date}\n💰 ${fmt(points)} צ'יפים\n${line}\n\nמנצח אותי? ${SITE}/quiz?utm_source=quiz_share`;
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* ביטל */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setMsg('הועתק ✓'); } catch { setMsg(''); } };
  return (
    <div className="flex gap-2 mt-3">
      <button onClick={share} className="flex-1 min-h-[44px] rounded-xl bg-[#25D366] hover:brightness-110 text-white font-bold">📲 שתף את התוצאה</button>
      <button onClick={copy} className="px-4 min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-sm">{msg || '📋 העתק'}</button>
    </div>
  );
}

// ── טבלת דירוג ─────────────────────────────────────────────────────────────
function Leaderboard({ me, reloadMe, club }) {
  const [period, setPeriod] = useState('day');
  const [scope, setScope] = useState('all'); // all | club
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState('');
  const [nickMsg, setNickMsg] = useState('');

  useEffect(() => {
    setData(null);
    api.get('/quiz/leaderboard', { params: { period, club: scope === 'club' ? club?.id : undefined } })
      .then((r) => setData(r.data)).catch(() => setData({ top: [], me: null }));
  }, [period, scope, club?.id, me?.daily?.points]);

  const saveNick = async () => {
    try {
      await api.put('/quiz/nickname', { nickname: nick }); setEditing(false); setNickMsg(''); reloadMe();
      api.get('/quiz/leaderboard', { params: { period, club: scope === 'club' ? club?.id : undefined } }).then((r) => setData(r.data));
    }
    catch (e) { setNickMsg(errMsg(e)); }
  };

  const tabs = [['day', 'היום'], ['quarter', 'העונה'], ['all', 'כל הזמנים']];
  const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r);
  const meOutside = data?.me && !data.top.some((x) => x.me);

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-lg font-black text-white">🏆 טבלת הדירוג</h2>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${period === k ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      {club && (
        <div className="flex gap-2 mb-3">
          {[['all', 'כל השחקנים'], ['club', `שחקני ${club.name}`]].map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${scope === k ? 'border-violet-400 bg-violet-600 text-white' : 'border-slate-700 text-slate-400'}`}>{l}</button>
          ))}
        </div>
      )}
      {period === 'quarter' && data?.from && <p className="text-xs text-slate-500 mb-2">העונה התחילה ב-{data.from.split('-').reverse().join('.')} ומתאפסת בסוף הרבעון</p>}
      {!data ? <p className="text-center text-slate-500 py-6">טוען…</p>
        : data.top.length === 0 ? <p className="text-center text-slate-500 py-6">עוד אין ניקוד בתקופה הזו — תהיה הראשון 🎯</p>
        : (
          <ol className="divide-y divide-slate-800">
            {[...data.top, ...(meOutside ? [data.me] : [])].map((r, i) => (
              <li key={`${r.rank}-${i}`} className={`flex items-center gap-3 py-2 px-2 rounded-lg ${r.me ? 'bg-amber-500/10' : ''} ${meOutside && i === data.top.length ? 'border-t-2 border-dashed border-slate-700' : ''}`}>
                <span className="w-8 text-center font-black text-slate-300">{medal(r.rank)}</span>
                <span className={`flex-1 truncate ${r.me ? 'font-black text-amber-200' : 'text-slate-200'}`}>{r.name}{r.me && ' (אתה)'}</span>
                <span className="text-xs text-slate-500">{r.games} משחקים</span>
                <span className="font-black text-amber-300 tabular-nums">{fmt(r.points)}</span>
              </li>
            ))}
          </ol>
        )}
      {me?.loggedIn && (
        <div className="mt-3 text-xs text-slate-500">
          {editing ? (
            <div className="flex gap-2 items-center flex-wrap">
              <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} placeholder="כינוי (ריק = השם שלך)"
                className="flex-1 min-w-[160px] rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-100" />
              <button onClick={saveNick} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-sm">שמור</button>
              <button onClick={() => setEditing(false)} className="px-3 py-2 text-slate-400 text-sm">ביטול</button>
              {nickMsg && <span className="text-red-300 w-full">{nickMsg}</span>}
            </div>
          ) : (
            <>מופיע בטבלה בתור <b className="text-slate-300">{me.name}</b> · <button onClick={() => { setNick(me.nickname || ''); setEditing(true); }} className="underline text-sky-300">לשנות כינוי</button></>
          )}
        </div>
      )}
    </section>
  );
}

// ── משחק ───────────────────────────────────────────────────────────────────
function Game({ initial, onExit, onReplay, isAdmin }) {
  const [s, setS] = useState(initial);
  const [last, setLast] = useState(null);       // תוצאת התשובה האחרונה (מסך משוב)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(null);
  const clock = s.mode === 'clock';

  const call = async (fn) => {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(errMsg(e)); return null; } finally { setBusy(false); }
  };

  const bet = (amount) => call(async () => { const r = await api.post(`/quiz/games/${s.id}/bet`, { bet: amount }); setS(r.data); setPicked(null); });

  const answer = useCallback((choice) => call(async () => {
    setPicked(choice);
    const r = await api.post(`/quiz/games/${s.id}/answer`, { choice });
    const { last: l, ...next } = r.data;
    if (clock) {
      // נגד השעון: הבזק קצר של נכון/לא נכון והשאלה הבאה מיד
      setLast(l || null); setS(next); setPicked(null);
      setTimeout(() => setLast((cur) => (cur === l ? null : cur)), 700);
    } else {
      setLast(l ? { ...l, question: s.question } : null); setS(next);
    }
  }), [s.id, s.question, clock]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishClock = useCallback(() => call(async () => { const r = await api.post(`/quiz/games/${s.id}/finish`); setS(r.data); setLast(null); }), [s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const over = s.status !== 'active';
  const title = s.mode === 'daily' ? '🗓️ הסט היומי' : clock ? '⏱️ נגד השעון' : s.mode === 'club' ? "🏠 צ'אלנג' מועדון" : `📚 ${CATEGORIES[s.topic]?.label || ''}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-200">→ ללובי</button>
        <span className="text-sm font-bold text-slate-300">{title}</span>
        {!s.ranked ? <span className="text-xs text-slate-500">לא מדורג</span> : <span className="text-xs text-emerald-400">מדורג</span>}
      </div>

      <StackBar s={s} delta={last?.delta} />
      {clock && !over && <ClockTimer msLeft={s.clockMsLeft} onEnd={finishClock} />}
      {error && <p className="my-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-200 text-sm p-3 text-center">{error}</p>}

      {over && !(last && !clock) ? (
        <GameOver s={s} onExit={onExit} onReplay={onReplay} />
      ) : last && !clock ? (
        <Feedback last={last} s={s} onNext={() => setLast(null)} isAdmin={isAdmin} />
      ) : s.question ? (
        <QuestionCard s={s} busy={busy} picked={picked} onAnswer={answer} flash={clock ? last : null} />
      ) : (
        <BetPanel s={s} busy={busy} onBet={bet} />
      )}
    </div>
  );
}

function StackBar({ s, delta }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-slate-900 px-4 py-3 mb-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-slate-400">הערימה שלך</p>
          <p className="text-2xl font-black text-amber-300 tabular-nums flex items-center gap-2">
            <span>💰 {fmt(s.stack)}</span>
            {delta != null && delta !== 0 && (
              <bdi key={`${s.index}-${delta}`} dir="ltr"
                className={`text-sm px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                {delta > 0 ? '+' : '−'}{fmt(Math.abs(delta))}
              </bdi>
            )}
          </p>
        </div>
        <div className="text-left">
          {s.total ? <p className="text-xs text-slate-400">שאלה {Math.min(s.index + 1, s.total)}/{s.total}</p> : <p className="text-xs text-slate-400">שאלה {s.index + 1}</p>}
          {s.blind != null && s.status === 'active' && <p className="text-sm font-bold text-slate-200">בליינד {fmt(s.blind)}</p>}
        </div>
      </div>
      {s.results && <p className="mt-2 text-sm tracking-wider" dir="ltr">{s.share}</p>}
    </div>
  );
}

function Stars({ n }) {
  return <span aria-label={`קושי: ${DIFF[n]}`}>{'★'.repeat(n)}<span className="opacity-25">{'★'.repeat(3 - n)}</span></span>;
}

// לפני השאלה: רואים נושא + קושי, ומחליטים כמה להמר
function BetPanel({ s, busy, onBet }) {
  const min = Math.min(s.stack, s.blind);
  const [amount, setAmount] = useState(min);
  useEffect(() => { setAmount(min); }, [s.index, min]);
  const c = CATEGORIES[s.next.category] || {};
  const presets = [...new Map([
    ['מינימום', min], ['×2', s.blind * 2], ['×4', s.blind * 4], ['חצי', Math.round(s.stack / 2 / 5) * 5], ['אול-אין', s.stack],
  ].filter(([, v]) => v >= min && v <= s.stack).map(([l, v]) => [v, l])).entries()].sort((a, b) => a[0] - b[0]);
  const win = Math.round((amount * s.next.payout) / 5) * 5;

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900 p-5">
      <p className="text-center text-sm text-slate-400">השאלה הבאה</p>
      <p className="text-center text-2xl font-black text-white mt-1">{c.icon} {s.next.categoryLabel}</p>
      <p className="text-center text-amber-300 text-lg mt-1"><Stars n={s.next.difficulty} /> <span className="text-sm text-slate-300">{DIFF[s.next.difficulty]} · זכייה ×{s.next.payout}</span></p>

      <p className="text-center text-sm text-slate-300 mt-5 mb-2">כמה אתה מהמר?</p>
      <div className="flex flex-wrap justify-center gap-2">
        {presets.map(([v, l]) => (
          <button key={v} onClick={() => setAmount(v)}
            className={`min-h-[44px] px-4 rounded-full border-2 font-bold text-sm transition-colors ${amount === v ? 'border-amber-400 bg-amber-500 text-slate-950' : 'border-amber-500/40 text-amber-200 hover:bg-amber-500/10'}`}>
            {l} · {fmt(v)}
          </button>
        ))}
      </div>
      {s.stack > min && (
        <input type="range" min={min} max={s.stack} step={5} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
          aria-label="סכום ההימור" className="w-full mt-4 accent-amber-500" style={{ direction: 'rtl' }} />
      )}
      <button disabled={busy} onClick={() => onBet(amount)}
        className={`mt-4 w-full min-h-[52px] rounded-2xl text-lg font-black transition-colors disabled:opacity-50 ${amount === s.stack ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'}`}>
        {amount === s.stack ? `🔥 אול-אין ${fmt(amount)}` : `מהמר ${fmt(amount)} וחושף את השאלה`}
      </button>
      <p className="text-center text-xs text-slate-500 mt-2">נכון: +{fmt(win)} · טעות: −{fmt(amount)} · {s.next.seconds || 20} שניות לענות</p>
    </div>
  );
}

function QuestionCard({ s, busy, picked, onAnswer, flash }) {
  const total = (s.answerSeconds || 20) * 1000;
  const [left, setLeft] = useState(s.msLeft ?? total);
  const sentRef = useRef(false);
  const c = CATEGORIES[s.next.category] || {};

  useEffect(() => {
    if (s.mode === 'clock') return undefined; // בנגד השעון יש שעון אחד למשחק כולו
    sentRef.current = false;
    const end = Date.now() + (s.msLeft ?? total);
    const t = setInterval(() => {
      const l = Math.max(0, end - Date.now());
      setLeft(l);
      if (l === 0 && !sentRef.current) { sentRef.current = true; clearInterval(t); onAnswer(null); }
    }, 100);
    return () => clearInterval(t);
  }, [s.index, s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (i) => { if (busy || picked != null || sentRef.current) return; sentRef.current = s.mode !== 'clock'; onAnswer(i); };

  return (
    <div className={`rounded-3xl border bg-slate-900 p-5 transition-colors ${flash ? (flash.correct ? 'border-emerald-400' : 'border-red-500') : 'border-slate-700'}`}>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span>{c.icon} {s.next.categoryLabel} · <Stars n={s.next.difficulty} /></span>
        <span>על הקופה: <b className="text-amber-300">{fmt(s.bet)}</b></span>
      </div>
      {s.mode !== 'clock' && (
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-4" role="progressbar" aria-valuenow={Math.ceil(left / 1000)} aria-valuemin={0} aria-valuemax={total / 1000} aria-label="זמן שנותר">
          <div className={`h-full transition-[width] duration-100 ${left < 5000 ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${(left / total) * 100}%`, marginInlineStart: 0 }} />
        </div>
      )}
      <h2 className="text-lg sm:text-xl font-bold text-white leading-relaxed mb-4"><QuestionText text={s.question.text} /></h2>
      <div className="grid gap-2">
        {s.question.options.map((o, i) => (
          <button key={i} disabled={busy} onClick={() => choose(i)}
            className={`text-right min-h-[52px] px-4 py-3 rounded-2xl border-2 font-semibold transition-colors ${picked === i ? 'border-amber-400 bg-amber-500/20 text-white' : 'border-slate-700 bg-slate-800/60 text-slate-100 hover:border-amber-400/70'}`}>
            <CardText text={o} />
          </button>
        ))}
      </div>
      {s.mode !== 'clock' && <p className="text-center text-sm text-slate-400 mt-3 tabular-nums">{Math.ceil(left / 1000)} שניות</p>}
    </div>
  );
}

function Feedback({ last, s, onNext, isAdmin }) {
  const [flagMsg, setFlagMsg] = useState('');
  const flag = async () => {
    const reason = isAdmin ? null : window.prompt('מה לא בסדר בשאלה? (לא חובה)');
    if (reason === null && !isAdmin) return;
    try {
      const r = await api.post(`/quiz/questions/${last.questionId}/flag`, { reason });
      setFlagMsg(r.data.rejected ? 'השאלה נפסלה ✓ (לא תופיע יותר)' : 'תודה! נבדוק את השאלה');
    } catch { setFlagMsg('לא הצלחתי לשלוח'); }
  };
  const over = s.status !== 'active';
  return (
    <div className={`rounded-3xl border-2 p-5 ${last.correct ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-red-500/60 bg-red-500/10'}`}>
      <p className="text-2xl font-black text-center">
        {last.correct ? <span className="text-emerald-300">✅ נכון! +{fmt(last.delta)}</span>
          : last.timedOut ? <span className="text-red-300">⏰ נגמר הזמן · −{fmt(-last.delta)}</span>
          : <span className="text-red-300">❌ לא נכון · −{fmt(-last.delta)}</span>}
      </p>
      {last.question && (
        <>
          <div className="text-slate-200 mt-4 mb-3 leading-relaxed"><QuestionText text={last.question.text} /></div>
          <div className="grid gap-1.5">
            {last.question.options.map((o, i) => (
              <div key={i} className={`px-3 py-2 rounded-xl text-sm ${i === last.correctIndex ? 'bg-emerald-500/25 text-emerald-100 font-bold' : i === last.choice ? 'bg-red-500/25 text-red-100 line-through' : 'text-slate-400'}`}>
                {i === last.correctIndex ? '✓ ' : ''}<CardText text={o} />
              </div>
            ))}
          </div>
        </>
      )}
      {last.explanation && <p className="mt-3 text-sm text-slate-300">💡 {last.explanation}</p>}
      <button onClick={onNext} className="mt-5 w-full min-h-[52px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-lg font-black">
        {over ? 'לתוצאה הסופית ←' : 'לשאלה הבאה ←'}
      </button>
      <div className="text-center mt-3">
        {flagMsg ? <span className="text-xs text-slate-400">{flagMsg}</span>
          : <button onClick={flag} className="text-xs text-slate-500 underline">{isAdmin ? '🚫 לפסול את השאלה' : '🚩 יש טעות בשאלה?'}</button>}
      </div>
    </div>
  );
}

function ClockTimer({ msLeft, onEnd }) {
  const [left, setLeft] = useState(msLeft ?? 90000);
  const ended = useRef(false);
  useEffect(() => {
    const end = Date.now() + (msLeft ?? 90000);
    const t = setInterval(() => {
      const l = Math.max(0, end - Date.now());
      setLeft(l);
      if (l === 0 && !ended.current) { ended.current = true; clearInterval(t); onEnd(); }
    }, 200);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — שעון אחד לכל המשחק
  return (
    <p className={`text-center text-4xl font-black tabular-nums mb-3 ${left < 10000 ? 'text-red-400' : 'text-sky-300'}`} aria-live="off">
      ⏱️ {Math.ceil(left / 1000)}
    </p>
  );
}

function GameOver({ s, onExit, onReplay }) {
  const busted = s.status === 'busted';
  const correct = [...(s.results || '')].filter((r) => r === 'C').length;
  return (
    <div className="rounded-3xl border border-amber-500/40 bg-slate-900 p-6 text-center">
      <div className="text-5xl" aria-hidden="true">{busted ? '💀' : s.stack > s.startStack ? '🏆' : '🃏'}</div>
      <h2 className="text-2xl font-black text-white mt-2">{busted ? 'הודחת!' : 'סיימת!'}</h2>
      <p className="text-slate-300 mt-1">{correct} תשובות נכונות{s.mode !== 'clock' && s.total ? ` מתוך ${s.results.length}` : ''}</p>
      <p className="text-4xl font-black text-amber-300 mt-3 tabular-nums">💰 {fmt(s.stack)}</p>
      <p className="text-sm text-slate-400 mt-1">
        {s.ranked ? `+${fmt(s.points)} נקודות לטבלה` : 'משחק לא מדורג — לא נכנס לטבלה'}
      </p>
      {s.share && <p className="text-2xl tracking-wider mt-3" dir="ltr">{s.share}</p>}
      {s.mode === 'daily' && s.ranked && <ShareButton points={s.points} line={s.share} day={s.day?.slice?.(0, 10)} />}
      <div className="flex gap-2 mt-4">
        {s.mode !== 'daily' && (
          <button onClick={() => onReplay(s.mode, s.topic, s.venueId)} className="flex-1 min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black">עוד משחק</button>
        )}
        <button onClick={onExit} className="flex-1 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold">ללובי ולטבלה</button>
      </div>
    </div>
  );
}
