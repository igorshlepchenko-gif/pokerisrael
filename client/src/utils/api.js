import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pli_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 מנקודות קצה אחרות = סשן פג תוקף → redirect ללוגין
    // 401 מ-/auth/login = סיסמה/מייל שגויים → לטפל בטופס עצמו, לא לעשות redirect
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('pli_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
