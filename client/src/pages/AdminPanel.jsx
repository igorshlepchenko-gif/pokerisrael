import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate, formatTime, formatCost } from '../utils/whatsapp';

// ---- helpers for change log diff ----
const VENUE_LABELS = {
  name: 'שם מועדון', address: 'כתובת', city: 'עיר',
  whatsapp_number: 'וואטסאפ', description: 'תיאור', logo_url: 'לוגו',
};
const TOURNAMENT_LABELS = {
  name: 'שם טורניר', cost: 'עלות', start_time: 'שעת התחלה',
  estimated_end_time: 'שעת סיום', description: 'תיאור',
  is_recurring: 'חוזר שבועי', day_of_week: 'יום בשבוע',
  re_entry: 'כניסה חוזרת', late_reg_level: 'Late Reg שלב',
  starting_stack: 'Stack פתיחה', level_duration: 'משך שלב (דק\')',
};
const TRACKED_VENUE_FIELDS = Object.keys(VENUE_LABELS);
const TRACKED_TOURNAMENT_FIELDS = Object.keys(TOURNAMENT_LABELS);

function computeDiff(entityType, oldData, newData) {
  if (!oldData || !newData) return [];
  const fields = entityType === 'venue' ? TRACKED_VENUE_FIELDS : TRACKED_TOURNAMENT_FIELDS;
  const labels = entityType === 'venue' ? VENUE_LABELS : TOURNAMENT_LABELS;
  const diffs = [];
  for (const field of fields) {
    const oldVal = oldData[field] ?? null;
    const newVal = newData[field] ?? null;
    const oldStr = oldVal === null ? '—' : String(oldVal);
    const newStr = newVal === null ? '—' : String(newVal);
    if (oldStr !== newStr) {
      diffs.push({ label: labels[field] || field, oldStr, newStr });
    }
  }
  return diffs;
}

function ChangeLogRow({ log }) {
  const [open, setOpen] = useState(false);
  const diffs = computeDiff(log.entity_type, log.old_data, log.new_data);
  const typeLabel = log.entity_type === 'venue' ? '🏠 מועדון' : log.entity_type === 'user' ? '👤 משתמש' : '🃏 טורניר';
  const actionLabel = log.action === 'update' ? 'עדכון' : 'יצירה';
  const dateStr = new Date(log.created_at).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="card p-0 overflow-hidden">
      {/* row header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 shrink-0">{typeLabel}</span>
          <span className="font-semibold text-slate-100 truncate">{log.entity_name}</span>
          <span className="text-xs text-slate-500">#{log.entity_id}</span>
          <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full shrink-0">{actionLabel}</span>
          {diffs.length > 0 && (
            <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full shrink-0">
              {diffs.length} שינויים
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-left">
            <p className="text-xs text-slate-400">{log.changed_by_name}</p>
            <p className="text-xs text-slate-500">{dateStr}</p>
          </div>
          <span className="text-slate-500 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* diff details */}
      {open && (
        <div className="border-t border-slate-700/60 px-5 py-4 bg-slate-800/40">
          {diffs.length === 0 ? (
            <p className="text-sm text-slate-500">לא נמצאו שינויים בשדות מעקב</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-right">
                    <th className="pb-2 pr-2 text-slate-400 font-semibold w-36">שדה</th>
                    <th className="pb-2 px-3 text-red-400 font-semibold">לפני</th>
                    <th className="pb-2 px-3 text-green-400 font-semibold">אחרי</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map(({ label, oldStr, newStr }) => (
                    <tr key={label} className="border-t border-slate-700/40">
                      <td className="py-1.5 pr-2 text-slate-400 font-medium">{label}</td>
                      <td className="py-1.5 px-3 text-red-300 bg-red-900/10 rounded-r-none max-w-xs break-words">
                        {oldStr.length > 80 ? oldStr.slice(0, 80) + '…' : oldStr}
                      </td>
                      <td className="py-1.5 px-3 text-green-300 bg-green-900/10 max-w-xs break-words">
                        {newStr.length > 80 ? newStr.slice(0, 80) + '…' : newStr}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const isPast = (t) =>
  !t.is_recurring && new Date(t.estimated_end_time || t.start_time) < new Date();

export default function AdminPanel() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState({ venues: [], tournaments: [] });
  const [users, setUsers] = useState([]);
  const [allTournaments, setAllTournaments] = useState([]);
  const [allVenues, setAllVenues] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [changeLogsTotal, setChangeLogsTotal] = useState(0);
  const [clEntityType, setClEntityType] = useState('');
  const [clAction, setClAction] = useState('');
  const [clDateFrom, setClDateFrom] = useState('');
  const [clDateTo, setClDateTo] = useState('');
  const [clSearch, setClSearch] = useState('');
  const [clSearchInput, setClSearchInput] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [regSearch, setRegSearch] = useState('');
  const [regTotal, setRegTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [boostLabel, setBoostLabel] = useState({});
  const [deleteVenueModal, setDeleteVenueModal] = useState(null); // venue object
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchData(); }, [tab, clEntityType, clAction, clDateFrom, clDateTo, clSearch, regSearch]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'pending') {
        const res = await api.get('/admin/pending');
        setPending(res.data);
      } else if (tab === 'venues') {
        const res = await api.get('/admin/venues/all');
        setAllVenues(res.data);
      } else if (tab === 'tournaments') {
        const res = await api.get('/admin/tournaments');
        setAllTournaments(res.data);
      } else if (tab === 'changelog') {
        const res = await api.get('/admin/change-logs', {
          params: {
            entity_type: clEntityType || undefined,
            action:      clAction     || undefined,
            date_from:   clDateFrom   || undefined,
            date_to:     clDateTo     || undefined,
            search:      clSearch     || undefined,
            limit: 200,
          },
        });
        setChangeLogs(res.data.logs);
        setChangeLogsTotal(res.data.total);
      } else if (tab === 'registrations') {
        const res = await api.get('/registrations', {
          params: { search: regSearch || undefined, limit: 200 },
        });
        setRegistrations(res.data.registrations);
        setRegTotal(res.data.total);
      } else {
        const res = await api.get('/admin/users');
        setUsers(res.data);
      }
    } catch {/* ignore */}
    finally { setLoading(false); }
  };

  const boostTournament = async (id) => {
    const label = boostLabel[id] || 'מקודם';
    const res = await api.patch(`/admin/tournaments/${id}/boost`, { label });
    setAllTournaments(prev =>
      prev.map(t => t.id === id ? { ...t, is_boosted: res.data.is_boosted, boost_label: res.data.boost_label } : t)
    );
  };

  const approveVenue = async (id) => {
    await api.patch(`/admin/venues/${id}/approve`);
    fetchData();
  };

  const rejectVenue = async (id) => {
    await api.delete(`/admin/venues/${id}`);
    fetchData();
  };

  const approveTournament = async (id) => {
    await api.patch(`/admin/tournaments/${id}/approve`);
    fetchData();
  };

  const rejectTournament = async () => {
    await api.patch(`/admin/tournaments/${rejectModal}/reject`, { reason: rejectReason });
    setRejectModal(null);
    setRejectReason('');
    fetchData();
  };

  const toggleUser = async (id) => {
    await api.patch(`/admin/users/${id}/toggle`);
    fetchData();
  };

  const unlockUser = async (id) => {
    await api.patch(`/admin/users/${id}/unlock`);
    fetchData();
  };

  const handleDeleteVenue = async () => {
    if (!deleteVenueModal) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/venues/${deleteVenueModal.id}`);
      setDeleteVenueModal(null);
      fetchData();
    } catch {
      alert('שגיאה במחיקת המועדון');
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPending = pending.venues.length + pending.tournaments.length;
  const lockedCount = users.filter(u => u.is_locked).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-black text-white">⚙️ פנל ניהול</h1>
        {totalPending > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {totalPending}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
        {[
          ['pending', `⏳ ממתין לאישור${totalPending > 0 ? ` (${totalPending})` : ''}`],
          ['venues', '📍 מועדונים'],
          ['tournaments', '🚀 קידומים'],
          ['users', `👥 משתמשים${lockedCount > 0 ? ` 🔒${lockedCount}` : ''}`],
          ['changelog', '📋 יומן שינויים'],
          ['registrations', `📝 הרשמות${regTotal > 0 ? ` (${regTotal})` : ''}`],
          ['hand-logger', '🃏 רישום ידיים'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === id ? 'bg-poker-green text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">טוען...</div>
      ) : (
        <>
          {/* Pending approvals */}
          {tab === 'pending' && (
            <div className="space-y-6">
              {/* Pending venues */}
              {pending.venues.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-slate-300 mb-3">🏠 מועדונים ממתינים לאישור</h2>
                  <div className="space-y-3">
                    {pending.venues.map(v => (
                      <div key={v.id} className="card p-4">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                          <div>
                            <h3 className="font-bold text-slate-100">{v.name}</h3>
                            {v.venue_type === 'online' ? (
                              <p className="text-sm text-slate-400">💻 מועדון אונליין · מספר: <span className="text-slate-200 font-semibold">{v.club_number}</span>{v.agent_number ? ` · סוכן: ${v.agent_number}` : ''}</p>
                            ) : (
                              <p className="text-sm text-slate-400">📍 {v.address}, {v.city}</p>
                            )}
                            <p className="text-sm text-slate-400">📱 {v.whatsapp_number}</p>
                            <p className="text-xs text-slate-500 mt-1">בעלים: {v.owner_name} · {v.owner_email} · {v.owner_phone}</p>
                            {v.description && <p className="text-sm text-slate-400 mt-1">{v.description}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => approveVenue(v.id)} className="btn-primary text-sm">✅ אשר</button>
                            <button onClick={() => rejectVenue(v.id)} className="bg-red-900/30 hover:bg-red-900/60 text-red-400 text-sm font-semibold py-2 px-4 rounded-xl transition-all">❌ דחה</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending tournaments */}
              {pending.tournaments.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-slate-300 mb-3">🃏 טורנירים ממתינים לאישור</h2>
                  <div className="space-y-3">
                    {pending.tournaments.map(t => (
                      <div key={t.id} className="card p-4">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                          <div>
                            <h3 className="font-bold text-slate-100">{t.name}</h3>
                            <p className="text-sm text-slate-400">{t.venue_name} · {formatDate(t.start_time)} {formatTime(t.start_time)}</p>
                            <p className="text-sm text-poker-gold">{formatCost(t.cost)}</p>
                            <p className="text-xs text-slate-500 mt-1">הוזן ע"י: {t.owner_name}</p>
                            {t.description && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{t.description}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => approveTournament(t.id)} className="btn-primary text-sm">✅ אשר</button>
                            <button onClick={() => { setRejectModal(t.id); setRejectReason(''); }}
                              className="bg-red-900/30 hover:bg-red-900/60 text-red-400 text-sm font-semibold py-2 px-4 rounded-xl transition-all">❌ דחה</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalPending === 0 && (
                <div className="card p-16 text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-slate-400 font-semibold">אין פריטים ממתינים לאישור</p>
                </div>
              )}
            </div>
          )}

          {/* All venues */}
          {tab === 'venues' && (
            <div className="space-y-4">
              {allVenues.length === 0 && (
                <div className="card p-12 text-center text-slate-500">אין מועדונים רשומים</div>
              )}
              {allVenues.map(v => (
                <div key={v.id} className={`card p-5 ${!v.is_approved ? 'border-amber-500/30' : 'border-green-700/20'}`}>
                  <div className="flex items-start gap-5 flex-wrap">

                    {/* לוגו גדול */}
                    {v.logo_url ? (
                      <img src={v.logo_url} alt="לוגו"
                        className="w-28 h-28 rounded-2xl object-cover shrink-0 border-2 border-slate-600 shadow-lg" />
                    ) : (
                      <div className="w-28 h-28 rounded-2xl bg-slate-700 flex items-center justify-center text-5xl shrink-0 border-2 border-slate-600">
                        🏠
                      </div>
                    )}

                    {/* פרטים */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-black text-slate-100">{v.name}</h3>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${v.is_approved ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>
                          {v.is_approved ? '✅ מאושר' : '⏳ ממתין לאישור'}
                        </span>
                      </div>
                      {v.venue_type === 'online' ? (
                        <p className="text-base text-slate-300">💻 מועדון אונליין · מספר: <span className="font-bold">{v.club_number}</span>{v.agent_number ? ` · סוכן: ${v.agent_number}` : ''}</p>
                      ) : (
                        <p className="text-base text-slate-300">📍 {v.address}, {v.city}</p>
                      )}
                      <p className="text-base text-slate-300">📱 {v.whatsapp_number}</p>
                      <p className="text-sm text-slate-500 pt-1">
                        👤 בעלים: <span className="text-slate-400">{v.owner_name}</span>
                        <span className="mx-2">·</span>
                        <span className="text-slate-400">{v.owner_email}</span>
                        {v.owner_phone && <><span className="mx-2">·</span><span className="text-slate-400">{v.owner_phone}</span></>}
                      </p>
                      {v.description && (
                        <p className="text-sm text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2 mt-1">{v.description}</p>
                      )}
                    </div>

                    {/* כפתורים */}
                    <div className="flex flex-col gap-2 shrink-0 self-center">
                      {!v.is_approved && (
                        <button onClick={() => approveVenue(v.id)} className="btn-primary">✅ אשר מועדון</button>
                      )}
                      <button
                        onClick={() => setDeleteVenueModal(v)}
                        className="bg-red-900/30 hover:bg-red-900/60 text-red-400 font-semibold py-2 px-4 rounded-xl transition-all text-center text-sm"
                      >
                        🗑️ מחק מועדון
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Promotions / boost */}
          {tab === 'tournaments' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">סמן טורנירים כ"מקודמים" — הם יופיעו ראשונים בתוצאות גם אם לא תואמים את הסינון של הגולש.</p>
              {allTournaments.length === 0 && (
                <div className="card p-12 text-center text-slate-500">אין טורנירים מאושרים</div>
              )}
              {allTournaments.map(t => {
                const past = isPast(t);
                return (
                <div key={t.id} className={`card p-4 flex items-center justify-between flex-wrap gap-3 ${t.is_boosted ? 'border-amber-500/40 bg-amber-500/5' : ''} ${past ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-100">{t.name}</span>
                      {t.is_boosted && (
                        <span className="bg-amber-500/20 text-amber-400 text-xs font-black px-2 py-0.5 rounded-full">
                          🚀 {t.boost_label || 'מקודם'}
                        </span>
                      )}
                      {past && (
                        <span className="text-[10px] bg-slate-700/80 text-slate-400 px-1.5 py-0.5 rounded-full border border-slate-600">🕐 עבר</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{t.venue_name} · {formatDate(t.start_time)} {formatTime(t.start_time)} · {formatCost(t.cost)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!t.is_boosted && (
                      <input
                        type="text"
                        value={boostLabel[t.id] || ''}
                        onChange={e => setBoostLabel(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="תווית (ברירת מחדל: מקודם)"
                        className="input-field text-sm w-44 py-1.5"
                      />
                    )}
                    <button
                      onClick={() => boostTournament(t.id)}
                      className={`text-sm font-bold py-1.5 px-4 rounded-xl transition-all whitespace-nowrap ${
                        t.is_boosted
                          ? 'bg-amber-900/40 text-amber-400 hover:bg-amber-900/70'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      {t.is_boosted ? '⬇️ הסר קידום' : '🚀 קדם'}
                    </button>
                  </div>
                </div>
              );})}
            </div>
          )}

          {/* Registration log */}
          {tab === 'registrations' && (
            <div>
              {/* כותרת + חיפוש + ייצוא */}
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <input
                  type="text"
                  value={regSearch}
                  onChange={e => setRegSearch(e.target.value)}
                  placeholder="חיפוש לפי שם, טורניר או מועדון..."
                  className="input-field flex-1 min-w-48 py-2 text-sm"
                />
                <a
                  href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/registrations/export`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={async (e) => {
                    e.preventDefault();
                    const token = localStorage.getItem('pli_token');
                    const res = await fetch('/api/registrations/export', {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `registrations_${new Date().toISOString().slice(0,10)}.xlsx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 bg-green-900/30 hover:bg-green-900/60 text-green-400 font-semibold py-2 px-4 rounded-xl transition-all text-sm shrink-0 border border-green-700/30"
                >
                  📊 ייצוא לאקסל
                </a>
                <span className="text-xs text-slate-500 shrink-0">{regTotal} הרשמות סה"כ</span>
              </div>

              {registrations.length === 0 ? (
                <div className="card p-16 text-center">
                  <div className="text-5xl mb-3">📝</div>
                  <p className="text-slate-400 font-semibold">אין הרשמות עדיין</p>
                  <p className="text-slate-600 text-sm mt-1">הרשמות דרך WhatsApp יירשמו כאן אוטומטית</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-right">
                        <th className="py-3 px-4 text-slate-400 font-semibold">תאריך הרשמה</th>
                        <th className="py-3 px-4 text-slate-400 font-semibold">שם הנרשם</th>
                        <th className="py-3 px-4 text-slate-400 font-semibold">טלפון</th>
                        <th className="py-3 px-4 text-slate-400 font-semibold">שם טורניר</th>
                        <th className="py-3 px-4 text-slate-400 font-semibold">מועדון</th>
                        <th className="py-3 px-4 text-slate-400 font-semibold">תאריך טורניר</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((r, i) => (
                        <tr key={r.id}
                          className={`border-t border-slate-700/50 hover:bg-slate-700/20 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-800/30'}`}>
                          <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                            {new Date(r.created_at).toLocaleString('he-IL', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-100">{r.registrant_name}</td>
                          <td className="py-3 px-4 text-slate-400 dir-ltr text-left">{r.registrant_phone || '—'}</td>
                          <td className="py-3 px-4 text-slate-300">{r.tournament_name}</td>
                          <td className="py-3 px-4 text-poker-green-light">{r.venue_name}</td>
                          <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                            {r.tournament_date
                              ? new Date(r.tournament_date).toLocaleString('he-IL', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Change log */}
          {tab === 'changelog' && (
            <div>
              {/* Search */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={clSearchInput}
                  onChange={e => setClSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setClSearch(clSearchInput)}
                  placeholder="חיפוש חופשי: שם, מייל, כתובת..."
                  className="input-field flex-1 text-sm py-2"
                />
                <button
                  onClick={() => setClSearch(clSearchInput)}
                  className="btn-primary px-5 text-sm"
                >
                  🔍 חפש
                </button>
                {clSearch && (
                  <button
                    onClick={() => { setClSearch(''); setClSearchInput(''); }}
                    className="btn-ghost text-sm px-3"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="card p-4 mb-5 space-y-3">
                {/* Entity type */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 w-16 shrink-0">ישות:</span>
                  {[['', 'הכל'], ['venue', '🏠 מועדון'], ['tournament', '🃏 טורניר'], ['user', '👤 משתמש']].map(([val, label]) => (
                    <button key={val} onClick={() => setClEntityType(val)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${clEntityType === val ? 'bg-poker-green text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Action */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 w-16 shrink-0">פעולה:</span>
                  {[['', 'הכל'], ['create', '✨ יצירה'], ['update', '✏️ עדכון']].map(([val, label]) => (
                    <button key={val} onClick={() => setClAction(val)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${clAction === val ? 'bg-poker-green text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Date range */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-slate-500 w-16 shrink-0">תאריכים:</span>
                  <input type="date" value={clDateFrom} onChange={e => setClDateFrom(e.target.value)}
                    className="input-field text-xs py-1.5 w-36" dir="ltr" />
                  <span className="text-slate-500 text-xs">עד</span>
                  <input type="date" value={clDateTo} onChange={e => setClDateTo(e.target.value)}
                    className="input-field text-xs py-1.5 w-36" dir="ltr" />
                  {(clDateFrom || clDateTo) && (
                    <button onClick={() => { setClDateFrom(''); setClDateTo(''); }}
                      className="text-xs text-slate-400 hover:text-slate-200">✕ נקה</button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500">{changeLogsTotal} רשומות סה״כ · מוצגות {changeLogs.length}</span>
                {(clEntityType || clAction || clDateFrom || clDateTo || clSearch) && (
                  <button onClick={() => { setClEntityType(''); setClAction(''); setClDateFrom(''); setClDateTo(''); setClSearch(''); setClSearchInput(''); }}
                    className="text-xs text-amber-400 hover:text-amber-300">↺ אפס הכל</button>
                )}
              </div>

              {changeLogs.length === 0 ? (
                <div className="card p-16 text-center">
                  <div className="text-5xl mb-3">📋</div>
                  <p className="text-slate-400 font-semibold">לא נמצאו רשומות</p>
                  <p className="text-slate-600 text-sm mt-1">נסה לשנות את הסינון</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {changeLogs.map(log => (
                    <ChangeLogRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Users */}
          {tab === 'hand-logger' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="rounded-2xl p-5 border border-blue-500/20"
                style={{ background: 'linear-gradient(135deg, rgba(13,21,38,0.95), rgba(6,9,26,0.95))' }}>
                <div className="flex items-center gap-3 mb-2" dir="rtl">
                  <span className="text-3xl">🃏</span>
                  <div>
                    <h2 className="text-lg font-black text-white">ניהול גישה — מודול רישום ידיים</h2>
                    <p className="text-sm text-slate-400">אפשר או חסום גישה למודול לכל משתמש בנפרד</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap" dir="rtl">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ✅ {users.filter(u => u.hand_logger_access).length} משתמשים עם גישה
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-400">
                    {users.filter(u => !u.hand_logger_access && u.role !== 'admin').length} ללא גישה
                  </span>
                </div>
              </div>

              {/* Users list */}
              <div className="space-y-2">
                {users.filter(u => u.role !== 'admin').map(u => {
                  const hasAccess = !!u.hand_logger_access;
                  return (
                    <div key={u.id}
                      className={`rounded-2xl border p-4 flex items-center justify-between gap-4 transition-all
                        ${hasAccess
                          ? 'border-blue-500/30 bg-blue-500/5'
                          : 'border-slate-700/60 bg-slate-800/40'}`}>
                      <div dir="rtl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-100">{u.name}</span>
                          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                            {u.role === 'venue_owner' ? '🏠 מועדון' : '🃏 שחקן'}
                          </span>
                          {hasAccess && (
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              ✅ גישה פעילה
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{u.email}</p>
                      </div>

                      {/* Toggle button */}
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.patch(`/admin/users/${u.id}/hand-logger-access`);
                            setUsers(prev => prev.map(p => p.id === u.id
                              ? { ...p, hand_logger_access: res.data.hand_logger_access }
                              : p
                            ));
                          } catch { alert('שגיאה בעדכון'); }
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors flex-shrink-0
                          ${hasAccess ? 'bg-blue-600' : 'bg-slate-600'}`}>
                        <span className={`inline-block h-6 w-6 rounded-full bg-white shadow-lg transform transition-transform
                          ${hasAccess ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Admin note */}
              <p className="text-xs text-slate-600 text-center" dir="rtl">
                * אדמינים תמיד בעלי גישה מלאה · שינויים נכנסים לתוקף מיד
              </p>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-2">
              {lockedCount > 0 && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 flex items-center gap-2 mb-4">
                  <span className="text-red-400 text-lg">🔒</span>
                  <span className="text-red-300 text-sm font-semibold">
                    {lockedCount} {lockedCount === 1 ? 'חשבון ננעל' : 'חשבונות ננעלו'} עקב ניסיונות התחברות כושלים מרובים
                  </span>
                </div>
              )}
              {users.map(u => (
                <div key={u.id} className={`card p-4 flex items-center justify-between flex-wrap gap-3
                  ${u.is_locked ? 'border-red-700/50 bg-red-900/10' : !u.is_active ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-100">{u.name}</span>
                      <span className="badge-status text-xs bg-slate-700 text-slate-300">
                        {u.role === 'admin' ? '👑 אדמין' : u.role === 'venue_owner' ? '🏠 מועדון פוקר' : '🃏 שחקן'}
                      </span>
                      {u.is_locked && (
                        <span className="text-xs font-bold bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">
                          🔒 נעול
                        </span>
                      )}
                      {!u.is_active && !u.is_locked && (
                        <span className="badge-status text-red-400 bg-red-900/20">מושבת</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{u.email} · {u.phone}</p>
                    {u.is_locked && u.locked_at && (
                      <p className="text-xs text-red-400/70 mt-0.5">
                        ננעל ב־{new Date(u.locked_at).toLocaleString('he-IL')} · {u.failed_login_attempts} ניסיונות כושלים
                      </p>
                    )}
                    {!u.is_locked && u.failed_login_attempts > 0 && (
                      <p className="text-xs text-amber-400/70 mt-0.5">
                        ⚠️ {u.failed_login_attempts} ניסיונות כושלים
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {u.is_locked && (
                      <button onClick={() => unlockUser(u.id)}
                        className="text-sm font-semibold py-1.5 px-4 rounded-xl bg-blue-900/30 text-blue-400 hover:bg-blue-900/60 transition-all">
                        🔓 שחרר נעילה
                      </button>
                    )}
                    {u.role !== 'admin' && (
                      <button onClick={() => toggleUser(u.id)}
                        className={`text-sm font-semibold py-1.5 px-4 rounded-xl transition-all ${u.is_active ? 'bg-red-900/30 text-red-400 hover:bg-red-900/60' : 'bg-green-900/30 text-green-400 hover:bg-green-900/60'}`}>
                        {u.is_active ? 'השבת' : 'הפעל'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Delete venue confirmation modal */}
      {deleteVenueModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md animate-slide-up">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-xl font-black text-white mb-2">מחיקת מועדון</h3>
              <p className="text-slate-300 font-semibold">
                האם אתה בטוח שברצונך למחוק את המועדון
              </p>
              <p className="text-red-400 font-black text-lg mt-1">"{deleteVenueModal.name}"?</p>
            </div>
            <div className="bg-red-950/50 border border-red-800/40 rounded-xl p-4 mb-5 text-sm text-red-300 space-y-1">
              <p className="font-bold">⚠️ שים לב — פעולה זו בלתי הפיכה:</p>
              <p>• המועדון יימחק לצמיתות מהמערכת</p>
              <p>• כל הטורנירים של המועדון יימחקו גם הם</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteVenue}
                disabled={deleteLoading}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50"
              >
                {deleteLoading ? 'מוחק...' : '🗑️ כן, מחק לצמיתות'}
              </button>
              <button
                onClick={() => setDeleteVenueModal(null)}
                className="flex-1 btn-ghost"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-bold text-white mb-3">סיבת הדחייה</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="input-field resize-none mb-4" rows={3} placeholder="ציין את סיבת הדחייה (אופציונלי)" />
            <div className="flex gap-3">
              <button onClick={rejectTournament} className="bg-red-900/30 hover:bg-red-900/60 text-red-400 font-bold py-2 px-5 rounded-xl flex-1">דחה</button>
              <button onClick={() => setRejectModal(null)} className="btn-ghost flex-1">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
