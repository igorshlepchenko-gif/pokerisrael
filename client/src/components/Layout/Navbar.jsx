import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🂡</span>
            <div className="leading-tight">
              <div className="font-black text-lg text-poker-green-light group-hover:text-poker-gold transition-colors">
                פוקר לייב ישראל
              </div>
              <div className="text-[10px] text-slate-400 tracking-wider">POKER LIVE ISRAEL</div>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-3">

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'עבור למצב יום' : 'עבור למצב לילה'}
              className={`
                flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-bold
                transition-all duration-300 hover:scale-105 active:scale-95 shadow-md
                ${isDark
                  ? 'bg-amber-400/15 border border-amber-400/50 text-amber-300 hover:bg-amber-400/25'
                  : 'bg-slate-700 border border-slate-500 text-slate-200 hover:bg-slate-600'}
              `}
            >
              <span className="text-base leading-none">{isDark ? '☀️' : '🌙'}</span>
              <span className="hidden sm:inline tracking-wide">{isDark ? 'מצב יום' : 'מצב לילה'}</span>
            </button>

            {user ? (
              <>
                {(user.role === 'venue_owner' || user.role === 'admin') && (
                  <Link to="/dashboard" className="btn-ghost text-sm hidden sm:inline-flex items-center gap-1">
                    🏠 ניהול
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin" className="btn-ghost text-sm hidden sm:inline-flex items-center gap-1 border-poker-gold text-poker-gold">
                    ⚙️ אדמין
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <div className="hidden sm:block text-right">
                    <div className="text-sm font-semibold text-slate-200">{user.name}</div>
                    <div className="text-xs text-slate-400">
                      {user.role === 'admin' ? '👑 מנהל' : user.role === 'venue_owner' ? '🏠 מועדון פוקר' : '🃏 שחקן'}
                    </div>
                  </div>
                  <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-red-400 transition-colors p-2">
                    יציאה
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">התחברות</Link>
                <Link to="/register" className="btn-primary text-sm">הרשמה</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
