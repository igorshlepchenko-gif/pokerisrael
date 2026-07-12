import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// מסנן תווים שאינם ASCII (מונע הקלדה בעברית ובכל שפה אחרת)
const englishOnly = (value) => value.replace(/[^\x20-\x7E]/g, '');

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail('');
    setResendMsg('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.unverified) {
        setUnverifiedEmail(data.email || form.email);
      } else {
        setError(data?.message || 'שגיאת התחברות');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendMsg('');
    try {
      await api.post('/auth/resend-verification', { email: unverifiedEmail });
      setResendMsg('מייל אימות נשלח מחדש ✅');
    } catch {
      setResendMsg('שגיאה בשליחה — נסה שוב');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🂡</div>
          <h1 className="text-2xl font-black text-white">התחברות</h1>
          <p className="text-slate-400 text-sm mt-1">ברוך השב לפוקר ישראל</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">כתובת מייל</label>
              <input type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: englishOnly(e.target.value) }))}
                onKeyDown={e => { if (/[^\x20-\x7E]/.test(e.key)) e.preventDefault(); }}
                className="input-field" placeholder="email@example.com" required dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">סיסמה</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: englishOnly(e.target.value) }))}
                  onKeyDown={e => { if (/[^\x20-\x7E]/.test(e.key)) e.preventDefault(); }}
                  className="input-field pl-10" placeholder="הסיסמה שלך" required dir="ltr" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3">{error}</p>}

            {/* מייל לא מאומת */}
            {unverifiedEmail && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 text-right">
                <p className="text-amber-300 text-sm font-semibold mb-1">📧 יש לאמת את כתובת המייל תחילה</p>
                <p className="text-amber-400/70 text-xs mb-3">בדוק את תיבת הדואר של <span className="font-bold">{unverifiedEmail}</span></p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 disabled:opacity-50 transition-colors"
                >
                  {resendLoading ? 'שולח...' : '🔄 שלח מייל אימות מחדש'}
                </button>
                {resendMsg && (
                  <p className={`text-xs mt-2 font-semibold ${resendMsg.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                    {resendMsg}
                  </p>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'מתחבר...' : '🂡 כניסה'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500 font-semibold">או</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-2 w-full bg-white hover:bg-slate-100 text-slate-800 font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 text-sm shadow-lg"
          >
            <GoogleIcon />
            המשך עם Google
          </a>
        </div>

        <p className="text-center text-slate-400 text-sm mt-5">
          אין לך חשבון?{' '}
          <Link to="/register" className="text-poker-green-light hover:underline">הרשמה חינם</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
