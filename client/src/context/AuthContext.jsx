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
      .catch(() => localStorage.removeItem('pli_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('pli_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    // כשאימות מייל מופעל — השרת מחזיר { message } בלבד, ללא טוקן
    if (res.data.token) {
      localStorage.setItem('pli_token', res.data.token);
      setUser(res.data.user);
    }
    return res.data; // מחזיר { token, user } או { message }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* עדיין מנקה בצד לקוח */ }
    localStorage.removeItem('pli_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
