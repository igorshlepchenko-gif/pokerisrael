import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate, formatTime, formatCost } from '../utils/whatsapp';
import VenueEditForm from '../components/VenueEditForm';
import TournamentEditForm from '../components/TournamentEditForm';

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
  const [editingVenue, setEditingVenue] = useState(null);
  const [editingTournament, setEditingTournament] = useState(null); // tournament id being edited
  const [editVenueSuccess, setEditVenueSuccess] = useState('');
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

  // ── Import tab state ──────────────────────────────────────────────────────
  const [importText,    setImportText]    = useState('');
  const [importSource,  setImportSource]  = useState('whatsapp');
  const [importParsing, setImportParsing] = useState(false);
  const [importResult,  setImportResult]  = useState(null);   // { parsed, matched_venue, venues }
  const [importFields,  setImportFields]  = useState({});     // editable override fields
  const [importVenueId, setImportVenueId] = useState('');
  const [importSaving,  setImportSaving]  = useState(false);
  const [importDone,    setImportDone]    = useState(null);   // { tournament_id }
  const [importHistory,    setImportHistory]    = useState([]);
  const [importError,      setImportError]      = useState('');
  const [agentSources,     setAgentSources]     = useState([]);
  const [agentRunning,     setAgentRunning]     = useState(false);
  const [newSource,        setNewSource]        = useState({ platform: 'whatsapp', name: '', identifier: '' });
  const [waStatus,         setWaStatus]         = useState(null);
  const [waPolling,        setWaPolling]        = useState(false);
  const [pendingImports,   setPendingImports]   = useState([]);
  const [pendingVenues,    setPendingVenues]    = useState({});   // { [importId]: venueId }
  const [pendingDates,     setPendingDates]     = useState({});   // { [importId]: { date, start_time } }
  const [approvingIds,     setApprovingIds]     = useState({});   // { [importId]: true } — guards double-click while a claim is in flight
  const [pendingVenueList, setPendingVenueList] = useState([]);
  const [expandedImport,   setExpandedImport]   = useState(null);

  useEffect(() => { fetchData(); }, [tab, clEntityType, clAction, clDateFrom, clDateTo, clSearch, regSearch]);

  // Poll WhatsApp connection status while on imports tab.
  // Stops polling once connected ('ready') or disconnected to avoid hammering the API.
  useEffect(() => {
    if (tab !== 'imports') return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await api.get('/agent/whatsapp/status');
        if (alive) setWaStatus(r.data);
        // Only keep polling while actively connecting (qr / authenticating)
        return r.data?.status;
      } catch { return null; }
    };
    let iv;
    const tick = async () => {
      const st = await poll();
      // Stop the fast poll once we reach a stable state
      if (st === 'ready' || st === 'disconnected' || st === 'error') {
        if (iv) { clearInterval(iv); iv = null; }
      }
    };
    tick();
    iv = setInterval(tick, 6000);
    return () => { alive = false; if (iv) clearInterval(iv); };
  }, [tab, waStatus?.status]);

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
      } else if (tab === 'imports') {
        const [hist, src, pend, venues] = await Promise.all([
          api.get('/imports?status=approved'),
          api.get('/agent/sources'),
          api.get('/imports?status=pending'),
          api.get('/admin/venues/all'),
        ]);
        setImportHistory(hist.data);
        setAgentSources(src.data);
        setPendingImports(pend.data);
        setPendingVenueList(venues.data);
      } else {
        const res = await api.get('/admin/users');
        setUsers(res.data);
      }
    } catch {/* ignore */}
    finally { setLoading(false); }
  };

  const boostTournament = async (id) => {
    try {
      const label = boostLabel[id] || 'מקודם';
      const res = await api.patch(`/admin/tournaments/${id}/boost`, { label });
      setAllTournaments(prev =>
        prev.map(t => t.id === id ? { ...t, is_boosted: res.data.is_boosted, boost_label: res.data.boost_label } : t)
      );
    } catch (e) {
      alert(e?.response?.data?.message || 'שגיאה בעדכון קידום הטורניר');
    }
  };

  const approveVenue = async (id) => {
    try {
      await api.patch(`/admin/venues/${id}/approve`);
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.message || 'שגיאה באישור המועדון');
    }
  };

  const rejectVenue = async (id) => {
    try {
      await api.delete(`/admin/venues/${id}`);
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.message || 'שגיאה בדחיית המועדון');
    }
  };

  const approveTournament = async (id) => {
    try {
      await api.patch(`/admin/tournaments/${id}/approve`);
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.message || 'שגיאה באישור הטורניר');
    }
  };

  const rejectTournament = async () => {
    try {
      await api.patch(`/admin/tournaments/${rejectModal}/reject`, { reason: rejectReason });
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.message || 'שגיאה בדחיית הטורניר');
    }
  };

  const toggleUser = async (id) => {
    try {
      await api.patch(`/admin/users/${id}/toggle`);
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.message || 'שגיאה בעדכון סטטוס המשתמש');
    }
  };

  const unlockUser = async (id) => {
    try {
      await api.patch(`/admin/users/${id}/unlock`);
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.message || 'שגיאה בשחרור הנעילה');
    }
  };

  const handleDeleteVenue = async () => {
    if (!deleteVenueModal) return;
    setDeleteLoading(true);
    try {
      // מועדון מאושר: השרת דורש את מספר הטורנירים העדכני כאישור, לא רק קליק — אם
      // המספר שהוצג במודל התיישן (מישהו הוסיף/מחק טורניר מאז שהמודל נפתח), השרת
      // יחזיר 409 עם המספר האמיתי, ואנחנו מעדכנים את המודל כדי שהאדמין יאשר שוב
      // במקום למחוק בטעות מועדון עם יותר טורנירים ממה שחשב
      await api.delete(`/admin/venues/${deleteVenueModal.id}`, {
        data: deleteVenueModal.is_approved ? { confirmTournamentCount: deleteVenueModal.tournament_count ?? 0 } : {},
      });
      setDeleteVenueModal(null);
      fetchData();
    } catch (e) {
      if (e?.response?.status === 409 && Number.isInteger(e.response.data?.tournamentCount)) {
        setDeleteVenueModal(v => ({ ...v, tournament_count: e.response.data.tournamentCount }));
        alert(`המספר התעדכן — למועדון יש כעת ${e.response.data.tournamentCount} טורנירים. בדוק ולחץ שוב למחיקה.`);
      } else {
        alert('שגיאה במחיקת המועדון');
      }
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
          ['imports', '📥 ייבוא מפרסומים'],
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
          {/* Edit venue modal */}
          {editingVenue && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">✏️ עריכת מועדון — {editingVenue.name}</h3>
                  <button onClick={() => setEditingVenue(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-500/80 text-slate-300 hover:text-white transition-all text-sm">
                    ✕
                  </button>
                </div>
                <VenueEditForm
                  venue={editingVenue}
                  onSuccess={(msg) => { setEditVenueSuccess(msg); setEditingVenue(null); fetchData(); }}
                  onCancel={() => setEditingVenue(null)}
                />
              </div>
            </div>
          )}

          {tab === 'venues' && (
            <div className="space-y-4">
              {editVenueSuccess && (
                <div className="bg-green-900/30 border border-green-700/50 text-green-400 rounded-xl p-3 text-sm">
                  ✅ {editVenueSuccess}
                </div>
              )}
              {allVenues.length === 0 && (
                <div className="card p-12 text-center text-slate-500">אין מועדונים רשומים</div>
              )}
              {allVenues.map(v => (
                <div key={v.id} className={`card p-5 ${!v.is_approved ? 'border-amber-500/30' : 'border-green-700/20'}`}>
                  <div className="flex items-start gap-5 flex-wrap">

                    {/* לוגו גדול */}
                    {v.logo_url ? (
                      <img src={v.logo_url} alt="לוגו"
                        className="w-28 h-28 rounded-2xl object-contain bg-slate-800 shrink-0 border-2 border-slate-600 shadow-lg" />
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
                        onClick={() => { setEditVenueSuccess(''); setEditingVenue(v); }}
                        className="bg-blue-900/30 hover:bg-blue-900/60 text-blue-400 font-semibold py-2 px-4 rounded-xl transition-all text-center text-sm"
                      >
                        ✏️ ערוך מועדון
                      </button>
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

          {/* Promotions / boost + edit */}
          {tab === 'tournaments' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">סמן טורנירים כ"מקודמים" — הם יופיעו ראשונים בתוצאות גם אם לא תואמים את הסינון של הגולש.</p>
              {allTournaments.length === 0 && (
                <div className="card p-12 text-center text-slate-500">אין טורנירים מאושרים</div>
              )}
              {allTournaments.map(t => {
                const past = isPast(t);
                const isEditing = editingTournament === t.id;
                return (
                <div key={t.id} className={`card p-4 ${t.is_boosted ? 'border-amber-500/40 bg-amber-500/5' : ''} ${past ? 'opacity-60' : ''}`}>
                  {/* ── header row ── */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-100">{t.name}</span>
                        {t.manually_edited && (
                          <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-700/30">✏️ עודכן ידנית</span>
                        )}
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
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Edit toggle */}
                      <button
                        onClick={() => setEditingTournament(isEditing ? null : t.id)}
                        className={`text-sm font-bold py-1.5 px-4 rounded-xl transition-all whitespace-nowrap ${
                          isEditing
                            ? 'bg-blue-900/60 text-blue-300'
                            : 'bg-slate-700/60 text-slate-300 hover:bg-blue-900/40 hover:text-blue-300'
                        }`}
                      >
                        ✏️ {isEditing ? 'סגור' : 'ערוך'}
                      </button>
                      {/* Boost */}
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
                  {/* ── inline edit form ── */}
                  {isEditing && (
                    <TournamentEditForm
                      tournament={t}
                      onSave={() => { setEditingTournament(null); fetchData(); }}
                      onCancel={() => setEditingTournament(null)}
                    />
                  )}
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
                    try {
                      const res = await api.get('/registrations/export', { responseType: 'blob' });
                      const url = URL.createObjectURL(res.data);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `registrations_${new Date().toISOString().slice(0,10)}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      // responseType: 'blob' means even error responses arrive as a Blob,
                      // not parsed JSON — read it back out to surface the server's real message
                      let message = 'שגיאה בייצוא לאקסל';
                      if (err?.response?.data instanceof Blob) {
                        try { message = JSON.parse(await err.response.data.text())?.message || message; } catch { /* not JSON, keep default */ }
                      }
                      alert(message);
                    }
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
              <div className="always-dark rounded-2xl p-5 border border-blue-500/20"
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

          {/* ══ IMPORTS TAB ══════════════════════════════════════════════════ */}
          {tab === 'imports' && (() => {
            const SOURCES = [
              { key: 'whatsapp', icon: '💬', label: 'WhatsApp' },
              { key: 'facebook', icon: '📘', label: 'Facebook' },
              { key: 'telegram', icon: '📨', label: 'Telegram' },
              { key: 'sms',      icon: '📱', label: 'SMS' },
              { key: 'manual',   icon: '✏️', label: 'ידני' },
            ];

            const FIELD_META = [
              { key: 'name',           label: 'שם הטורניר',      type: 'text' },
              { key: 'date',           label: 'תאריך',            type: 'date' },
              { key: 'start_time',     label: 'שעת התחלה',       type: 'time' },
              { key: 'cost',           label: 'עלות (₪)',         type: 'number' },
              { key: 'gtd',            label: 'GTD (₪)',          type: 'number' },
              { key: 'starting_stack', label: 'ערימת פתיחה',     type: 'number' },
              { key: 'level_duration', label: 'משך שלב (דקות)',  type: 'number' },
              { key: 'late_reg_level', label: 'Late Reg שלב',    type: 'number' },
              { key: 'whatsapp_number',label: 'וואטסאפ',         type: 'text' },
              { key: 'description',    label: 'תיאור',            type: 'textarea' },
            ];

            const fval = (key) =>
              importFields[key] !== undefined
                ? importFields[key]
                : (importResult?.parsed?.[key] ?? '');

            const setFval = (key, val) =>
              setImportFields(prev => ({ ...prev, [key]: val }));

            const handleParse = async () => {
              if (!importText.trim()) return;
              setImportParsing(true);
              setImportResult(null);
              setImportError('');
              setImportDone(null);
              setImportFields({});
              setImportVenueId('');
              try {
                const res = await api.post('/imports/parse', {
                  text: importText, source: importSource,
                });
                setImportResult(res.data);
                if (res.data.matched_venue) setImportVenueId(String(res.data.matched_venue.id));
              } catch (e) {
                setImportError(e?.response?.data?.message || 'שגיאה בניתוח');
              } finally {
                setImportParsing(false);
              }
            };

            const handleCreate = async () => {
              if (!importVenueId) { setImportError('בחר מועדון'); return; }
              setImportSaving(true);
              setImportError('');
              try {
                const merged = { ...importResult?.parsed, ...importFields };
                // Save import record
                const saveRes = await api.post('/imports', {
                  source: importSource,
                  raw_text: importText,
                  parsed_data: merged,
                  venue_id: parseInt(importVenueId),
                });
                // Auto-approve immediately
                const apvRes = await api.patch(`/imports/${saveRes.data.id}/approve`, {
                  ...merged,
                  venue_id: parseInt(importVenueId),
                });
                setImportDone(apvRes.data);
                setImportText('');
                setImportResult(null);
                setImportFields({});
                setImportVenueId('');
                // Refresh history
                api.get('/imports?status=approved').then(r => setImportHistory(r.data)).catch(() => {});
              } catch (e) {
                setImportError(e?.response?.data?.message || e?.response?.data?.detail || 'שגיאה ביצירת הטורניר');
              } finally {
                setImportSaving(false);
              }
            };

            const handleApprovePending = async (imp) => {
              if (approvingIds[imp.id]) return; // כבר בתהליך — מונע בקשה כפולה מלחיצה כפולה
              const venueId = pendingVenues[imp.id] || imp.venue_id;
              if (!venueId) { alert('בחר מועדון לפני האישור'); return; }
              const d = imp.parsed_data || {};
              const dateOverride = pendingDates[imp.id]?.date || d.date;
              const timeOverride = pendingDates[imp.id]?.start_time || d.start_time;
              if (!dateOverride || !timeOverride) {
                alert('יש להזין תאריך ושעה לפני האישור');
                return;
              }
              setApprovingIds(p => ({ ...p, [imp.id]: true }));
              try {
                const r = await api.patch(`/imports/${imp.id}/approve`, {
                  venue_id: parseInt(venueId),
                  date: dateOverride,
                  start_time: timeOverride,
                });
                setPendingImports(p => p.filter(i => i.id !== imp.id));
                alert(`✅ טורניר נוצר! #${r.data.tournament_id}`);
              } catch(e) {
                alert('שגיאה: ' + (e?.response?.data?.message || e.message));
              } finally {
                setApprovingIds(p => { const n = { ...p }; delete n[imp.id]; return n; });
              }
            };

            const handleRejectPending = async (id) => {
              try {
                await api.patch(`/imports/${id}/reject`);
                setPendingImports(p => p.filter(i => i.id !== id));
              } catch(e) { alert('שגיאה: ' + e.message); }
            };

            return (
              <div className="space-y-5" dir="rtl">
                {/* Header */}
                <div className="always-dark rounded-2xl border border-blue-500/20 p-5"
                  style={{ background: 'linear-gradient(135deg,rgba(13,21,38,.95),rgba(6,9,26,.95))' }}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-3xl">📥</span>
                    <div>
                      <h2 className="text-lg font-black text-white">ייבוא טורנירים מפרסומים</h2>
                      <p className="text-sm text-slate-400">הדבק פרסום מוואטסאפ / פייסבוק / טלגרם — AI מחלץ את הפרטים אוטומטית</p>
                    </div>
                  </div>
                </div>

                {/* ── Pending imports from scraper ── */}
                {pendingImports.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {pendingImports.length} ממתינים
                      </span>
                      <h3 className="text-base font-black text-white">⏳ ממתינים לאישורך</h3>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pl-1">
                      {pendingImports.map(imp => {
                        const d = imp.parsed_data || {};
                        const conf = Math.round((d.confidence || 0) * 100);
                        const confColor = conf >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                        : conf >= 50 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                                        :              'text-red-400 border-red-500/30 bg-red-500/10';
                        const srcIcon = imp.source === 'telegram' ? '💬' : imp.source === 'whatsapp' ? '📱' : '🌐';
                        return (
                          <div key={imp.id} className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4 space-y-3">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white">
                                  {d.name || '(שם לא זוהה)'}
                                </span>
                                {d.date && <span className="text-xs text-slate-400">📅 {d.date}{d.start_time ? ` ${d.start_time}` : ''}</span>}
                                {d.cost && <span className="text-xs text-slate-400">💰 ₪{d.cost}</span>}
                                {d.gtd  && <span className="text-xs text-slate-400">🏆 GTD ₪{d.gtd}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">{srcIcon}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${confColor}`}>
                                  {conf}%
                                </span>
                              </div>
                            </div>

                            {/* Venue & city hint */}
                            {(d.venue_name || d.venue_city) && (
                              <div className="text-xs text-slate-500">
                                📍 {[d.venue_name, d.venue_city].filter(Boolean).join(' · ')}
                              </div>
                            )}

                            {/* Raw text toggle */}
                            <button
                              onClick={() => setExpandedImport(expandedImport === imp.id ? null : imp.id)}
                              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                              {expandedImport === imp.id ? '▲ הסתר טקסט' : '▼ הצג טקסט מקורי'}
                            </button>
                            {expandedImport === imp.id && (
                              <div className="text-xs text-slate-400 bg-slate-900/60 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                                {imp.raw_text}
                              </div>
                            )}

                            {/* Date/time — mandatory */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1 flex-1 min-w-[180px]">
                                <span className="text-xs text-slate-400 shrink-0">📅</span>
                                <input
                                  type="date"
                                  value={pendingDates[imp.id]?.date || d.date || ''}
                                  onChange={e => setPendingDates(p => ({ ...p, [imp.id]: { ...p[imp.id], date: e.target.value } }))}
                                  className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                                  dir="ltr"
                                />
                              </div>
                              <div className="flex items-center gap-1 min-w-[110px]">
                                <span className="text-xs text-slate-400 shrink-0">🕐</span>
                                <input
                                  type="time"
                                  value={pendingDates[imp.id]?.start_time || d.start_time || ''}
                                  onChange={e => setPendingDates(p => ({ ...p, [imp.id]: { ...p[imp.id], start_time: e.target.value } }))}
                                  className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                                  dir="ltr"
                                />
                              </div>
                            </div>

                            {/* Venue selector + actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={pendingVenues[imp.id] || imp.venue_id || ''}
                                onChange={e => setPendingVenues(p => ({ ...p, [imp.id]: e.target.value }))}
                                className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm focus:border-blue-500 focus:outline-none">
                                <option value="">-- בחר מועדון --</option>
                                {pendingVenueList.map(v => (
                                  <option key={v.id} value={v.id}>{v.name}{v.city ? ` (${v.city})` : ''}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleApprovePending(imp)}
                                disabled={!!approvingIds[imp.id]}
                                className="px-4 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-bold transition-all disabled:opacity-40">
                                {approvingIds[imp.id] ? '⏳ מאשר...' : '✅ אשר'}
                              </button>
                              <button
                                onClick={() => handleRejectPending(imp.id)}
                                className="px-4 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-900/80 text-red-300 text-sm font-bold transition-all">
                                ❌ דחה
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Source selector */}
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">מקור הפרסום</label>
                  <div className="flex gap-2 flex-wrap">
                    {SOURCES.map(s => (
                      <button key={s.key} onClick={() => setImportSource(s.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold transition-all
                          ${importSource === s.key ? 'border-blue-400 bg-blue-600/20 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                        <span>{s.icon}</span>{s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text area */}
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">טקסט הפרסום</label>
                  <textarea
                    rows={6}
                    placeholder="הדבק כאן את הפרסום..."
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 text-sm text-right resize-none focus:border-blue-500 focus:outline-none leading-relaxed"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-600">{importText.length} / 8000 תווים</span>
                    <button
                      onClick={handleParse}
                      disabled={importParsing || importText.trim().length < 15}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
                      style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow: '0 0 20px rgba(29,78,216,.4)' }}>
                      {importParsing ? (
                        <><span className="animate-spin">⏳</span> מנתח עם AI...</>
                      ) : (
                        <><span>🤖</span> נתח עם AI</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {importError && (
                  <div className="rounded-xl bg-red-900/20 border border-red-500/30 px-4 py-3 text-red-300 text-sm font-bold">
                    ⚠️ {importError}
                  </div>
                )}

                {/* Success */}
                {importDone && (
                  <div className="rounded-xl bg-emerald-900/20 border border-emerald-500/30 px-4 py-4 text-center">
                    <div className="text-2xl mb-1">✅</div>
                    <p className="text-emerald-300 font-black text-lg">הטורניר נוצר בהצלחה!</p>
                    <p className="text-slate-400 text-sm mt-1">מזהה: #{importDone.tournament_id}</p>
                    <button onClick={() => setImportDone(null)}
                      className="mt-3 px-4 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/10 transition-all">
                      ייבוא נוסף
                    </button>
                  </div>
                )}

                {/* Parsed results */}
                {importResult && !importDone && (
                  <div className="rounded-2xl border border-blue-500/20 bg-slate-800/40 p-5 space-y-4">
                    {/* Confidence badge */}
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-black border
                        ${(importResult.parsed.confidence || 0) >= 0.8
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                        {Math.round((importResult.parsed.confidence || 0) * 100)}% ביטחון
                      </span>
                      <h3 className="text-sm font-black text-white">✏️ עריכה לפני אישור</h3>
                    </div>

                    {/* Editable fields grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {FIELD_META.map(f => (
                        f.type === 'textarea' ? (
                          <div key={f.key} className="sm:col-span-2">
                            <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                            <textarea rows={2}
                              value={fval(f.key)}
                              onChange={e => setFval(f.key, e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm text-right resize-none focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div key={f.key}>
                            <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                            <input type={f.type}
                              value={fval(f.key)}
                              onChange={e => setFval(f.key, e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        )
                      ))}

                      {/* Re-entry + Recurring */}
                      <div className="flex gap-4 items-center pt-1">
                        {[['re_entry','Re-Entry'], ['is_recurring','שבועי קבוע']].map(([k,l]) => (
                          <label key={k} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox"
                              checked={!!fval(k)}
                              onChange={e => setFval(k, e.target.checked)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500"
                            />
                            <span className="text-sm text-slate-300">{l}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Venue selector */}
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">
                        מועדון
                        {importResult.matched_venue && (
                          <span className="mr-2 text-xs font-normal text-emerald-400">
                            ✅ זוהה: {importResult.matched_venue.name}
                          </span>
                        )}
                      </label>
                      <select
                        value={importVenueId}
                        onChange={e => setImportVenueId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none">
                        <option value="">-- בחר מועדון --</option>
                        {importResult.venues.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name}{v.city ? ` (${v.city})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Create button */}
                    <button
                      onClick={handleCreate}
                      disabled={importSaving || !importVenueId}
                      className="w-full py-3 rounded-2xl font-black text-lg text-white disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-[.98]"
                      style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 0 24px rgba(16,185,129,.4)' }}>
                      {importSaving ? '⏳ יוצר טורניר...' : '✅ צור טורניר ← אשר אוטומטית'}
                    </button>
                  </div>
                )}

                {/* ── Agent Sources ── */}
                <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={async () => {
                        setAgentRunning(true);
                        try {
                          const r = await api.post('/agent/run');
                          alert(`✅ סריקה הסתיימה\nנסרקו: ${r.data.scanned} הודעות\nנמצאו: ${r.data.found} פרסומי פוקר`);
                        } catch(e) { alert('שגיאה: ' + (e?.response?.data?.message || e.message)); }
                        finally { setAgentRunning(false); }
                      }}
                      disabled={agentRunning}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:border-blue-500/50 disabled:opacity-40 transition-all">
                      {agentRunning ? '⏳ סורק...' : '▶ הרץ סריקה עכשיו'}
                    </button>
                    <h3 className="text-base font-black text-white">🤖 ניהול מקורות אוטומטיים</h3>
                  </div>

                  {/* ── WhatsApp connection ── */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    {(() => {
                      const fwd = waStatus?.forwarder;
                      // If local forwarder is active, show its status (preferred mode)
                      if (fwd) {
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-emerald-400">🟢 WhatsApp: מחובר</span>
                              <span className="text-xs text-slate-500">Forwarder מקומי פעיל</span>
                            </div>
                            {fwd.info?.pushname && (
                              <div className="text-xs text-slate-400">{fwd.info.pushname} · {fwd.info.number}</div>
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                              הוואטסאפ מחובר דרך המחשב שלך. כשהסקריפט <code className="bg-slate-800 px-1 rounded">whatsapp-forwarder/index.js</code> פועל — ההודעות מגיעות לשרת אוטומטית.
                            </p>
                          </div>
                        );
                      }

                      // Fallback: server-side Baileys status
                      const st = waStatus?.status || 'disconnected';
                      const STATUS_UI = {
                        disconnected: { icon: '⚪', label: 'מנותק',     color: 'text-slate-400' },
                        authenticating:{icon: '🟡', label: 'מתחבר...',  color: 'text-amber-400' },
                        qr:           { icon: '📱', label: 'ממתין לסריקת QR', color: 'text-blue-400' },
                        ready:        { icon: '🟢', label: 'מחובר',      color: 'text-emerald-400' },
                        error:        { icon: '🔴', label: 'שגיאה',      color: 'text-red-400' },
                      };
                      const ui = STATUS_UI[st] || STATUS_UI.disconnected;
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-right">
                              <div>
                                <span className={`text-sm font-bold ${ui.color}`}>{ui.icon} WhatsApp: {ui.label}</span>
                                {waStatus?.info?.pushname && (
                                  <div className="text-xs text-slate-500">{waStatus.info.pushname} · {waStatus.info.number}</div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-800/60 p-3 text-xs text-slate-400 space-y-1">
                            <p className="font-bold text-slate-300">כיצד לחבר WhatsApp:</p>
                            <p>1. פתח טרמינל בתיקיית הפרויקט</p>
                            <p>2. <code className="bg-slate-700 px-1 rounded">cd whatsapp-forwarder</code></p>
                            <p>3. <code className="bg-slate-700 px-1 rounded">node index.js</code></p>
                            <p>4. סרוק QR שיופיע בטרמינל → הסטטוס כאן יתעדכן אוטומטית</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Add new source */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select value={newSource.platform}
                      onChange={e => setNewSource(p => ({...p, platform: e.target.value}))}
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none">
                      <option value="telegram">💬 Telegram</option>
                      <option value="whatsapp">📱 WhatsApp</option>
                      <option value="website">🌐 אתר</option>
                    </select>
                    <input placeholder="שם ידידותי" value={newSource.name}
                      onChange={e => setNewSource(p => ({...p, name: e.target.value}))}
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none" />
                    <input
                      placeholder={newSource.platform==='telegram' ? '@channel_name או chat_id' : newSource.platform==='website' ? 'https://...' : 'מספר טלפון'}
                      value={newSource.identifier}
                      onChange={e => setNewSource(p => ({...p, identifier: e.target.value}))}
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none" />
                    <button
                      onClick={async () => {
                        if (!newSource.name || !newSource.identifier) return;
                        try {
                          const r = await api.post('/agent/sources', newSource);
                          setAgentSources(p => [...p, r.data]);
                          setNewSource(p => ({...p, name:'', identifier:''}));
                        } catch(e) { alert(e?.response?.data?.message || 'שגיאה'); }
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all">
                      + הוסף מקור
                    </button>
                  </div>

                  {/* Sources list */}
                  {agentSources.length > 0 ? (
                    <div className="space-y-2">
                      {agentSources.map(s => (
                        <div key={s.id} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all
                          ${s.active ? 'border-blue-500/20 bg-blue-500/5' : 'border-slate-700/40 bg-slate-800/20 opacity-50'}`}>
                          <div className="flex items-center gap-2">
                            <button onClick={async () => {
                              const r = await api.patch(`/agent/sources/${s.id}/toggle`);
                              setAgentSources(p => p.map(x => x.id===s.id ? r.data : x));
                            }} className={`text-xs px-2 py-0.5 rounded-full font-bold border transition-all
                              ${s.active ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-slate-600 text-slate-500 hover:text-slate-300'}`}>
                              {s.active ? '✅ פעיל' : '⏸ מושבת'}
                            </button>
                            <button onClick={async () => {
                              if (!confirm(`מחק את "${s.name}"?`)) return;
                              await api.delete(`/agent/sources/${s.id}`);
                              setAgentSources(p => p.filter(x => x.id !== s.id));
                            }} className="text-xs text-red-400/50 hover:text-red-400 transition-colors px-1">✕</button>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-200">{s.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{s.platform} · {s.identifier}</div>
                            {s.last_checked && <div className="text-xs text-slate-600">נסרק: {new Date(s.last_checked).toLocaleString('he-IL')}</div>}
                          </div>
                          <span className="text-lg">{s.platform === 'telegram' ? '💬' : s.platform === 'website' ? '🌐' : '📱'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-3">לא הוגדרו מקורות עדיין — הוסף ערוץ טלגרם או מספר וואטסאפ</p>
                  )}

                  {/* WhatsApp webhook info */}
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-3 text-xs text-slate-500 text-right">
                    <p className="font-bold text-slate-400 mb-1">📱 WhatsApp Webhook URL:</p>
                    <code className="text-blue-400 text-xs break-all">
                      {window.location.origin.replace(':5173','') || 'https://www.pokerisrael.org'}/api/agent/whatsapp-webhook
                    </code>
                    <p className="mt-1">הגדר URL זה ב-Twilio / CallMeBot / Zapier כדי לקבל הודעות וואטסאפ אוטומטית</p>
                  </div>
                </div>

                {/* Import history */}
                {importHistory.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 mb-3">⏱ ייבואים אחרונים</h3>
                    <div className="space-y-2">
                      {importHistory.slice(0, 8).map(imp => (
                        <div key={imp.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-sm">
                          <div className="text-slate-500 text-xs">
                            {new Date(imp.created_at).toLocaleDateString('he-IL')}
                          </div>
                          <div className="flex-1 text-slate-300 text-right truncate">
                            {imp.parsed_data?.name || imp.raw_text?.slice(0, 40) + '…'}
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex-shrink-0">
                            {imp.source}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
              <p>
                • {Number.isInteger(deleteVenueModal.tournament_count) && deleteVenueModal.tournament_count > 0
                  ? `${deleteVenueModal.tournament_count} הטורנירים של המועדון יימחקו גם הם`
                  : 'כל הטורנירים של המועדון (אם יש) יימחקו גם הם'}
              </p>
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
