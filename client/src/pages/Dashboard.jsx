import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import TournamentForm from '../components/Tournament/TournamentForm';
import { formatDate, formatTime, formatCost, eventDisplayDate, DAYS_HE } from '../utils/whatsapp';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = { pending: '⏳ ממתין', approved: '✅ מאושר', rejected: '❌ נדחה' };
const STATUS_COLORS = { pending: 'text-amber-400 bg-amber-900/20', approved: 'text-green-400 bg-green-900/20', rejected: 'text-red-400 bg-red-900/20' };

const isPast = (t) =>
  !t.is_recurring && new Date(t.estimated_end_time || t.start_time) < new Date();

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
      <label className="block text-xs text-slate-400 mb-1">לוגו המועדון</label>
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
  const approvedVenues = venues.filter(v => v.is_approved);
  const [open, setOpen] = useState(false);
  // אם יש מועדון מאושר אחד — בחר אותו אוטומטית
  const [venueId, setVenueId] = useState(approvedVenues.length === 1 ? String(approvedVenues[0].id) : '');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success, message, errors, tournaments }
  const inputRef = useRef();

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/tournaments/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'תבנית_טורנירים.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('שגיאה בהורדת התבנית');
    }
  };

  const handleSubmit = async () => {
    if (!file) return setResult({ success: false, message: 'יש לבחור קובץ' });
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
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
        <span className="flex items-center gap-2">📊 העלאת אירועים מקובץ Excel
          <span className="text-xs font-normal text-slate-500">טורנירים וקאש · עד 20 בבת אחת</span>
        </span>
        <span className="text-slate-500 text-xs">{open ? '▲ סגור' : '▼ פתח'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-700/50 animate-slide-up space-y-4 pt-4">

          {/* Template download */}
          <div className="flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-200">📥 הורד תבנית Excel מלאה</p>
              <p className="text-xs text-slate-500 mt-0.5">עם רשימות נפתחות, דוגמאות וגיליון הוראות</p>
            </div>
            <button onClick={downloadTemplate}
              className="btn-ghost text-xs whitespace-nowrap">⬇️ הורד תבנית</button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-slate-500 bg-slate-800/40 rounded-xl px-4 py-3 space-y-1 leading-relaxed">
            <p className="font-semibold text-slate-400 mb-1.5">📋 הנחיות:</p>
            <p>• כל שורה = אירוע. בחר <strong>סוג אירוע</strong> ו-<strong>מועדון</strong> מהרשימות הנפתחות בקובץ</p>
            <p>• שדות חובה: <strong>סוג אירוע · מועדון · שם · עלות/כניסה · תאריך + שעה</strong></p>
            <p>• כל סוג אירוע משתמש בשדות הרלוונטיים לו בלבד (טורניר = בליינדים/GTD, קאש = SB/BB/סוג משחק, אונליין = פלטפורמה)</p>
            <p>• <strong>מבנה בליינדים</strong> (לטורניר): בחר <span className="font-mono bg-slate-700 px-1 rounded">regular/turbo/hyper</span> או תבנית שמורה שלך</p>
            <p>• פירוט מלא בגיליון <strong>"הוראות"</strong> שבתוך הקובץ · מקסימום <strong>20 שורות</strong></p>
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
          <button onClick={handleSubmit} disabled={loading || !file}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? '⏳ מעלה...' : `📤 העלה אירועים${file ? ` (${file.name})` : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Venue Edit Form ---
function VenueEditForm({ venue, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    name:             venue.name             || '',
    address:          venue.address          || '',
    city:             venue.city             || '',
    whatsapp_number:  venue.whatsapp_number  || '',
    description:      venue.description      || '',
    logo_url:         venue.logo_url         || '',
    venue_type:       venue.venue_type       || 'physical',
    club_number:      venue.club_number      || '',
    agent_number:     venue.agent_number     || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.put(`/tournaments/venues/${venue.id}`, form);
      onSuccess(res.data.message || 'המועדון עודכן בהצלחה');
    } catch (err) {
      const d = err.response?.data;
      setError(d?.message || d?.errors?.[0]?.msg || 'שגיאה בשמירת המועדון');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* סוג מועדון */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">סוג מועדון *</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: 'physical', icon: '🏢', label: 'פיזי', sub: 'מועדון במיקום פיזי' },
            { val: 'online',   icon: '💻', label: 'אונליין', sub: 'מועדון באפליקציה' },
          ].map(({ val, icon, label, sub }) => (
            <button key={val} type="button"
              onClick={() => set('venue_type', val)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                form.venue_type === val
                  ? 'border-blue-500 bg-blue-600/20 text-white'
                  : 'border-slate-600 bg-slate-800/40 text-slate-400 hover:border-slate-500'
              }`}>
              <div className="text-xl mb-0.5">{icon}</div>
              <div className="text-sm font-bold">{label}</div>
              <div className="text-[11px] opacity-60">{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <LogoUploader value={form.logo_url} onChange={url => set('logo_url', url)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">שם המועדון *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className="input-field text-sm" required />
        </div>

        {form.venue_type === 'online' ? (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">מספר מועדון באפליקציה *</label>
              <input type="text" value={form.club_number} onChange={e => set('club_number', e.target.value)}
                className="input-field text-sm" placeholder="למשל: 123456" dir="ltr" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">מספר סוכן <span className="text-slate-500">(לא חובה)</span></label>
              <input type="text" value={form.agent_number} onChange={e => set('agent_number', e.target.value)}
                className="input-field text-sm" placeholder="למשל: 7890" dir="ltr" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">עיר *</label>
              <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                className="input-field text-sm" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">כתובת מלאה *</label>
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                className="input-field text-sm" required />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">מספר וואצאפ * (להרשמות)</label>
          <input type="tel" value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)}
            className="input-field text-sm" placeholder="050-0000000" dir="ltr" required />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">תארו את המועדון שלכם, במה אתם ייחודיים ומה אתם מציעים</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className="input-field text-sm resize-none" rows={2} />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm">
          {loading ? 'שומר...' : '💾 שמור שינויים'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1 text-sm">ביטול</button>
      </div>
    </form>
  );
}

// --- Main Dashboard ---
export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('tournaments');
  const [tournaments, setTournaments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [venueForm, setVenueForm] = useState({
    name: '', address: '', city: '', whatsapp_number: '', description: '', logo_url: '',
    venue_type: 'physical', club_number: '', agent_number: '',
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

  const handleSkipNext = async (t) => {
    const next = eventDisplayDate(t);
    const dateStr = next ? new Date(next).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    if (!confirm(`לדלג על המופע הקרוב (${dateStr})?\nהאירוע יציג במקום זאת את המופע שאחריו.`)) return;
    try {
      await api.post(`/tournaments/${t.id}/skip-next`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'שגיאה בדילוג על המופע');
    }
  };

  const handleClearSkips = async (id) => {
    try {
      await api.post(`/tournaments/${id}/clear-skips`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'שגיאה באיפוס הדילוגים');
    }
  };

  const handleVenueSubmit = async (e) => {
    e.preventDefault();
    setVenueError('');
    setVenueLoading(true);
    try {
      const res = await api.post('/tournaments/venues', venueForm);
      setVenueSuccess(res.data.message);
      setShowVenueForm(false);
      setVenueForm({ name: '', address: '', city: '', whatsapp_number: '', description: '', logo_url: '', venue_type: 'physical', club_number: '', agent_number: '' });
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
        <h1 className="text-2xl font-black text-white">
          📅 האירועים שלך{user?.name ? ` · ${user.name}` : ''}
        </h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + הוסף אירוע
        </button>
      </div>

      {venueSuccess && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-xl text-green-400 text-sm">
          {venueSuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800 p-1 rounded-xl w-fit">
        {[['tournaments', '🃏 אירועים'], ['venues', '🏠 מועדונים']].map(([id, label]) => (
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">הוספת אירוע חדש</h2>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-500/80 text-slate-300 hover:text-white transition-all text-sm">
                ✕
              </button>
            </div>
            {venues.filter(v => v.is_approved).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-amber-400 mb-2">אין לך עדיין מועדונים מאושרים</p>
                <p className="text-slate-400 text-sm">הוסף מועדון ועמוד לאישור המנהל תחילה</p>
                <button onClick={() => { setShowForm(false); setTab('venues'); setShowVenueForm(true); }}
                  className="btn-primary mt-4">הוסף מועדון</button>
              </div>
            ) : (
              <TournamentForm venues={venues} onSuccess={() => { setShowForm(false); fetchData(); }} onCancel={() => setShowForm(false)} />
            )}
          </div>
        </div>
      )}

      {/* Tournament edit modal */}
      {editingTournament && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">✏️ עריכת אירוע</h2>
              <button onClick={() => setEditingTournament(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-500/80 text-slate-300 hover:text-white transition-all text-sm">
                ✕
              </button>
            </div>
            <TournamentForm
              venues={venues}
              tournament={editingTournament}
              onSuccess={() => { setEditingTournament(null); fetchData(); }}
              onCancel={() => setEditingTournament(null)}
            />
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
              <p className="text-slate-400">עדיין אין לך אירועים</p>
              <button onClick={() => setShowForm(true)} className="btn-primary mt-4">+ הוסף את הראשון</button>
            </div>
          ) : tournaments.map(t => {
            const past = isPast(t);
            return (
              <div key={t.id} className={`card p-4 flex flex-wrap gap-4 items-start ${past ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-100">{t.name}</h3>
                    <span className={`badge-status ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                    {past && (
                      <span className="text-[10px] bg-slate-700/80 text-slate-400 px-1.5 py-0.5 rounded-full border border-slate-600">🕐 עבר</span>
                    )}
                    {t.re_entry && (
                      <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded-full">🔄 {t.re_entry}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {t.venue_name} · {formatDate(eventDisplayDate(t))} · {formatTime(eventDisplayDate(t))}
                    {t.is_recurring && t.day_of_week !== null && (
                      <span className="text-poker-gold"> · כל יום {DAYS_HE[t.day_of_week]}</span>
                    )}
                  </p>
                  <p className="text-sm text-poker-gold font-semibold">{formatCost(t.cost)}</p>
                  {t.is_recurring && Array.isArray(t.skipped_dates) && t.skipped_dates.length > 0 && (
                    <p className="text-xs text-amber-400 mt-1">⏭️ {t.skipped_dates.length} מופעים מדולגים ·
                      <button onClick={() => handleClearSkips(t.id)} className="underline hover:text-amber-300 mr-1">בטל דילוגים</button>
                    </p>
                  )}
                  {t.rejection_reason && (
                    <p className="text-xs text-red-400 mt-1 bg-red-900/20 rounded px-2 py-1">סיבת דחייה: {t.rejection_reason}</p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1.5">
                  <button
                    onClick={() => setEditingTournament(t)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-poker-green hover:text-poker-green-light text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    ✏️ עריכה
                  </button>
                  {t.is_recurring && (
                    <button
                      onClick={() => handleSkipNext(t)}
                      title="למשל כשהמופע נופל על חג"
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-amber-500 hover:text-amber-400 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                    >
                      ⏭️ דלג על המופע הבא
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Venues tab */}
      {tab === 'venues' && (
        <div className="space-y-3">
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowVenueForm(p => !p)} className="btn-ghost text-sm">
              {showVenueForm ? 'סגור' : '+ הוסף מועדון'}
            </button>
          </div>

          {/* Venue form */}
          {showVenueForm && (
            <div className="card p-5 border-poker-green/50 animate-slide-up">
              <h3 className="font-bold text-white mb-4">הוספת מועדון חדש</h3>
              <form onSubmit={handleVenueSubmit} className="space-y-4">

                {/* סוג מועדון */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">סוג מועדון *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: 'physical', icon: '🏢', label: 'פיזי', sub: 'מועדון במיקום פיזי' },
                      { val: 'online',   icon: '💻', label: 'אונליין', sub: 'מועדון באפליקציה' },
                    ].map(({ val, icon, label, sub }) => (
                      <button key={val} type="button"
                        onClick={() => setVenueForm(p => ({ ...p, venue_type: val }))}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          venueForm.venue_type === val
                            ? 'border-blue-500 bg-blue-600/20 text-white'
                            : 'border-slate-600 bg-slate-800/40 text-slate-400 hover:border-slate-500'
                        }`}>
                        <div className="text-xl mb-0.5">{icon}</div>
                        <div className="text-sm font-bold">{label}</div>
                        <div className="text-[11px] opacity-60">{sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo uploader */}
                <LogoUploader
                  value={venueForm.logo_url}
                  onChange={(url) => setVenueForm(p => ({ ...p, logo_url: url }))}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">שם המועדון *</label>
                    <input type="text" value={venueForm.name}
                      onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))}
                      className="input-field text-sm" required />
                  </div>

                  {venueForm.venue_type === 'online' ? (
                    <>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">מספר מועדון באפליקציה *</label>
                        <input type="text" value={venueForm.club_number}
                          onChange={e => setVenueForm(p => ({ ...p, club_number: e.target.value }))}
                          className="input-field text-sm" placeholder="למשל: 123456" dir="ltr" required />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">מספר סוכן <span className="text-slate-500">(לא חובה)</span></label>
                        <input type="text" value={venueForm.agent_number}
                          onChange={e => setVenueForm(p => ({ ...p, agent_number: e.target.value }))}
                          className="input-field text-sm" placeholder="למשל: 7890" dir="ltr" />
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">מספר וואצאפ * (להרשמות)</label>
                    <input type="tel" value={venueForm.whatsapp_number}
                      onChange={e => setVenueForm(p => ({ ...p, whatsapp_number: e.target.value }))}
                      className="input-field text-sm" placeholder="050-0000000" dir="ltr" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">תארו את המועדון שלכם, במה אתם ייחודיים ומה אתם מציעים</label>
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

          {/* Venue edit modal */}
          {editingVenue && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">✏️ עריכת מועדון</h3>
                  <button onClick={() => setEditingVenue(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-red-500/80 text-slate-300 hover:text-white transition-all text-sm">
                    ✕
                  </button>
                </div>
                <VenueEditForm
                  venue={editingVenue}
                  onSuccess={(msg) => { setVenueSuccess(msg); setEditingVenue(null); fetchData(); }}
                  onCancel={() => setEditingVenue(null)}
                />
              </div>
            </div>
          )}

          {/* Venue list */}
          {venues.length === 0 && !showVenueForm ? (
            <div className="card p-12 text-center">
              <div className="text-5xl mb-3 opacity-20">🏠</div>
              <p className="text-slate-400">עדיין אין לך מועדונים רשומים</p>
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
                    <button
                      onClick={() => setEditingVenue(v)}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-slate-600 text-slate-400 hover:border-poker-green hover:text-poker-green-light text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                    >
                      ✏️ עריכה
                    </button>
                  </div>
                  {v.venue_type === 'online' ? (
                    <>
                      <p className="text-sm text-slate-400">💻 מועדון אונליין · מספר: <span className="text-slate-200 font-semibold">{v.club_number}</span></p>
                      {v.agent_number && <p className="text-sm text-slate-400">🪪 סוכן: {v.agent_number}</p>}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">📍 {v.address}, {v.city}</p>
                  )}
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
