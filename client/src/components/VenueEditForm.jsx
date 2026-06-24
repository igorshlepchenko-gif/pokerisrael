import { useState, useRef } from 'react';
import api from '../utils/api';

export function LogoUploader({ value, onChange }) {
  const inputRef = useRef();
  const [savedUrl, setSavedUrl]         = useState(value || null);
  const [pendingDataUrl, setPending]    = useState(null);
  const [pendingFile, setPendingFile]   = useState(null);
  const [zoom, setZoom]                 = useState(1);
  const [uploading, setUploading]       = useState(false);

  const uploadBlob = async (blob, filename) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', blob, filename);
      const res = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(res.data.url);
      setSavedUrl(res.data.url);
      setPending(null);
      setPendingFile(null);
      setZoom(1);
    } catch {
      alert('שגיאה בהעלאת הלוגו');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (file.type === 'image/svg+xml') {
      uploadBlob(file, file.name);
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => { setPending(ev.target.result); setPendingFile(file); setZoom(1); };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (!pendingDataUrl || !pendingFile) return;
    const SIZE = 400;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const aspect = img.width / img.height;
      const fitW = aspect >= 1 ? SIZE : SIZE * aspect;
      const fitH = aspect >= 1 ? SIZE / aspect : SIZE;
      const dW = fitW * zoom, dH = fitH * zoom;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, (SIZE - dW) / 2, (SIZE - dH) / 2, dW, dH);
      canvas.toBlob(
        blob => uploadBlob(blob, pendingFile.name.replace(/\.[^.]+$/, '.png')),
        'image/png'
      );
    };
    img.src = pendingDataUrl;
  };

  const handleCancel = () => { setPending(null); setPendingFile(null); setZoom(1); };

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">לוגו המועדון</label>
      {pendingDataUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-24 h-24 rounded-xl border-2 border-blue-500 overflow-hidden bg-slate-900/50 shrink-0 flex items-center justify-center">
              <img
                src={pendingDataUrl}
                alt="תצוגה מקדימה"
                className="w-full h-full object-contain"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>זום: {Math.round(zoom * 100)}%</span>
                  <span className="opacity-60">גרור לכוונון</span>
                </div>
                <input
                  type="range" min="0.3" max="3" step="0.05"
                  value={zoom}
                  onChange={e => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 h-1.5"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleConfirm} disabled={uploading}
                  className="btn-primary text-xs flex-1 py-1.5">
                  {uploading ? '⏳ מעלה...' : '✓ אשר'}
                </button>
                <button type="button" onClick={handleCancel}
                  className="btn-ghost text-xs px-3 py-1.5">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div
            onClick={() => inputRef.current.click()}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-600 hover:border-poker-green cursor-pointer flex items-center justify-center overflow-hidden transition-colors bg-slate-900/50 shrink-0"
          >
            {savedUrl
              ? <img src={savedUrl} alt="לוגו" className="w-full h-full object-contain" />
              : <span className="text-3xl opacity-30">🏠</span>
            }
          </div>
          <div className="flex-1">
            <button type="button" onClick={() => inputRef.current.click()}
              className="btn-ghost text-xs w-full mb-1">
              {uploading ? '⏳ מעלה...' : savedUrl ? '🔄 החלף לוגו' : '📷 בחר לוגו'}
            </button>
            <p className="text-[10px] text-slate-500">PNG, JPG, SVG · מקס 10MB</p>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function VenueEditForm({ venue, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    name:            venue.name            || '',
    address:         venue.address         || '',
    city:            venue.city            || '',
    whatsapp_number: venue.whatsapp_number || '',
    description:     venue.description     || '',
    logo_url:        venue.logo_url        || '',
    venue_type:      venue.venue_type      || 'physical',
    club_number:     venue.club_number     || '',
    agent_number:    venue.agent_number    || '',
    website:         venue.website         || '',
    registration_url: venue.registration_url || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.website) {
      const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;
      if (!urlPattern.test(form.website.trim())) {
        setError('כתובת האתר אינה תקינה — לדוגמה: www.example.com');
        return;
      }
    }
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
          <label className="block text-xs text-slate-400 mb-1">קישור לאתר המקום (אופציונלי)</label>
          <input type="text" value={form.website} onChange={e => set('website', e.target.value)}
            className="input-field text-sm" placeholder="www.example.com" dir="ltr" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">🔗 קישור לאתר ההרשמות (אופציונלי)</label>
          <input type="text" value={form.registration_url} onChange={e => set('registration_url', e.target.value)}
            className="input-field text-sm" placeholder="https://runnerrunner.app/register" dir="ltr" />
          <p className="text-[10px] text-slate-500 mt-1">מופיע ככפתור "הרשמה אונליין" בטורנירים שלכם (לצד הוואטסאפ)</p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">תיאור המועדון</label>
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
