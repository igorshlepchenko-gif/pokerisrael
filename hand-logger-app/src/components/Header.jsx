import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../client/src/context/AuthContext';
import { useTheme } from '../../../client/src/context/ThemeContext';
import logoSvg from '../../../client/src/assets/logo.svg';

export default function Header() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md border-b shadow-2xl"
      style={{ background: 'rgba(6,9,26,0.95)', borderColor: 'rgba(29,78,216,0.2)' }}>
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src={logoSvg} alt="PokerIsrael.org" className="h-9 w-auto" />
            <span className="text-sm font-black text-slate-200">רישום ידיים</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} title={isDark ? 'מצב יום' : 'מצב לילה'}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all text-base">
              {isDark ? '☀️' : '🌙'}
            </button>

            {user && (
              <>
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-bold text-slate-200">{user.name}</div>
                </div>
                <button onClick={handleLogout}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10">
                  יציאה
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
