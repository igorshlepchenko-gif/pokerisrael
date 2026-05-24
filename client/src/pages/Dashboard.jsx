import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import TournamentForm from '../components/Tournament/TournamentForm';
import { formatDate, formatTime, formatCost } from '../utils/whatsapp';

const STATUS_LABELS = { pending: '⏳ ממתין', approved: '✅ מאושר', rejected: '❌ נדחה' };
const STATUS_COLORS = { pending: 'text-amber-400 bg-amber-900/20', approved: 'text-green-400 bg-green-900/20', rejected: 'text-red-400 bg-red-900/20' };

// --- Logo uploader ---
function LogoUploader({ value, onChange }) {
  const inputRef = useRef();
  const [preview, setPreview] = useState(value || null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(res.data.url);
    } catch {
      alert('שגיאה בהעלאת הלוגו');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">לוגו המקום</label>
      <div className="flex items-center gap-3">
        <div
          onClick={() => inputRef.current.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-600 hover:border-poker-green cursor-pointer flex items-center justify-center overflow-hidden transition-colors bg-slate-900/50 shrink-0"
        >
          {preview
            ? <img src={preview} alt="לוגו" className="w-full h-full object-cover" />
            : <span className="text-3xl opacity-30">🏠</span>
          }
        </div>
        <div className="flex-1">
          <button type="button" onClick={() => inputRef.current.click()}
            className="btn-ghost text-xs w-full mb-1">
            {uploading ? '⏳ מעלה...' : preview ? '🔄 החלף לוגו' : '📷 בחר לוגו'}
          </button>
          <p className="text-[10px] text-slate-500">PNG, JPG, SVG · מקס 10MB</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// --- Video Manager (per approved venue) ---
function VideoManager({ venue }) {
  const [videos, setVideos] = useState([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef();

  const load = async () => {
    try {
      const res = await api.get(`/upload/venue/${venue.id}/videos`);
      setVideos(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('video', file);
      fd.append('title', title || file.name);
      await api.post(`/upload/venue/${venue.id}/video`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.round(e.loaded * 100 / e.total)),
      });
      setTitle('');
      setProgress(0);
      load();
    } catch {
      alert('שגיאה בהעלאת הסרטון');
    } finally {
      setUploading(false);
    }
  };

  const deleteVideo = async (id) => {
    if (!confirm('למחוק את הסרטון?')) return;
    try {
      await api.delete(`/upload/video/${id}`);
      load();
    } catch { alert('שגיאה במחיקה'); }
  };

  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="text-xs text-poker-gold hover:text-amber-300 flex items-center gap-1 transition-colors">
        🎬 {open ? 'סגור' : `סרטוני תדמית${videos.length ? ` (${videos.length})` : ''}`}
      </button>

      {open && (
        <div className="mt-3 border border-slate-700 rounded-xl p-4 bg-slate-900/40 animate-slide-up">
          <h4 className="text-sm font-bold text-slate-300 mb-3">🎬 סרטוני תדמית — {venue.name}</h4>

          {/* Upload area */}
          <div className="mb-4">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="input-field text-sm mb-2" placeholder="שם הסרטון (אופציונלי)" />
            <div
              onClick={() => !uploading && inputRef.current.click()}
              className="border-2 border-dashed border-slate-600 hover:border-poker-gold rounded-xl p-5 text-center cursor-pointer transition-colors"
            >
              {uploading ? (
                <div>
                  <div className="h-2 bg-slate-700 rounded-full mb-2 overflow-hidden">
                    <div className="h-full bg-poker-gold transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm text-amber-400">מעלה... {progress}%</p>
                </div>
              ) : (
                <>
                  <div className="text-3xl mb-1">🎬</div>
                  <p className="text-sm text-slate-400">לחץ להעלאת סרטון</p>
                  <p className="text-xs text-slate-500 mt-1">MP4, MOV, AVI, WebM · מקס 200MB</p>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleUpload} />
          </div>

          {/* Video list */}
          {videos.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">עדיין אין סרטונים</p>
          ) : (
            <div className="space-y-2">
              {videos.map(v => (
                <div key={v.id} className="flex items-center gap-2 bg-slate-800 rounded-lg p-2">
                  <video src={v.video_url} className="w-20 h-12 rounded object-cover bg-black" controls />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{v.title || 'ללא שם'}</p>
                    <p className="text-[10px] text-slate-500">{new Date(v.created_at).toLocaleDateString('he-IL')}</p>
                  </div>
                  <button onClick={() => deleteVideo(v.id)}
                    className="text-red-400 hover:text-red-300 text-xs p-1 shrink-0">🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Bulk uploader ---
function BulkUploader({ venues, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [venueId, setVenueId] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success, message, errors, tournaments }
  const inputRef = useRef();
  const approvedVenues = venues.filter(v => v.is_approved);

  const downloadTemplate = () => {
    const BOM = '﻿';
    const rows = [
      ['שם טורניר', 'תיאור', 'עלות', 'תאריך התחלה', 'שעת התחלה', 'שעת סיום משוערת', 'חוזר שבועי', 'יום בשבוע'],
      ['טורניר שישי לילה', 'טורניר פריים טיים, 15K guarantee', '150', '30/05/2026', '22:00', '02:00', 'כן', 'שישי'],
      ['טורניר צהריים', '', '80', '25/05/2026', '13:00', '17:00', 'לא', ''],
      ['טורניר VIP', 'כניסה מוגבלת ל-20 שחקנים', '300', '01/06/2026', '20:00', '00:00', 'כן', 'ראשון'],
    ];
    const csv = BOM + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'תבנית_טורנירים.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!venueId) return setResult({ success: false, message: 'יש לבחור מקום תחילה' });
    if (!file) return setResult({ success: false, message: 'יש לבחור קובץ' });
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('venue_id', venueId);
      const res = await api.post('/tournaments/bulk', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult({ success: true, message: res.data.message, tournaments: res.data.tournaments });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onSuccess();
    } catch (err) {
      const data = err.response?.data;
      setResult({ success: false, message: data?.message || 'שגיאה בהעלאה', errors: data?.errors });
    } finally { setLoading(false); }
  };

  if (approvedVenues.length === 0) return null;

  return (
    <div className="card border-slate-700/50 overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-700/20 transition-colors text-sm font-semibold text-slate-300">
        <span className="flex items-center gap-2">📊 העלאת טורנירים מקובץ Excel/CSV
          <span className="text-xs font-normal text-slate-500">עד 10 טורנירים בבת אחת</span>
        </span>
        <span className="text-slate-500 text-xs">{open ? '▲ סגור' : '▼ פתח'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-700/50 animate-slide-up space-y-4 pt-4">

          {/* Template download */}
          <div className="flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-200">📥 הורד תבנית מלאה</p>
              <p className="text-xs text-slate-500 mt-0.5">קובץ CSV עם כותרות + 3 שורות לדוגמה</p>
            </div>
            <button onClick={downloadTemplate}
              className="btn-ghost text-xs whitespace-nowrap">⬇️ הורד תבנית</button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-slate-500 bg-slate-800/40 rounded-xl px-4 py-3 space-y-1 leading-relaxed">
            <p className="font-semibold text-slate-400 mb-1.5">📋 הנחיות מילוי:</p>
            <p>• <strong>שם טורניר</strong> ו-<strong>עלות</strong> ו-<strong>תאריך + שעת התחלה</strong> הם שדות חובה</p>
            <p>• תאריך בפורמט <span className="font-mono bg-slate-700 px-1 rounded">DD/MM/YYYY</span> · שעה בפורמט <span className="font-mono bg-slate-700 px-1 rounded">HH:MM</span></p>
            <p>• <strong>חוזר שבועי:</strong> כתוב <span className="font-mono bg-slate-700 px-1 rounded">כן</span> או <span className="font-mono bg-slate-700 px-1 rounded">לא</span></p>
            <p>• <strong>יום בשבוע:</strong> ראשון / שני / שלישי / רביעי / חמישי / שישי / שבת</p>
            <p>• מקסימום <strong>10 שורות</strong> לפי קובץ</p>
          </div>

          {/* Venue select */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">בחר מקום *</label>
            <select value={venueId} onChange={e => setVenueId(e.target.value)} className="input-field text-sm">
              <option value="">— בחר מקום —</option>
              {approvedVenues.map(v => <option key={v.id} value={v.id}>{v.name} ({v.city})</option>)}
            </select>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">קובץ Excel / CSV *</label>
            <div
              onClick={() => inputRef.current.click()}
              className="border-2 border-dashed border-slate-600 hover:border-poker-green rounded-xl p-5 text-center cursor-pointer transition-colors">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-poker-green-light font-semibold text-sm">
                  📄 {file.name}
                  <span className="text-slate-500 text-xs">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <div className="text-3xl mb-1">📊</div>
                  <p className="text-sm text-slate-400">לחץ לבחירת קובץ</p>
                  <p className="text-xs text-slate-500 mt-1">.xlsx · .xls · .csv · מקס 5MB</p>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { setFile(e.target.files[0] || null); setResult(null); }} />
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl px-4 py-3 text-sm ${result.success ? 'bg-green-900/30 border border-green-700 text-green-400' : 'bg-red-900/20 border border-red-800 text-red-400'}`}>
              <p className="font-semibold mb-1">{result.message}</p>
              {result.errors?.map((e, i) => <p key={i} className="text-xs opacity-80">• {e}</p>)}
              {result.tournaments?.map(t => <p key={t.id} className="text-xs opacity-80">✅ {t.name}</p>)}
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading || !file || !venueId}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? '⏳ שולח...' : `📤 שלח לאישור${file ? ` (${file.name})` : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard ---
export default function Dashboard() {
  const [tab, setTab] = useState('tournaments');
  const [tournaments, setTournaments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [venueForm, setVenueForm] = useState({
    name: '', address: '', city: '', whatsapp_number: '', description: '', logo_url: '',
  });
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueError, setVenueError] = useState('');
  const [venueSuccess, setVenueSuccess] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [t, v] = await Promise.all([
        api.get('/tournaments/my'),
        api.get('/tournaments/venues'),
      ]);
      setTournaments(t.data);
      setVenues(v.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleVenueSubmit = async (e) => {
    e.preventDefault();
    setVenueError('');
    setVenueLoading(true);
    try {
      const res = await api.post('/tournaments/venues', venueForm);
      setVenueSuccess(res.data.message);
      setShowVenueForm(false);
      setVenueForm({ name: '', address: '', city: '', whatsapp_number: '', description: '', logo_url: '' });
      fetchData();
    } catch (err) {
      setVenueError(err.response?.data?.message || 'שגיאה');
    } finally {
      setVenueLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-spin inline-block">🂡</div>
        <p className="text-slate-400">טוען...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-white">🏠 לוח ניהול</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + הוסף טורניר
        </button>
      </div>

      {venueSuccess && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-xl text-green-400 text-sm">
          {venueSuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800 p-1 rounded-xl w-fit">
        {[['tournaments', '🃏 טורנירים'], ['venues', '🏠 מקומות']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === id ? 'bg-poker-green text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tournament add modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">הוספת טורניר חדש</h2>
            {venues.filter(v => v.is_approved).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-amber-400 mb-2">אין לך עדיין מקומות מאושרים</p>
                <p className="text-slate-400 text-sm">הוסף מקום ועמוד לאישור המנהל תחילה</p>
                <button onClick={() => { setShowForm(false); setTab('venues'); setShowVenueForm(true); }}
                  className="btn-primary mt-4">הוסף מקום</button>
              </div>
            ) : (
              <TournamentForm venues={venues} onSuccess={() => { setShowForm(false); fetchData(); }} onCancel={() => setShowForm(false)} />
            )}
          </div>
        </div>
      )}

      {/* Tournaments tab */}
      {tab === 'tournaments' && (
        <div className="space-y-3">
          {/* Bulk uploader */}
          <BulkUploader venues={venues} onSuccess={fetchData} />

          {tournaments.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-5xl mb-3 opacity-20">🃏</div>
              <p className="text-slate-400">עדיין אין לך טורנירים</p>
              <button onClick={() => setShowForm(true)} className="btn-primary mt-4">+ הוסף את הראשון</button>
            </div>
          ) : tournaments.map(t => (
            <div key={t.id} className="card p-4 flex flex-wrap gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-100">{t.name}</h3>
                  <span className={`badge-status ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{t.venue_name} · {formatDate(t.start_time)} · {formatTime(t.start_time)}</p>
                <p className="text-sm text-poker-gold font-semibold">{formatCost(t.cost)}</p>
                {t.rejection_reason && (
                  <p className="text-xs text-red-400 mt-1 bg-red-900/20 rounded px-2 py-1">סיבת דחייה: {t.rejection_reason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Venues tab */}
      {tab === 'venues' && (
        <div className="space-y-3">
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowVenueForm(p => !p)} className="btn-ghost text-sm">
              {showVenueForm ? 'סגור' : '+ הוסף מקום'}
            </button>
          </div>

          {/* Venue form */}
          {showVenueForm && (
            <div className="card p-5 border-poker-green/50 animate-slide-up">
              <h3 className="font-bold text-white mb-4">הוספת מקום חדש</h3>
              <form onSubmit={handleVenueSubmit} className="space-y-4">

                {/* Logo uploader */}
                <LogoUploader
                  value={venueForm.logo_url}
                  onChange={(url) => setVenueForm(p => ({ ...p, logo_url: url }))}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">שם המקום *</label>
                    <input type="text" value={venueForm.name}
                      onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))}
                      className="input-field text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">עיר *</label>
                    <input type="text" value={venueForm.city}
                      onChange={e => setVenueForm(p => ({ ...p, city: e.target.value }))}
                      className="input-field text-sm" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">כתובת מלאה *</label>
                    <input type="text" value={venueForm.address}
                      onChange={e => setVenueForm(p => ({ ...p, address: e.target.value }))}
                      className="input-field text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">מספר וואצאפ * (לרישומים)</label>
                    <input type="tel" value={venueForm.whatsapp_number}
                      onChange={e => setVenueForm(p => ({ ...p, whatsapp_number: e.target.value }))}
                      className="input-field text-sm" placeholder="050-0000000" dir="ltr" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">תיאור המקום</label>
                    <textarea value={venueForm.description}
                      onChange={e => setVenueForm(p => ({ ...p, description: e.target.value }))}
                      className="input-field text-sm resize-none" rows={2} />
                  </div>
                </div>

                {venueError && <p className="text-red-400 text-sm">{venueError}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={venueLoading} className="btn-primary text-sm">
                    {venueLoading ? 'שולח...' : '📤 שלח לאישור'}
                  </button>
                  <button type="button" onClick={() => setShowVenueForm(false)} className="btn-ghost text-sm">ביטול</button>
                </div>
              </form>
            </div>
          )}

          {/* Venue list */}
          {venues.length === 0 && !showVenueForm ? (
            <div className="card p-12 text-center">
              <div className="text-5xl mb-3 opacity-20">🏠</div>
              <p className="text-slate-400">עדיין אין לך מקומות רשומים</p>
            </div>
          ) : venues.map(v => (
            <div key={v.id} className="card p-4">
              <div className="flex items-start gap-3">
                {/* Logo */}
                {v.logo_url ? (
                  <img src={v.logo_url} alt="לוגו" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-700" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center text-2xl shrink-0">🏠</div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-slate-100">{v.name}</h3>
                    <span className={`badge-status ${v.is_approved ? 'text-green-400 bg-green-900/20' : 'text-amber-400 bg-amber-900/20'}`}>
                      {v.is_approved ? '✅ מאושר' : '⏳ ממתין לאישור'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">📍 {v.address}, {v.city}</p>
                  <p className="text-sm text-slate-400">📱 {v.whatsapp_number}</p>

                  {/* Video manager — only for approved venues */}
                  {v.is_approved && <VideoManager venue={v} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
