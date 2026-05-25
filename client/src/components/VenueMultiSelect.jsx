import { useState, useEffect, useRef } from 'react';

export default function VenueMultiSelect({ venues, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // סגירה בלחיצה מחוץ לרכיב
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(v => v !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const label = selected.length === 0
    ? 'כל המועדונים'
    : selected.length === 1
      ? venues.find(v => v.id === selected[0])?.name || '1 מועדון'
      : `${selected.length} מועדונים`;

  return (
    <div className="relative min-w-[160px]" ref={ref}>
      <label className="block text-xs text-slate-400 mb-1">מועדון</label>

      {/* כפתור פתיחה */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`input-field text-sm w-full flex items-center justify-between gap-2 text-right transition-colors ${open ? 'border-poker-green/50' : ''}`}
      >
        <span className={selected.length > 0 ? 'text-slate-100 font-semibold' : 'text-slate-400'}>
          {label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              onClick={clearAll}
              className="text-slate-400 hover:text-white transition-colors text-xs px-1"
              title="נקה בחירה"
            >✕</span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 right-0 z-30 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
          {/* כותרת */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-xs text-slate-400 font-semibold">בחר מועדונים</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-slate-500 hover:text-white transition-colors"
              >
                נקה הכל
              </button>
            )}
          </div>

          {/* רשימה */}
          <ul className="max-h-64 overflow-y-auto py-1">
            {venues.length === 0 && (
              <li className="px-3 py-3 text-xs text-slate-500 text-center">אין מועדונים</li>
            )}
            {venues.map(venue => {
              const checked = selected.includes(venue.id);
              return (
                <li key={venue.id}>
                  <button
                    type="button"
                    onClick={() => toggle(venue.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-right hover:bg-slate-700/60 transition-colors ${checked ? 'bg-poker-green/10' : ''}`}
                  >
                    {/* Checkbox */}
                    <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-poker-green border-poker-green' : 'border-slate-500'}`}>
                      {checked && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-3 h-3">
                          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>

                    {/* לוגו */}
                    {venue.logo_url
                      ? <img src={venue.logo_url} alt={venue.name} className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-600" />
                      : <span className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-sm shrink-0">🏠</span>
                    }

                    {/* שם */}
                    <span className={`text-sm flex-1 text-right truncate ${checked ? 'text-white font-semibold' : 'text-slate-300'}`}>
                      {venue.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* footer: כמה נבחרו */}
          {selected.length > 0 && (
            <div className="border-t border-slate-700 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">{selected.length} מועדונים נבחרו</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs bg-poker-green text-white px-3 py-1 rounded-lg font-bold hover:bg-poker-green/80 transition-colors"
              >
                אישור
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
