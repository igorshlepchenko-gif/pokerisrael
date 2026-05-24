import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate, formatTime, formatCost } from '../utils/whatsapp';

export default function AdminPanel() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState({ venues: [], tournaments: [] });
  const [users, setUsers] = useState([]);
  const [allTournaments, setAllTournaments] = useState([]);
  const [allVenues, setAllVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [boostLabel, setBoostLabel] = useState({});

  useEffect(() => { fetchData(); }, [tab]);

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

  const totalPending = pending.venues.length + pending.tournaments.length;

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
          ['venues', '📍 מקומות'],
          ['tournaments', '🚀 קידומים'],
          ['users', '👥 משתמשים'],
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
                  <h2 className="text-lg font-bold text-slate-300 mb-3">🏠 מקומות ממתינים לאישור</h2>
                  <div className="space-y-3">
                    {pending.venues.map(v => (
                      <div key={v.id} className="card p-4">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                          <div>
                            <h3 className="font-bold text-slate-100">{v.name}</h3>
                            <p className="text-sm text-slate-400">📍 {v.address}, {v.city}</p>
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
                <div className="card p-12 text-center text-slate-500">אין מקומות רשומים</div>
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
                      <p className="text-base text-slate-300">📍 {v.address}, {v.city}</p>
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
                    {!v.is_approved && (
                      <div className="flex flex-col gap-2 shrink-0 self-center">
                        <button onClick={() => approveVenue(v.id)} className="btn-primary">✅ אשר מקום</button>
                        <button onClick={() => rejectVenue(v.id)}
                          className="bg-red-900/30 hover:bg-red-900/60 text-red-400 font-semibold py-2 px-4 rounded-xl transition-all text-center">
                          ❌ דחה
                        </button>
                      </div>
                    )}
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
              {allTournaments.map(t => (
                <div key={t.id} className={`card p-4 flex items-center justify-between flex-wrap gap-3 ${t.is_boosted ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-100">{t.name}</span>
                      {t.is_boosted && (
                        <span className="bg-amber-500/20 text-amber-400 text-xs font-black px-2 py-0.5 rounded-full">
                          🚀 {t.boost_label || 'מקודם'}
                        </span>
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
              ))}
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className={`card p-4 flex items-center justify-between flex-wrap gap-3 ${!u.is_active ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{u.name}</span>
                      <span className="badge-status text-xs bg-slate-700 text-slate-300">
                        {u.role === 'admin' ? '👑 אדמין' : u.role === 'venue_owner' ? '🏠 מועדון פוקר' : '🃏 שחקן'}
                      </span>
                      {!u.is_active && <span className="badge-status text-red-400 bg-red-900/20">מושבת</span>}
                    </div>
                    <p className="text-sm text-slate-400">{u.email} · {u.phone}</p>
                  </div>
                  {u.role !== 'admin' && (
                    <button onClick={() => toggleUser(u.id)}
                      className={`text-sm font-semibold py-1.5 px-4 rounded-xl transition-all ${u.is_active ? 'bg-red-900/30 text-red-400 hover:bg-red-900/60' : 'bg-green-900/30 text-green-400 hover:bg-green-900/60'}`}>
                      {u.is_active ? 'השבת' : 'הפעל'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
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
