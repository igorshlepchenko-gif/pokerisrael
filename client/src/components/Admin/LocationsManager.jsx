import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { parsePastedCoords } from '../../utils/nearby';

/**
 * ניהול טבלת locations — מיפוי כתובת -> קואורדינטות.
 *
 * החלק החשוב במסך הוא דווקא הקטע העליון: כתובות שאינן ממופות. טורניר בכתובת
 * כזו לא מקבל מיקום (בכוונה — מיקום המועדון היה בעיר אחרת), ולכן נעלם מ"מצא
 * טורניר קרוב אליי" בלי שום סימן. כאן זה הופך לגלוי ולניתן לתיקון בלחיצה.
 */
export default function LocationsManager() {
  const [data, setData] = useState({ locations: [], unmapped: [], venuesMissing: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/locations');
      setData(res.data);
    } catch {
      setErr('שגיאה בטעינת המיקומים');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (form) => {
    setErr(''); setMsg('');
    try {
      if (form.id) await api.put(`/admin/locations/${form.id}`, form);
      else await api.post('/admin/locations', form);
      setMsg('המיקום נשמר ✓');
      setEditing(null);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'שגיאה בשמירה');
    }
  };

  const remove = async (loc) => {
    if (!confirm(`למחוק את המיקום "${loc.address}"?\nטורנירים בכתובת הזו יפסיקו לקבל מרחק ולא יוצעו.`)) return;
    setErr(''); setMsg('');
    try {
      const res = await api.delete(`/admin/locations/${loc.id}`);
      setMsg(res.data.message);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'שגיאה במחיקה');
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-400">טוען…</div>;

  return (
    <div className="space-y-6">
      {msg && <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-xl px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="bg-red-500/15 border border-red-500/40 text-red-300 rounded-xl px-4 py-2 text-sm">{err}</div>}

      {/* כתובות חסרות — החלק שבאמת דורש פעולה */}
      {data.unmapped.length > 0 && (
        <div className="border border-amber-500/40 bg-amber-500/5 rounded-xl p-4">
          <h3 className="font-black text-amber-300 mb-1">⚠️ כתובות ללא מיקום — {data.unmapped.length}</h3>
          <p className="text-xs text-amber-200/70 mb-3">
            הטורנירים האלה לא מקבלים מרחק, ולכן <strong>לא מוצעים</strong> ב"מצא טורניר קרוב אליי".
          </p>
          <div className="space-y-2">
            {data.unmapped.map((u, i) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-slate-900/50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">{u.address}</div>
                  <div className="text-[11px] text-slate-400">
                    {u.n} טורנירים · {u.city || 'ללא עיר'} · {u.venue_name}
                  </div>
                </div>
                <button
                  onClick={() => setEditing({ address: u.address, city: u.city, latitude: '', longitude: '' })}
                  className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                >
                  הוסף מיקום
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.venuesMissing.length > 0 && (
        <div className="border border-slate-700 rounded-xl p-4">
          <h3 className="font-bold text-slate-300 mb-2">מועדונים ללא מיקום — {data.venuesMissing.length}</h3>
          <p className="text-xs text-slate-500 mb-2">
            אפשר להזין להם מיקום ישירות בעריכת המועדון, או להוסיף כאן את הכתובת.
          </p>
          {data.venuesMissing.map(v => (
            <div key={v.id} className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm text-slate-300">
                {v.name} — {v.address || '(ללא כתובת)'}{v.city ? `, ${v.city}` : ''}
              </span>
              {v.address && (
                <button
                  onClick={() => setEditing({ address: v.address, city: v.city, latitude: '', longitude: '' })}
                  className="text-xs text-blue-400 hover:underline shrink-0"
                >
                  הוסף מיקום
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-black text-white">📍 מיקומים מוגדרים ({data.locations.length})</h3>
        <button
          onClick={() => setEditing({ address: '', city: '', latitude: '', longitude: '' })}
          className="btn-primary text-sm"
        >
          + מיקום חדש
        </button>
      </div>

      {editing && <LocationForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700">
              <th className="text-right py-2 px-2">כתובת</th>
              <th className="text-right py-2 px-2">עיר</th>
              <th className="text-center py-2 px-2">קואורדינטות</th>
              <th className="text-center py-2 px-2">בשימוש</th>
              <th className="text-center py-2 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.locations.map(l => (
              <tr key={l.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                <td className="py-2 px-2 text-white">{l.address}</td>
                <td className="py-2 px-2 text-slate-400">{l.city || '—'}</td>
                <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-300 text-xs whitespace-nowrap">
                  {Number(l.latitude).toFixed(5)}, {Number(l.longitude).toFixed(5)}
                </td>
                <td className="py-2 px-2 text-center text-slate-400 text-xs whitespace-nowrap">
                  {l.tournament_count > 0 && <span>{l.tournament_count} טורנירים</span>}
                  {l.tournament_count > 0 && l.venue_count > 0 && ' · '}
                  {l.venue_count > 0 && <span>{l.venue_count} מועדונים</span>}
                  {l.tournament_count === 0 && l.venue_count === 0 && <span className="text-slate-600">לא בשימוש</span>}
                </td>
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  <button onClick={() => setEditing(l)} className="text-blue-400 hover:underline text-xs">ערוך</button>
                  <span className="text-slate-700 mx-1.5">|</span>
                  <button onClick={() => remove(l)} className="text-red-400 hover:underline text-xs">מחק</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LocationForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    id: initial.id,
    address: initial.address || '',
    city: initial.city || '',
    latitude: initial.latitude ?? '',
    longitude: initial.longitude ?? '',
    notes: initial.notes || '',
  });
  const [paste, setPaste] = useState('');
  const [pasteErr, setPasteErr] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const applyPaste = (text) => {
    setPaste(text);
    if (!text.trim()) { setPasteErr(''); return; }
    const c = parsePastedCoords(text);
    if (c) {
      setForm(p => ({ ...p, latitude: String(c.lat), longitude: String(c.lng) }));
      setPasteErr('');
    } else {
      setPasteErr('לא זוהו קואורדינטות. בקישור מקוצר (maps.app.goo.gl) — לפתוח קודם ואז להעתיק מסרגל הכתובות.');
    }
  };

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(form); }}
      className="border border-blue-500/40 bg-blue-500/5 rounded-xl p-4 space-y-3"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">כתובת *</label>
          <input value={form.address} onChange={e => set('address', e.target.value)}
            className="input-field text-sm" required placeholder="הרצל 1" />
          <p className="text-[11px] text-slate-500 mt-1">
            הכתובת צריכה להיכתב כפי שהיא מופיעה בטורניר. שינויי פיסוק ו״קומה 2״ לא משנים — הם מנוטרלים אוטומטית.
          </p>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">עיר</label>
          <input value={form.city} onChange={e => set('city', e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">הערה</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">הדבק קישור מ-Google Maps</label>
          <input value={paste} onChange={e => applyPaste(e.target.value)}
            className="input-field text-sm" placeholder="קישור, או 31.9730, 34.7925" />
          {pasteErr && <p className="text-amber-400 text-[11px] mt-1">{pasteErr}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">קו רוחב *</label>
          <input type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)}
            className="input-field text-sm" required placeholder="31.9730" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">קו אורך *</label>
          <input type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)}
            className="input-field text-sm" required placeholder="34.7925" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm flex-1">💾 שמור</button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-slate-600 text-slate-300 rounded-xl text-sm py-2">ביטול</button>
      </div>
    </form>
  );
}
