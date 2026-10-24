import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { QUIZ_NAME, resetQuizAccessCache } from '../../utils/quizAccess';

// ניהול השעשועון (server/routes/quiz.js → /admin/*): מי מקבל גישה, אישור שאלות, ו-QR למועדונים
const STATUS = { pending: '⏳ ממתינות', approved: '✅ מאושרות', rejected: '🚫 נפסלו' };
const DIFF = { 1: 'קל', 2: 'בינוני', 3: 'קשה' };
const errMsg = (e) => e?.response?.data?.message || 'שגיאה';

export default function QuizAdmin() {
  const [section, setSection] = useState('access');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xl font-black text-white">🎲 {QUIZ_NAME}</h3>
        <a href="/quiz" target="_blank" rel="noopener noreferrer" className="text-sm text-sky-300 underline">לפתוח את השעשועון ←</a>
      </div>
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
        {[['access', '🔑 גישה'], ['questions', '❓ שאלות'], ['clubs', '🏠 מועדונים ו-QR']].map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${section === k ? 'bg-poker-green text-white' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
        ))}
      </div>
      {section === 'access' && <AccessSection />}
      {section === 'questions' && <QuestionsSection />}
      {section === 'clubs' && <ClubsSection />}
    </div>
  );
}

// ── גישה: מתג כללי + גורף + לכל משתמש ─────────────────────────────────────
function AccessSection() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.get('/quiz/admin/access').then((r) => setData(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, done) => {
    setMsg('');
    try { await fn(); resetQuizAccessCache(); await load(); if (done) setMsg(done); } catch (e) { setMsg(errMsg(e)); }
  };
  const setOpen = (open) => {
    if (open && !window.confirm('לפתוח את השעשועון לכולם — כולל גולשים לא רשומים?')) return;
    act(() => api.put('/quiz/admin/access/open', { open }), open ? 'השעשועון פתוח לכולם' : 'השעשועון חזר לשלב סגור');
  };
  const bulk = (allowed) => {
    if (!window.confirm(allowed ? 'לתת גישה לכל המשתמשים הרשומים?' : 'לקחת את הגישה מכל המשתמשים (חוץ ממך)?')) return;
    act(() => api.put('/quiz/admin/access/users', { ids: 'all', allowed }), allowed ? 'כל המשתמשים קיבלו גישה' : 'הגישה נלקחה מכולם');
  };
  const toggle = (u) => act(() => api.put('/quiz/admin/access/users', { ids: [u.id], allowed: !u.quiz_access }));
  const toggleReviewer = (u) => act(() => api.put('/quiz/admin/access/reviewers', { ids: [u.id], reviewer: !u.quiz_reviewer }),
    u.quiz_reviewer ? `${u.name} כבר לא בודק שאלות` : `${u.name} הוא עכשיו בודק שאלות — משחק גם בממתינות, ומאשר/פוסל שאלות מתוך השעשועון`);

  if (!data) return <p className="text-slate-400 py-6 text-center">טוען…</p>;
  const term = q.trim().toLowerCase();
  const users = data.users.filter((u) => !term || `${u.name} ${u.email}`.toLowerCase().includes(term));
  const count = data.users.filter((u) => u.quiz_access && u.role !== 'admin').length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className={`rounded-xl border p-4 ${data.open ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
        <p className="font-bold text-white">{data.open ? '🌍 פתוח לכולם — כל הגולשים רואים את השעשועון (גם בלי חשבון)' : '🔒 שלב סגור — רק אתה והמשתמשים שאישרת'}</p>
        <p className="text-xs text-slate-400 mt-1">כשסגור: מי שלא אושר רואה מסך "בשלב סגור", והקישור בתפריט מוסתר ממנו.</p>
        <p className="text-xs text-slate-400">🔍 בודק — משחק גם בשאלות ממתינות, פוסל שאלה בלחיצה ומאשר/עורך שאלות במסך "בדיקת שאלות" בתוך השעשועון.</p>
        <button onClick={() => setOpen(!data.open)}
          className={`mt-3 px-4 py-2 rounded-lg text-sm font-bold ${data.open ? 'bg-slate-700 text-white' : 'bg-emerald-600 text-white'}`}>
          {data.open ? 'לסגור חזרה לשלב סגור' : 'לפתוח לכולם'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-300">✅ {count} משתמשים עם גישה</span>
        <button onClick={() => bulk(true)} className="px-3 py-1.5 rounded-lg border border-emerald-500/50 text-emerald-200 text-sm">לתת לכולם</button>
        <button onClick={() => bulk(false)} className="px-3 py-1.5 rounded-lg border border-red-500/50 text-red-200 text-sm">לקחת מכולם</button>
        {msg && <span className="text-sm text-sky-300">{msg}</span>}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש משתמש לפי שם או מייל…"
        className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-slate-100" />
      <div className="rounded-xl border border-slate-700 divide-y divide-slate-800 max-h-[60vh] overflow-y-auto">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-100 truncate">{u.name} {u.role === 'admin' && <span className="text-amber-300 text-xs">👑 אדמין</span>}{!u.is_active && <span className="text-slate-500 text-xs"> (מושבת)</span>}</p>
              <p className="text-xs text-slate-500 truncate" dir="ltr" style={{ direction: 'ltr', textAlign: 'right' }}>{u.email}</p>
            </div>
            {u.role === 'admin' ? <span className="text-xs text-slate-500">תמיד</span> : (
              <>
                <button onClick={() => toggleReviewer(u)} role="switch" aria-checked={u.quiz_reviewer}
                  title="בודק שאלות: משחק גם בממתינות ומאשר/פוסל/עורך שאלות"
                  className={`min-w-[88px] px-3 py-1.5 rounded-lg text-sm font-bold ${u.quiz_reviewer ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                  {u.quiz_reviewer ? '🔍 בודק' : 'לא בודק'}
                </button>
                <button onClick={() => toggle(u)} role="switch" aria-checked={u.quiz_access} disabled={u.quiz_reviewer}
                  className={`min-w-[88px] px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-60 ${u.quiz_access ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-600'}`}>
                  {u.quiz_access ? '✓ יש גישה' : 'אין גישה'}
                </button>
              </>
            )}
          </div>
        ))}
        {users.length === 0 && <p className="text-center text-slate-500 py-4 text-sm">לא נמצאו משתמשים</p>}
      </div>
    </div>
  );
}

// ── שאלות: סקירה, אישור, עריכה ────────────────────────────────────────────
const EMPTY = { category: 'rules', difficulty: 2, question: '', options: ['', '', '', ''], correct: 0, explanation: '', source: '', status: 'approved', venue_id: '' };

export function QuestionsSection({ presetClub = null, onSaved }) {
  const [status, setStatus] = useState(presetClub ? '' : 'pending');
  const [category, setCategory] = useState(presetClub ? 'club' : '');
  const [data, setData] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get('/quiz/admin/questions', { params: { status: status || undefined, category: category || undefined } }).then((r) => setData(r.data));
  }, [status, category]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/quiz/admin/clubs').then((r) => setClubs(r.data)).catch(() => {}); }, []);

  const setStatusOf = async (ids, st) => {
    try { await api.post('/quiz/admin/questions/status', { ids, status: st }); load(); } catch (e) { setMsg(errMsg(e)); }
  };
  const approveShown = () => {
    const ids = data.questions.filter((q) => q.status === 'pending').map((q) => q.id);
    if (!ids.length || !window.confirm(`לאשר ${ids.length} שאלות שמוצגות כאן? כדאי לעבור עליהן קודם.`)) return;
    setStatusOf(ids, 'approved');
  };

  if (!data) return <p className="text-slate-400 py-6 text-center">טוען…</p>;
  const cats = data.categories;
  const shown = presetClub ? data.questions.filter((q) => q.venue_id === presetClub.id) : data.questions;
  const total = (st) => data.counts.filter((c) => c.status === st).reduce((a, c) => a + c.n, 0);

  return (
    <div className="space-y-3">
      {!presetClub && (
        <div className="flex flex-wrap gap-2 text-sm text-slate-300">
          {Object.entries(STATUS).map(([k, l]) => <span key={k}>{l}: <b>{total(k)}</b></span>)}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        {!presetClub && (
          <>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg bg-slate-900 border border-slate-600 px-2 py-2 text-sm">
              <option value="">כל הסטטוסים</option>
              {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg bg-slate-900 border border-slate-600 px-2 py-2 text-sm">
              <option value="">כל הנושאים</option>
              {Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </>
        )}
        <button onClick={() => setEditing(presetClub ? { ...EMPTY, category: 'club', venue_id: presetClub.id } : { ...EMPTY })}
          className="px-3 py-2 rounded-lg bg-poker-green text-white text-sm font-bold">➕ שאלה חדשה</button>
        {shown.some((q) => q.status === 'pending') && (
          <button onClick={approveShown} className="px-3 py-2 rounded-lg border border-emerald-500/50 text-emerald-200 text-sm">✅ לאשר את כל הממתינות שמוצגות</button>
        )}
        {msg && <span className="text-sm text-red-300">{msg}</span>}
      </div>
      {!presetClub && <p className="text-xs text-slate-500">טיפ: אפשר גם לשחק בשעשועון — אתה רואה בו שאלות ממתינות, ו"לפסול את השאלה" אחרי כל תשובה מוריד אותה מיד.</p>}

      {editing && (
        <QuestionForm initial={editing} categories={cats} clubs={clubs}
          onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); onSaved?.(); }} />
      )}

      <div className="space-y-2">
        {shown.map((q) => (
          <div key={q.id} className={`rounded-xl border p-3 ${q.flags > 0 ? 'border-red-500/50' : 'border-slate-700'} bg-slate-900/60`}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
              <span className="px-2 py-0.5 rounded bg-slate-800">{cats[q.category]}{q.venue_name ? ` · ${q.venue_name}` : ''}</span>
              <span>{DIFF[q.difficulty]}</span>
              <span>{STATUS[q.status]}{q.reviewed_by_name ? ` · ע"י ${q.reviewed_by_name}` : ''}</span>
              {q.times_shown > 0 && <span>הוצגה {q.times_shown} · {Math.round((q.times_correct / q.times_shown) * 100)}% צדקו</span>}
              {q.flags > 0 && <span className="text-red-300 font-bold">🚩 {q.flags} דיווחים{q.flag_reasons?.length ? `: ${q.flag_reasons.slice(0, 3).join(' | ')}` : ''}</span>}
            </div>
            <p className="text-slate-100 font-semibold">{q.question}</p>
            <ol className="mt-1 text-sm space-y-0.5">
              {q.options.map((o, i) => <li key={i} className={i === q.correct ? 'text-emerald-300 font-bold' : 'text-slate-400'}>{i === q.correct ? '✓ ' : '• '}{o}</li>)}
            </ol>
            {q.explanation && <p className="text-xs text-slate-400 mt-1">💡 {q.explanation}</p>}
            {q.source && (/^https?:\/\//.test(q.source)
              ? <a href={q.source} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline break-all" dir="ltr">{q.source}</a>
              : <p className="text-xs text-slate-500">מקור: {q.source}</p>)}
            <div className="flex gap-2 mt-2">
              {q.status !== 'approved' && <button onClick={() => setStatusOf([q.id], 'approved')} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">אשר</button>}
              {q.status !== 'rejected' && <button onClick={() => setStatusOf([q.id], 'rejected')} className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 text-xs">פסול</button>}
              <button onClick={() => setEditing({ ...q, venue_id: q.venue_id || '', explanation: q.explanation || '', source: q.source || '' })}
                className="px-3 py-1 rounded-lg border border-slate-600 text-slate-300 text-xs">ערוך</button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-center text-slate-500 py-6">אין שאלות בסינון הזה</p>}
      </div>
    </div>
  );
}

function QuestionForm({ initial, categories, clubs, onCancel, onSaved }) {
  const [f, setF] = useState(() => ({ ...initial, options: [...initial.options, '', '', '', ''].slice(0, 4) }));
  const [err, setErr] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setErr('');
    const options = f.options.map((o) => o.trim());
    const keep = options.map((o, i) => [o, i]).filter(([o]) => o);
    const body = { ...f, options: keep.map(([o]) => o), correct: keep.findIndex(([, i]) => i === Number(f.correct)), venue_id: f.category === 'club' ? f.venue_id : null };
    try {
      if (f.id) await api.put(`/quiz/admin/questions/${f.id}`, body);
      else await api.post('/quiz/admin/questions', body);
      onSaved();
    } catch (e) { setErr(errMsg(e)); }
  };
  const input = 'w-full rounded-lg bg-slate-950 border border-slate-600 px-3 py-2 text-sm text-slate-100';
  return (
    <div className="rounded-xl border border-sky-500/50 bg-slate-900 p-4 space-y-2">
      <p className="font-bold text-sky-200">{f.id ? 'עריכת שאלה' : 'שאלה חדשה'}</p>
      <div className="flex flex-wrap gap-2">
        <select value={f.category} onChange={(e) => set('category', e.target.value)} className="rounded-lg bg-slate-950 border border-slate-600 px-2 py-2 text-sm">
          {Object.entries(categories).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {f.category === 'club' && (
          <select value={f.venue_id} onChange={(e) => set('venue_id', e.target.value)} className="rounded-lg bg-slate-950 border border-slate-600 px-2 py-2 text-sm">
            <option value="">בחר מועדון…</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={f.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))} className="rounded-lg bg-slate-950 border border-slate-600 px-2 py-2 text-sm">
          {Object.entries(DIFF).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={f.status} onChange={(e) => set('status', e.target.value)} className="rounded-lg bg-slate-950 border border-slate-600 px-2 py-2 text-sm">
          {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <textarea value={f.question} onChange={(e) => set('question', e.target.value)} rows={2} placeholder="השאלה" className={input} />
      {f.options.map((o, i) => (
        <label key={i} className="flex items-center gap-2">
          <input type="radio" name="correct" checked={Number(f.correct) === i} onChange={() => set('correct', i)} aria-label={`תשובה ${i + 1} נכונה`} />
          <input value={o} onChange={(e) => set('options', f.options.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={i < 2 ? `תשובה ${i + 1}` : `תשובה ${i + 1} (לא חובה)`} className={input} />
        </label>
      ))}
      <p className="text-xs text-slate-500">סמן את העיגול ליד התשובה הנכונה. נכון/לא נכון = רק שתי תשובות.</p>
      <input value={f.explanation} onChange={(e) => set('explanation', e.target.value)} placeholder="הסבר קצר (מוצג אחרי התשובה)" className={input} />
      <input value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="מקור (קישור או ספר)" className={input} />
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="px-4 py-2 rounded-lg bg-poker-green text-white text-sm font-bold">שמור</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-400 text-sm">ביטול</button>
      </div>
    </div>
  );
}

// ── מועדונים: שאלות לכל מועדון + QR לשולחן ────────────────────────────────
function ClubsSection() {
  const [clubs, setClubs] = useState(null);
  const [open, setOpen] = useState(null); // { club, qr, link }
  const [questionsFor, setQuestionsFor] = useState(null);
  const load = useCallback(() => api.get('/quiz/admin/clubs').then((r) => setClubs(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const showQr = async (c) => {
    const r = await api.get(`/quiz/admin/clubs/${c.id}/qr`);
    setOpen({ club: c, ...r.data });
  };

  if (!clubs) return <p className="text-slate-400 py-6 text-center">טוען…</p>;
  return (
    <div className="space-y-3 max-w-3xl">
      <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-4 text-sm text-slate-200 space-y-1">
        <p className="font-bold text-violet-200">🏠 צ'אלנג' מועדון</p>
        <p>מדביקים את ה-QR על השולחנות במועדון. מי שסורק נכנס ל"צ'אלנג'" של המועדון: 10 שאלות, עד 4 מהן על המועדון עצמו, וטבלת דירוג נפרדת לשחקני המועדון — בסיס טוב לפרס מהמועדון.</p>
        <p className="text-slate-400">בשלב הסגור רק משתמשים שאישרת יכולים לשחק — גם אחרי סריקה.</p>
      </div>
      {open && (
        <div className="rounded-xl border border-slate-600 bg-white p-4 text-center">
          <img src={open.qr} alt={`QR לצ'אלנג' של ${open.club.name}`} className="mx-auto w-56 h-56" />
          <p className="text-slate-900 font-black mt-2">{QUIZ_NAME} · הצ'אלנג' של {open.club.name}</p>
          <p className="text-xs text-slate-600 break-all" dir="ltr">{open.link}</p>
          <div className="flex gap-2 justify-center mt-3">
            <a href={open.qr} download={`quiz-qr-${open.club.id}.png`} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold">⬇️ הורד QR</a>
            <button onClick={() => navigator.clipboard?.writeText(open.link)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-900 text-sm">📋 העתק קישור</button>
            <button onClick={() => setOpen(null)} className="px-4 py-2 rounded-lg text-slate-600 text-sm">סגור</button>
          </div>
        </div>
      )}
      {clubs.map((c) => (
        <div key={c.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex items-center gap-3 flex-wrap">
            {c.logo_url ? <img src={c.logo_url} alt="" className="w-10 h-10 rounded-full object-cover bg-slate-800" /> : <span className="w-10 h-10 rounded-full bg-slate-800" />}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">{c.name}</p>
              <p className="text-xs text-slate-400">{c.approved} שאלות מאושרות{c.pending ? ` · ${c.pending} ממתינות` : ''}</p>
            </div>
            <button onClick={() => showQr(c)} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-bold">QR</button>
            <button onClick={() => setQuestionsFor(questionsFor?.id === c.id ? null : c)} className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-sm">
              {questionsFor?.id === c.id ? 'סגור' : 'שאלות המועדון'}
            </button>
          </div>
          {questionsFor?.id === c.id && <div className="mt-3"><QuestionsSection presetClub={c} onSaved={load} /></div>}
        </div>
      ))}
    </div>
  );
}
