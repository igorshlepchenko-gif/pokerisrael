import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // קוראים תמיד — מתחשב גם ב-httpOnly cookie (כניסה עם Google)
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch((err) => {
        // רק כשל 401 אמיתי מבטל את הטוקן — שגיאת רשת/שרת חולפת לא אמורה
        // לנתק משתמש שכבר מחובר כחוק
        if (err.response?.status === 401) localStorage.removeItem('pli_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('pli_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* עדיין מנקה בצד לקוח */ }
    localStorage.removeItem('pli_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
