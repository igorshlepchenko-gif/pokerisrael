import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../client/src/utils/api';

const englishOnly = (value) => value.replace(/[^\x20-\x7E]/g, '');

const ROLE_OPTIONS = [
  {
    value: 'player',
    icon: '🃏',
    title: 'שחקן',
    desc: 'צפייה והרשמה',
  },
  {
    value: 'venue_owner',
    icon: '🏠',
    title: 'מועדון פוקר',
    desc: 'מיועד לניהול מועדון וטורנירים בישראל',
  },
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successEmail, setSuccessEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const navigate = useNavigate();

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      return setError('סיסמה חייבת להיות לפחות 6 תווים');
    }
    if (form.password !== form.confirmPassword) {
      return setError('הסיסמאות אינן תואמות');
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', { ...form, role });

      if (res.data.token) {
        localStorage.setItem('pli_token', res.data.token);
        window.location.href = '/';
      } else {
        setSuccessEmail(form.email);
      }
    } catch (err) {
      const errs = err.response?.data?.errors;
      setError(errs ? errs[0].msg : err.response?.data?.message || 'שגיאת הרשמה');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendMsg('');
    try {
      await api.post('/auth/resend-verification', { email: successEmail });
      setResendMsg('מייל אימות נשלח מחדש ✅');
    } catch {
      setResendMsg('שגיאה בשליחה — נסה שוב');
    } finally {
      setResendLoading(false);
    }
  };

  const passwordStrength = (p) => {
    if (!p) return 0;
    let s = 1;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) || /[!@#$%^&*]/.test(p)) s++;
    if (p.length >= 10 && /[0-9]/.test(p)) s++;
    return Math.min(s, 4);
  };
  const strength = passwordStrength(form.password);
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-poker-green'];
  const strengthLabels = ['חלשה', 'בינונית', 'טובה', 'חזקה'];

  if (successEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="text-6xl mb-4">📧</div>
            <h2 className="text-2xl font-black text-white mb-3">בדוק את המייל שלך!</h2>
            <p className="text-slate-400 mb-2 leading-relaxed">
              שלחנו קישור אימות לכתובת:
            </p>
            <p className="text-poker-green-light font-bold text-lg mb-5 break-all">{successEmail}</p>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              לחץ על הקישור במייל כדי להפעיל את החשבון.<br/>
              הקישור תקף ל-24 שעות.
            </p>

            <div className="bg-slate-800/60 rounded-xl p-4 mb-6 text-right">
              <p className="text-slate-400 text-sm font-semibold mb-1">לא קיבלת מייל?</p>
              <p className="text-slate-500 text-xs">בדוק בתיקיית ספאם / קידומי מכירות</p>
            </div>

            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="btn-ghost w-full mb-3 disabled:opacity-50"
            >
              {resendLoading ? 'שולח...' : '🔄 שלח מייל אימות מחדש'}
            </button>

            {resendMsg && (
              <p className={`text-sm font-semibold ${resendMsg.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {resendMsg}
              </p>
            )}

            <button onClick={() => navigate('/login')} className="text-slate-500 hover:text-slate-300 text-sm mt-4 block mx-auto transition-colors">
              חזור לדף ההתחברות →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🂡</div>
          <h1 className="text-2xl font-black text-white">הרשמה לפוקר ישראל</h1>
          <p className="text-slate-400 text-sm mt-1">צעד {step} מתוך 2</p>
        </div>

        <div className="flex gap-2 mb-8">
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-poker-green' : 'bg-slate-700'}`} />
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-poker-green' : 'bg-slate-700'}`} />
        </div>

        <div className="card p-6">
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-bold text-slate-200 mb-1 text-center">איך תרצו להירשם?</h2>
              <p className="text-slate-400 text-sm text-center mb-5">בחר את סוג הפעילות המתאימה לך</p>

              <div className="space-y-3">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`w-full p-4 rounded-xl border-2 text-right transition-all duration-200 ${
                      role === opt.value
                        ? 'border-poker-green bg-poker-green/10'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{opt.icon}</span>
                      <div>
                        <div className="font-bold text-slate-200">{opt.title}</div>
                        <div className="text-xs text-slate-400">{opt.desc}</div>
                      </div>
                      {role === opt.value && <span className="mr-auto text-poker-green text-xl">✓</span>}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => role && setStep(2)}
                disabled={!role}
                className="btn-primary w-full mt-5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                המשך ←
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="animate-fade-in space-y-4">
              <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-slate-200 mb-2">← חזור</button>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">שם מלא *</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  className="input-field" placeholder="ישראל ישראלי" required autoComplete="name" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">כתובת מייל *</label>
                <input type="email" value={form.email}
                  onChange={e => set('email', englishOnly(e.target.value))}
                  onKeyDown={e => { if (/[^\x20-\x7E]/.test(e.key)) e.preventDefault(); }}
                  className="input-field" placeholder="email@example.com" required dir="ltr" autoComplete="email" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">מספר טלפון *</label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  className="input-field" placeholder="050-0000000" required dir="ltr" autoComplete="tel" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">סיסמה *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', englishOnly(e.target.value))}
                    onKeyDown={e => { if (/[^\x20-\x7E]/.test(e.key)) e.preventDefault(); }}
                    className="input-field pl-10" placeholder="לפחות 6 תווים" required dir="ltr" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < strength ? strengthColors[strength-1] : 'bg-slate-700'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">עוצמת סיסמה: <span className="font-semibold">{strengthLabels[strength-1] || ''}</span></p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">אימות סיסמה *</label>
                <input type="password" value={form.confirmPassword}
                  onChange={e => set('confirmPassword', englishOnly(e.target.value))}
                  onKeyDown={e => { if (/[^\x20-\x7E]/.test(e.key)) e.preventDefault(); }}
                  className={`input-field ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="הזן שוב את הסיסמה" required dir="ltr" autoComplete="new-password" />
              </div>

              {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'נרשם...' : '✅ הרשמה'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 text-sm mt-5">
          יש לך חשבון?{' '}
          <Link to="/login" className="text-poker-green-light hover:underline">התחבר</Link>
        </p>
      </div>
    </div>
  );
}
