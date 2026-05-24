import { useState } from 'react';
import api from '../../utils/api';
import { DAYS_HE } from '../../utils/whatsapp';

const BLIND_PRESETS = {
  hyper: {
    label: '⚡ Hyper',
    defaultDuration: 5,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 75,   big_blind: 150,  ante: 0   },
      { level: 4,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 5,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 6,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 7,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 8,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 9,  small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 10, small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 11, small_blind: 1000, big_blind: 2000, ante: 300 },
      { level: 12, small_blind: 1500, big_blind: 3000, ante: 400 },
    ],
  },
  turbo: {
    label: '🔥 Turbo',
    defaultDuration: 10,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 4,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 5,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 6,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 7,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 8,  small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 9,  small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 10, small_blind: 1000, big_blind: 2000, ante: 300 },
      { level: 11, small_blind: 1500, big_blind: 3000, ante: 400 },
      { level: 12, small_blind: 2000, big_blind: 4000, ante: 500 },
    ],
  },
  regular: {
    label: '🃏 Regular',
    defaultDuration: 20,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 75,   big_blind: 150,  ante: 0   },
      { level: 4,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 5,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 6,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 7,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 8,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 9,  small_blind: 500,  big_blind: 1000, ante: 100 },
      { level: 10, small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 11, small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 12, small_blind: 1000, big_blind: 2000, ante: 250 },
      { level: 13, small_blind: 1500, big_blind: 3000, ante: 300 },
      { level: 14, small_blind: 2000, big_blind: 4000, ante: 500 },
      { level: 15, small_blind: 3000, big_blind: 6000, ante: 600 },
    ],
  },
};

export default function TournamentForm({ venues, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    venue_id: '', name: '', description: '', cost: '',
    start_time: '', estimated_end_time: '',
    is_recurring: false, day_of_week: '',
    starting_stack: '',
    level_duration: '',
  });
  const [blinds, setBlinds] = useState([]);
  const [activePreset, setActivePreset] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const applyPreset = (key) => {
    setActivePreset(key);
    const dur = form.level_duration !== '' ? parseInt(form.level_duration) : BLIND_PRESETS[key].defaultDuration;
    setBlinds(BLIND_PRESETS[key].levels.map(r => ({ type: 'level', ...r, duration: dur })));
  };

  const updateBlindRow = (idx, field, value) => {
    setBlinds(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value === '' ? '' : Number(value) } : row));
    setActivePreset('');
  };

  const addBlindRow = () => {
    const lastLevel = [...blinds].reverse().find(r => r.type === 'level');
    const nextLevel = lastLevel ? lastLevel.level + 1 : 1;
    const nextSB    = lastLevel ? lastLevel.big_blind : 25;
    const nextBB    = nextSB * 2;
    const dur       = form.level_duration !== '' ? parseInt(form.level_duration) : (lastLevel?.duration ?? 20);
    setBlinds(prev => [...prev, { type: 'level', level: nextLevel, small_blind: nextSB, big_blind: nextBB, ante: lastLevel?.ante ?? 0, duration: dur }]);
    setActivePreset('');
  };

  const addBreakRow = () => {
    setBlinds(prev => [...prev, { type: 'break', duration: 15 }]);
    setActivePreset('');
  };

  const insertBreakAfter = (idx) => {
    setBlinds(prev => [
      ...prev.slice(0, idx + 1),
      { type: 'break', duration: 15 },
      ...prev.slice(idx + 1),
    ]);
    setActivePreset('');
  };

  const removeBlindRow = (idx) => {
    setBlinds(prev => prev.filter((_, i) => i !== idx));
    setActivePreset('');
  };

  const clearBlinds = () => { setBlinds([]); setActivePreset(''); };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // שמירת ערך הדרופדאון בלבד — ישמש כברירת מחדל לשורות חדשות בלבד
  const handleLevelDurationChange = (val) => {
    set('level_duration', val);
  };

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
        starting_stack: form.starting_stack !== '' ? parseInt(form.starting_stack) : null,
        level_duration: form.level_duration !== '' ? parseInt(form.level_duration) : null,
        stages: (() => {
          let n = 0;
          return blinds.map(r => r.type === 'break' ? r : { ...r, level: ++n });
        })(),
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

      {/* Starting stack */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">גובה ערימה התחלתית</label>
        <div className="relative">
          <input type="number" value={form.starting_stack} onChange={e => set('starting_stack', e.target.value)}
            className="input-field" placeholder="למשל: 20000" min="0" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">צ'יפס</span>
        </div>
      </div>

      {/* Level duration */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">זמן לשלב</label>
        <select value={form.level_duration} onChange={e => handleLevelDurationChange(e.target.value)}
          className="input-field">
          <option value="">— בחר זמן לשלב —</option>
          <option value="10">10 דקות</option>
          <option value="15">15 דקות</option>
          <option value="20">20 דקות</option>
          <option value="25">25 דקות</option>
          <option value="30">30 דקות</option>
          <option value="40">40 דקות</option>
          <option value="45">45 דקות</option>
          <option value="60">60 דקות</option>
        </select>
      </div>

      {/* Blind Structure */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-300">מבנה בליינדים</label>
          {blinds.length > 0 && (
            <button type="button" onClick={clearBlinds}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors">
              ✕ נקה טבלה
            </button>
          )}
        </div>

        {/* Preset buttons */}
        <div className="flex gap-2 mb-3">
          {Object.entries(BLIND_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                activePreset === key
                  ? 'bg-poker-green/20 border-poker-green text-poker-green-light'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {blinds.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-400">
                  <th className="py-2 px-2 text-center font-semibold w-9">#</th>
                  <th className="py-2 px-1 text-center font-semibold">סמול</th>
                  <th className="py-2 px-1 text-center font-semibold">ביג</th>
                  <th className="py-2 px-1 text-center font-semibold">אנטה</th>
                  <th className="py-2 px-1 text-center font-semibold">זמן</th>
                  <th className="py-2 px-1 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lvl = 0;
                  return blinds.flatMap((row, i) => {
                    const isBreak = row.type === 'break';
                    if (!isBreak) lvl++;
                    const displayLevel = isBreak ? null : lvl;

                    const mainRow = isBreak ? (
                      <tr key={`r${i}`} className="bg-amber-500/5 border-y border-amber-500/20">
                        <td className="py-1.5 px-2 text-center">
                          <span className="text-amber-400 text-[11px]">☕</span>
                        </td>
                        <td colSpan={3} className="py-1.5 px-1 text-center">
                          <span className="text-amber-400/80 text-[11px] font-semibold">הפסקה</span>
                        </td>
                        <td className="py-1 px-1">
                          <div className="flex items-center gap-1">
                            <input type="number" value={row.duration} min="1"
                              onChange={e => updateBlindRow(i, 'duration', e.target.value)}
                              className="w-full bg-transparent text-center text-slate-300 focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                            <span className="text-slate-500 text-[10px] shrink-0">דק׳</span>
                          </div>
                        </td>
                        <td className="py-1 px-1 text-center">
                          <button type="button" onClick={() => removeBlindRow(i)}
                            className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={`r${i}`} className="hover:bg-slate-700/20 transition-colors">
                        <td className="py-1.5 px-1 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-poker-green-light font-black text-[11px] select-none">
                            {displayLevel}
                          </span>
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" value={row.small_blind} min="0"
                            onChange={e => updateBlindRow(i, 'small_blind', e.target.value)}
                            className="w-full bg-transparent text-center text-poker-gold focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" value={row.big_blind} min="0"
                            onChange={e => updateBlindRow(i, 'big_blind', e.target.value)}
                            className="w-full bg-transparent text-center text-poker-gold focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" value={row.ante} min="0"
                            onChange={e => updateBlindRow(i, 'ante', e.target.value)}
                            className="w-full bg-transparent text-center text-slate-400 focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                        </td>
                        <td className="py-1 px-1">
                          <div className="flex items-center gap-1">
                            <input type="number" value={row.duration ?? ''} min="1"
                              onChange={e => updateBlindRow(i, 'duration', e.target.value)}
                              className="w-full bg-transparent text-center text-slate-300 focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                            <span className="text-slate-500 text-[10px] shrink-0">דק׳</span>
                          </div>
                        </td>
                        <td className="py-1 px-1 text-center">
                          <button type="button" onClick={() => removeBlindRow(i)}
                            className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                        </td>
                      </tr>
                    );

                    // Divider row between items (not after last)
                    const divider = i < blinds.length - 1 ? (
                      <tr key={`d${i}`} className="group/ins">
                        <td colSpan={6} className="p-0 h-0 relative">
                          <div className="h-px bg-slate-700/60 relative">
                            <button
                              type="button"
                              onClick={() => insertBreakAfter(i)}
                              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2
                                         opacity-0 group-hover/ins:opacity-100
                                         bg-slate-900 border border-dashed border-amber-500/60
                                         text-amber-400 text-[9px] px-2 py-0.5 rounded-full
                                         transition-opacity whitespace-nowrap z-10
                                         hover:bg-amber-500/10"
                            >
                              ☕ הוסף הפסקה כאן
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null;

                    return divider ? [mainRow, divider] : [mainRow];
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <button type="button" onClick={addBlindRow}
            className="flex-1 py-1.5 rounded-lg border border-dashed border-slate-600 text-slate-500 hover:border-poker-green hover:text-poker-green-light text-xs transition-all">
            + הוסף שלב
          </button>
          <button type="button" onClick={addBreakRow}
            className="flex-1 py-1.5 rounded-lg border border-dashed border-slate-600 text-slate-500 hover:border-amber-500 hover:text-amber-400 text-xs transition-all">
            ☕ הוסף הפסקה בסוף
          </button>
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
