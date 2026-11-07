import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../client/src/context/AuthContext';
import api from '../../../client/src/utils/api';

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
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const sessionMessage = searchParams.get('sessionMessage');
    const errorMessage = searchParams.get('error');
    if (sessionMessage) {
      setError(sessionMessage);
      setSearchParams({}, { replace: true });
    } else if (errorMessage) {
      setError(errorMessage);
      setSearchParams({}, { replace: true });
    }
  }, []);

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
                className="input-field" placeholder="email@example.com" required dir="ltr" autoComplete="email" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">סיסמה</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: englishOnly(e.target.value) }))}
                  onKeyDown={e => { if (/[^\x20-\x7E]/.test(e.key)) e.preventDefault(); }}
                  className="input-field pl-10" placeholder="הסיסמה שלך" required dir="ltr" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3">{error}</p>}

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
        </div>

        <p className="text-center text-slate-400 text-sm mt-5">
          אין לך חשבון?{' '}
          <Link to="/register" className="text-poker-green-light hover:underline">הרשמה חינם</Link>
        </p>
      </div>
    </div>
  );
}
