import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { CLUBS } from '../../data/onlineClubs';

// תיקיית Google Drive לכל קלאב אונליין (server/services/drivePromos.js): מה שבתיקייה = הפרסומים
// של הקלאב באתר, מתעדכן לבד 6 פעמים ביום. קלאב עם תיקייה מתעלם מהפרסומים שלו באקסל.
const fmt = (d) => (d ? new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function ClubRow({ club, status, onSaved }) {
  const [link, setLink] = useState(status?.folderUrl || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  useEffect(() => { setLink(status?.folderUrl || ''); }, [status?.folderUrl]);

  const save = async (value) => {
    setBusy(true); setMsg(null);
    try {
      const { data } = await api.put(`/admin/drive-promos/${club.id}`, { clubName: club.name, link: value });
      if (data.removed) setMsg({ ok: true, text: 'התיקייה הוסרה — הקלאב חוזר לפרסומים מהאקסל' });
      else if (typeof data.synced === 'number') setMsg({ ok: true, text: `נשמר ✓ ${data.synced} פרסומים מהתיקייה כבר באתר` });
      else setMsg({ ok: false, text: `נשמר, אבל הסנכרון נכשל: ${data.synced}` });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'שגיאה בשמירה' });
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-bold text-white">{club.name}</h4>
        {status ? (
          <span className="text-xs text-slate-400">
            📁 מהדרייב · {status.promos.length} פרסומים{status.syncedAt ? ` · עודכן ${fmt(status.syncedAt)}` : ''}
          </span>
        ) : (
          <span className="text-xs text-slate-500">אין תיקייה — פרסומים מהאקסל</span>
        )}
      </div>
      {status?.error && (
        <p className="text-xs text-amber-300 mt-1">⚠️ הקריאה האחרונה נכשלה ({fmt(status.failedAt)}) — מוצגים הפרסומים מהפעם הקודמת</p>
      )}
      <div className="flex gap-2 mt-3 flex-wrap">
        <input value={link} onChange={(e) => setLink(e.target.value)} dir="ltr" style={{ direction: 'ltr' }} placeholder="https://drive.google.com/drive/folders/..."
          className="flex-1 min-w-[220px] rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-slate-100" />
        <button disabled={busy || !link.trim()} onClick={() => save(link.trim())}
          className="px-4 py-2 rounded-lg bg-poker-green text-white text-sm font-bold disabled:opacity-40">
          {busy ? 'בודק...' : 'שמור וסנכרן'}
        </button>
        {status && (
          <button disabled={busy} onClick={() => window.confirm(`להסיר את התיקייה של ${club.name}?`) && save('')}
            className="px-3 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm disabled:opacity-40">הסר</button>
        )}
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      {status?.promos.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {status.promos.map((p) => (
            <img key={p.image} src={p.image} alt={p.alt} title={p.alt} className="h-20 w-20 object-cover rounded-lg border border-slate-600" />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DrivePromos() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const load = () => api.get('/admin/drive-promos').then((r) => setStatus(r.data)).catch(() => setStatus([]));
  useEffect(() => { load(); }, []);

  const syncAll = async () => {
    setSyncing(true);
    try { await api.post('/admin/drive-promos/sync'); await load(); } finally { setSyncing(false); }
  };

  if (!status) return <div className="text-center py-10 text-slate-400">טוען...</div>;
  const byClub = Object.fromEntries(status.map((s) => [s.clubId, s]));
  // קלאב שיש לו תיקייה אבל כבר לא ברשימת הקלאבים (הוסר מהאקסל) — עדיין מוצג כדי שאפשר יהיה להסיר
  const clubs = [...CLUBS, ...status.filter((s) => !CLUBS.some((c) => c.id === s.clubId)).map((s) => ({ id: s.clubId, name: s.clubName }))];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-slate-200 space-y-1">
        <p className="font-bold text-sky-300">📁 פרסומי אונליין מגוגל דרייב</p>
        <p>לכל קלאב תיקייה משלו: מה שבתיקייה הוא מה שמוצג באתר. מוסיפים תמונה = פרסום חדש, מוחקים = הפרסום יורד.</p>
        <p>האתר בודק את התיקיות לבד ב-09:00, 10:00, 11:00, 14:35, 15:00, 16:00. רוצים עכשיו? "סנכרן עכשיו".</p>
        <p className="text-slate-400">הגדרת תיקייה: בדרייב ← תיקייה חדשה ← שיתוף ← "כל מי שיש לו את הקישור" (צפייה) ← העתקת קישור ← הדבקה כאן.
          אפשר לשתף את התיקייה עם המועדון (עריכה) כדי שיעלו את הפרסומים בעצמם.</p>
      </div>
      <button onClick={syncAll} disabled={syncing}
        className="px-4 py-2 rounded-lg border border-sky-500/60 text-sky-200 text-sm font-bold disabled:opacity-40">
        {syncing ? 'מסנכרן...' : '🔄 סנכרן עכשיו את כל התיקיות'}
      </button>
      {clubs.map((c) => <ClubRow key={c.id} club={c} status={byClub[c.id]} onSaved={load} />)}
    </div>
  );
}
