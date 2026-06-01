import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import logoSvg from '../../assets/logo.svg';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md border-b shadow-2xl"
      style={{ background: 'rgba(6,9,26,0.95)', borderColor: 'rgba(29,78,216,0.2)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="shrink-0 group">
            <img src={logoSvg} alt="PokerIsrael.org" className="h-10 w-auto transition-opacity group-hover:opacity-90" />
          </Link>

          {/* Center nav links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/', label: 'בית' },
              { to: '/#tournaments', label: 'טורנירים' },
            ].map(({ to, label }) => (
              <Link key={label} to={to}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                  ${location.pathname === to
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                {label}
              </Link>
            ))}
            {user && (user.role === 'venue_owner' || user.role === 'admin') && (
              <Link to="/dashboard"
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                  ${location.pathname === '/dashboard'
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                ניהול
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin"
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                  ${location.pathname === '/admin'
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    : 'text-amber-400/70 hover:text-amber-400 hover:bg-white/5'}`}>
                ניהול מערכת
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggleTheme} title={isDark ? 'מצב יום' : 'מצב לילה'}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all text-base">
              {isDark ? '☀️' : '🌙'}
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-bold text-slate-200">{user.name}</div>
                  <div className="text-[11px] text-blue-400/70">
                    {user.role === 'admin' ? 'מנהל מערכת' : user.role === 'venue_owner' ? 'מועדון פוקר' : 'שחקן'}
                  </div>
                </div>
                <button onClick={handleLogout}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10">
                  יציאה
                </button>
              </div>
            ) : (
              <>
                <Link to="/login"
                  className="px-4 py-1.5 rounded-lg border text-sm font-semibold text-slate-300 hover:text-white transition-all"
                  style={{ borderColor: 'rgba(29,78,216,0.4)' }}>
                  התחבר
                </Link>
                <Link to="/register"
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 0 16px rgba(29,78,216,0.4)' }}>
                  הירשם
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
