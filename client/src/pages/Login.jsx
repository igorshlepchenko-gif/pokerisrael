import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאת התחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🂡</div>
          <h1 className="text-2xl font-black text-white">התחברות</h1>
          <p className="text-slate-400 text-sm mt-1">ברוך השב לפוקר לייב ישראל</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">כתובת מייל</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="input-field" placeholder="email@example.com" required dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">סיסמה</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input-field pl-10" placeholder="הסיסמה שלך" required dir="ltr" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3">{error}</p>}

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
