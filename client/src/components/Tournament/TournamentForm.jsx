import { useState } from 'react';
import api from '../../utils/api';
import { DAYS_HE } from '../../utils/whatsapp';

export default function TournamentForm({ venues, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    venue_id: '', name: '', description: '', cost: '',
    start_time: '', estimated_end_time: '',
    is_recurring: false, day_of_week: '',
    stages: [{ name: '', duration_minutes: '' }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const updateStage = (i, k, v) => {
    const s = [...form.stages];
    s[i] = { ...s[i], [k]: v };
    setForm(p => ({ ...p, stages: s }));
  };

  const addStage = () => setForm(p => ({ ...p, stages: [...p.stages, { name: '', duration_minutes: '' }] }));
  const removeStage = (i) => setForm(p => ({ ...p, stages: p.stages.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        venue_id: parseInt(form.venue_id),
        cost: parseFloat(form.cost),
        day_of_week: form.day_of_week !== '' ? parseInt(form.day_of_week) : null,
        stages: form.stages.filter(s => s.name).map(s => ({ ...s, duration_minutes: parseInt(s.duration_minutes) })),
      };
      await api.post('/tournaments', payload);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשמירת הטורניר');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-300 mb-1">מקום *</label>
          <select value={form.venue_id} onChange={e => set('venue_id', e.target.value)}
            className="input-field" required>
            <option value="">בחר מקום...</option>
            {venues.filter(v => v.is_approved).map(v => (
              <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
            ))}
          </select>
          {venues.filter(v => !v.is_approved).length > 0 && (
            <p className="text-xs text-amber-400 mt-1">יש לך מקומות ממתינים לאישור</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-300 mb-1">שם הטורניר *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className="input-field" placeholder="למשל: טורניר שבועי" required />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">עלות (₪) *</label>
          <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)}
            className="input-field" placeholder="0" min="0" required />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">שעת התחלה *</label>
          <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)}
            className="input-field" required />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">שעת סיום משוערת</label>
          <input type="datetime-local" value={form.estimated_end_time} onChange={e => set('estimated_end_time', e.target.value)}
            className="input-field" />
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)}
            className="w-4 h-4 accent-poker-green" />
          <label htmlFor="recurring" className="text-sm font-semibold text-slate-300">טורניר שבועי חוזר</label>
        </div>

        {form.is_recurring && (
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">יום בשבוע</label>
            <select value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)} className="input-field">
              <option value="">בחר יום...</option>
              {DAYS_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">תיאור הטורניר</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          className="input-field resize-none" rows={3} placeholder="מידע כללי, פרייז פול, מבנה..." />
      </div>

      {/* Stages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-300">שלבים</label>
          <button type="button" onClick={addStage} className="text-xs text-poker-green-light hover:text-poker-gold">+ הוסף שלב</button>
        </div>
        <div className="space-y-2">
          {form.stages.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="text" value={s.name} onChange={e => updateStage(i, 'name', e.target.value)}
                className="input-field flex-1" placeholder="שם השלב" />
              <input type="number" value={s.duration_minutes} onChange={e => updateStage(i, 'duration_minutes', e.target.value)}
                className="input-field w-24" placeholder="דקות" min="1" />
              {form.stages.length > 1 && (
                <button type="button" onClick={() => removeStage(i)} className="text-red-400 hover:text-red-300 p-1">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'שולח...' : '📤 שלח לאישור מנהל'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">ביטול</button>
      </div>
    </form>
  );
}
