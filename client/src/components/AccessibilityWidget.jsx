import { useState, useEffect } from 'react';

const DEFAULTS = { fontScale: 100, contrast: false, links: false, readable: false };

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('pli_a11y') || '{}') }; }
    catch { return DEFAULTS; }
  });

  // החלת ההגדרות על המסמך
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--a11y-font-scale', `${settings.fontScale}%`);
    document.body.classList.toggle('a11y-contrast', settings.contrast);
    document.body.classList.toggle('a11y-links', settings.links);
    document.body.classList.toggle('a11y-readable', settings.readable);
    localStorage.setItem('pli_a11y', JSON.stringify(settings));
  }, [settings]);

  const set = (patch) => setSettings(s => ({ ...s, ...patch }));
  const changeFont = (delta) =>
    set({ fontScale: Math.min(160, Math.max(80, settings.fontScale + delta)) });
  const reset = () => setSettings(DEFAULTS);

  return (
    <>
      {/* כפתור פתיחה */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="פתיחת תפריט נגישות"
        title="נגישות"
        className="fixed bottom-4 left-4 z-[70] w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-2xl flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{ boxShadow: '0 0 20px rgba(29,78,216,0.5)' }}
      >
        ♿
      </button>

      {/* פאנל */}
      {open && (
        <div className="fixed bottom-20 left-4 z-[70] w-64 rounded-2xl border shadow-2xl p-4 animate-slide-up" dir="rtl"
          style={{ background: 'rgba(13,21,38,0.98)', borderColor: 'rgba(29,78,216,0.4)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white text-sm">♿ נגישות</h3>
            <button onClick={() => setOpen(false)} aria-label="סגירה"
              className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
          </div>

          {/* גודל טקסט */}
          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1.5">גודל טקסט ({settings.fontScale}%)</label>
            <div className="flex gap-2">
              <button onClick={() => changeFont(-10)} className="a11y-btn">א−</button>
              <button onClick={() => changeFont(10)} className="a11y-btn">א+</button>
            </div>
          </div>

          {/* החלפות */}
          <div className="space-y-1.5">
            <Toggle label="ניגודיות גבוהה" active={settings.contrast} onClick={() => set({ contrast: !settings.contrast })} />
            <Toggle label="הדגשת קישורים" active={settings.links} onClick={() => set({ links: !settings.links })} />
            <Toggle label="גופן קריא" active={settings.readable} onClick={() => set({ readable: !settings.readable })} />
          </div>

          <button onClick={reset}
            className="w-full mt-3 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 rounded-lg py-1.5 transition-colors">
            ↺ איפוס הגדרות
          </button>

          <a href="/accessibility" className="block text-center text-[11px] text-blue-400 hover:underline mt-2">
            הצהרת נגישות מלאה
          </a>
        </div>
      )}
    </>
  );
}

function Toggle({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
        active ? 'bg-blue-600/25 text-white border border-blue-500/50' : 'bg-slate-800/60 text-slate-300 border border-slate-700 hover:border-slate-500'
      }`}>
      <span>{label}</span>
      <span className={`text-xs ${active ? 'text-blue-300' : 'text-slate-500'}`}>{active ? 'פעיל ✓' : 'כבוי'}</span>
    </button>
  );
}
