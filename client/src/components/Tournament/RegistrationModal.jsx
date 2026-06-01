import { useState, useEffect } from 'react';

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// מוצג רק כשהמשתמש אינו מחובר
export default function RegistrationModal({ tournament, onClose, onSubmit }) {
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');

  // סגירה ב-Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // מניעת גלילה ברקע
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), phone.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">

        {/* כותרת */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-black text-white text-lg">הרשמה לטורניר</h3>
            <p className="text-poker-green-light text-sm font-semibold truncate max-w-[220px]">{tournament.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-red-500/80 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">שם מלא *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field"
              placeholder="ישראל ישראלי"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">
              מספר טלפון <span className="text-slate-500 font-normal">(אופציונלי)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="input-field"
              placeholder="050-0000000"
              dir="ltr"
            />
          </div>

          <p className="text-xs text-slate-500 bg-slate-900/40 rounded-lg px-3 py-2">
            📋 הפרטים שלך יצורפו להודעת הוואטסאפ.
            <br />
            <span className="text-slate-600">רוצה שהפרטים יישמרו? <a href="/login" className="text-poker-green-light hover:underline">התחבר</a> או <a href="/register" className="text-poker-green-light hover:underline">הירשם</a> למערכת.</span>
          </p>

          <button
            type="submit"
            disabled={!name.trim()}
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 text-base shadow-lg"
          >
            <WaIcon />
            המשך להרשמה בוואטסאפ
          </button>
        </form>
      </div>
    </div>
  );
}
