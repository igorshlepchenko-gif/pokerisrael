import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState('loading'); // loading | success | error | expired
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('קישור אימות לא תקין.');
      return;
    }
    verifyToken(token);
  }, []);

  const verifyToken = async (token) => {
    try {
      const res = await api.get(`/auth/verify/${token}`);
      // כניסה אוטומטית
      localStorage.setItem('pli_token', res.data.token);
      setStatus('success');
      setMessage(res.data.message);
      // ניווט אחרי 2 שניות
      setTimeout(() => {
        window.location.href = res.data.user?.role === 'venue_owner' ? '/dashboard' : '/';
      }, 2500);
    } catch (err) {
      const data = err.response?.data;
      if (data?.expired) {
        setStatus('expired');
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data?.message || 'הקישור אינו תקין.');
      }
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      await api.post('/auth/resend-verification', { email });
      setResendMsg('מייל אימות נשלח מחדש ✅');
    } catch {
      setResendMsg('שגיאה בשליחה — נסה שוב');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">

          {/* Loading */}
          {status === 'loading' && (
            <>
              <div className="text-5xl mb-4 animate-pulse">🔐</div>
              <h2 className="text-xl font-black text-white mb-2">מאמת את הקישור...</h2>
              <p className="text-slate-400 text-sm">אנא המתן</p>
            </>
          )}

          {/* Success */}
          {status === 'success' && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-black text-white mb-3">המייל אומת בהצלחה!</h2>
              <p className="text-slate-400 mb-4">{message}</p>
              <p className="text-slate-500 text-sm">מועבר אוטומטית...</p>
              <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-poker-green rounded-full animate-[grow_2.5s_linear_forwards]" style={{width:'100%',animation:'width 2.5s linear'}}/>
              </div>
            </>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <>
              <div className="text-6xl mb-4">⏰</div>
              <h2 className="text-xl font-black text-white mb-3">הקישור פג תוקף</h2>
              <p className="text-slate-400 mb-5">{message}</p>
              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="הזן את כתובת המייל שלך"
                  className="input-field text-left"
                  dir="ltr"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !email}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {resendLoading ? 'שולח...' : '🔄 שלח קישור חדש'}
                </button>
                {resendMsg && (
                  <p className={`text-sm font-semibold ${resendMsg.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                    {resendMsg}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Error */}
          {status === 'error' && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-xl font-black text-white mb-3">אימות נכשל</h2>
              <p className="text-slate-400 mb-5">{message}</p>
              <p className="text-slate-500 text-sm">ייתכן שהחשבון כבר מאומת — נסה להתחבר.</p>
            </>
          )}

          <Link to="/login" className="text-slate-500 hover:text-slate-300 text-sm mt-6 block transition-colors">
            → עבור להתחברות
          </Link>
        </div>
      </div>
    </div>
  );
}
