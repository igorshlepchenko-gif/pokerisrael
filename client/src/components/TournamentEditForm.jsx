import { useState } from 'react';
import api from '../utils/api';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const RE_ENTRY_OPTIONS = ['1X', '2X', '3X', '4X', '5X', 'Unlimited'];

// Convert ISO UTC string → "YYYY-MM-DDTHH:mm" in Israel local time (for datetime-local input)
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function TournamentEditForm({ tournament: t, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:                   t.name || '',
    description:            t.description || '',
    cost:                   t.cost || '',
    rake:                   t.rake || '',
    rake_type:              t.rake_type || 'amount',
    re_entry:               t.re_entry || '',
    starting_stack:         t.starting_stack || '',
    level_duration:         t.level_duration || '',
    gtd:                    t.gtd || '',
    is_recurring:           t.is_recurring || false,
    day_of_week:            t.day_of_week ?? '',
    start_time:             toLocalInput(t.start_time),
    estimated_end_time:     toLocalInput(t.estimated_end_time),
    game_type:              t.game_type || '',
    external_registration_url: t.external_registration_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/tournaments/${t.id}`, {
        ...form,
        cost:           parseFloat(form.cost)           || null,
        rake:           form.rake ? parseFloat(form.rake) : null,
        starting_stack: form.starting_stack ? parseInt(form.starting_stack) : null,
        level_duration: form.level_duration ? parseInt(form.level_duration) : null,
        gtd:            form.gtd ? parseInt(form.gtd) : null,
        day_of_week:    form.day_of_week !== '' ? parseInt(form.day_of_week) : null,
        start_time:     form.start_time || null,
        estimated_end_time: form.estimated_end_time || null,
        game_type:      form.game_type || null,
        external_registration_url: form.external_registration_url || null,
        // pass through unchanged fields
        stages:         t.stages || [],
        secondary_games: t.secondary_games || [],
        cash_sb:        t.cash_sb,
        cash_bb:        t.cash_bb,
        late_reg_level: t.late_reg_level,
        platform:       t.platform,
        address:        t.address,
        city:           t.city,
      });
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, children }) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );

  const inp = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500/60 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-700/60 mt-3 pt-4 space-y-4" dir="rtl">

      {/* Row 1: Name + Game type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="שם הטורניר">
          <input className={`${inp} sm:col-span-2`} value={form.name} onChange={e => set('name', e.target.value)} required />
        </Field>
        <Field label="סוג משחק">
          <select className={inp} value={form.game_type} onChange={e => set('game_type', e.target.value)}>
            <option value="">NLH (ברירת מחדל)</option>
            <option value="omaha">Omaha / PLO</option>
            <option value="mixed">Mixed</option>
            <option value="other">אחר</option>
          </select>
        </Field>
      </div>

      {/* Row 2: Times */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="תאריך ושעת התחלה">
          <input type="datetime-local" className={inp} value={form.start_time} onChange={e => set('start_time', e.target.value)} />
        </Field>
        <Field label="שעת סיום משוערת">
          <input type="datetime-local" className={inp} value={form.estimated_end_time} onChange={e => set('estimated_end_time', e.target.value)} />
        </Field>
      </div>

      {/* Row 3: Cost / Rake / Re-entry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="עלות כניסה (₪)">
          <input type="number" className={inp} value={form.cost} onChange={e => set('cost', e.target.value)} min="0" />
        </Field>
        <Field label="Rake (₪)">
          <input type="number" className={inp} value={form.rake} onChange={e => set('rake', e.target.value)} min="0" />
        </Field>
        <Field label="כניסה חוזרת">
          <select className={inp} value={form.re_entry} onChange={e => set('re_entry', e.target.value)}>
            <option value="">—</option>
            {RE_ENTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="GTD (₪)">
          <input type="number" className={inp} value={form.gtd} onChange={e => set('gtd', e.target.value)} min="0" />
        </Field>
      </div>

      {/* Row 4: Stack / Level duration */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="ערימה התחלתית">
          <input type="number" className={inp} value={form.starting_stack} onChange={e => set('starting_stack', e.target.value)} min="0" />
        </Field>
        <Field label="דקות לשלב">
          <input type="number" className={inp} value={form.level_duration} onChange={e => set('level_duration', e.target.value)} min="1" max="60" />
        </Field>
      </div>

      {/* Row 5: Recurring */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)}
            className="w-4 h-4 rounded accent-blue-500" />
          <span className="text-sm text-slate-300">חוזר שבועי</span>
        </label>
        {form.is_recurring && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">יום:</span>
            <select className={`${inp} w-32`} value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)}>
              <option value="">—</option>
              {DAYS_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Row 6: External URL */}
      <Field label="קישור הרשמה חיצוני">
        <input type="url" className={inp} placeholder="https://..." value={form.external_registration_url}
          onChange={e => set('external_registration_url', e.target.value)} dir="ltr" />
      </Field>

      {/* Row 7: Description */}
      <Field label="תיאור">
        <textarea className={`${inp} h-24 resize-y`} value={form.description} onChange={e => set('description', e.target.value)} />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 justify-start pt-1">
        <button type="submit" disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-black text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
          {saving ? 'שומר...' : '💾 שמור שינויים'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all">
          ביטול
        </button>
      </div>
    </form>
  );
}
