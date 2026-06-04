import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import logoSvg from '../../assets/logo.svg';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); setMenuOpen(false); };
  const closeMenu = () => setMenuOpen(false);

  const navLinks = [
    { to: '/', label: 'בית', show: true },
    { to: '/hands', label: '🃏 הידיים שלי', show: !!user },
    { to: '/dashboard', label: 'ניהול', show: user && (user.role === 'venue_owner' || user.role === 'admin') },
    { to: '/admin', label: 'ניהול מערכת', show: user?.role === 'admin', amber: true },
  ].filter(l => l.show);

  const linkClass = (to, amber) => {
    const active = location.pathname === to;
    if (amber) return `px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${active ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-amber-400/70 hover:text-amber-400 hover:bg-white/5'}`;
    return `px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${active ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`;
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md border-b shadow-2xl"
      style={{ background: 'rgba(6,9,26,0.95)', borderColor: 'rgba(29,78,216,0.2)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" onClick={closeMenu} className="shrink-0 group">
            <img src={logoSvg} alt="PokerIsrael.org" className="h-10 w-auto transition-opacity group-hover:opacity-90" />
          </Link>

          {/* Center nav links — desktop only */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, amber }) => (
              <Link key={to} to={to} className={linkClass(to, amber)}>{label}</Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggleTheme} title={isDark ? 'מצב יום' : 'מצב לילה'}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all text-base">
              {isDark ? '☀️' : '🌙'}
            </button>

            {user ? (
              <>
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-bold text-slate-200">{user.name}</div>
                  <div className="text-[11px] text-blue-400/70">
                    {user.role === 'admin' ? 'מנהל מערכת' : user.role === 'venue_owner' ? 'מועדון פוקר' : 'שחקן'}
                  </div>
                </div>
                {/* Logout — desktop */}
                <button onClick={handleLogout}
                  className="hidden md:block text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10">
                  יציאה
                </button>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2">
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
              </div>
            )}

            {/* Hamburger button — mobile only */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
              aria-label="תפריט">
              <span className={`block w-5 h-0.5 bg-current transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-1"
          style={{ background: 'rgba(6,9,26,0.98)', borderColor: 'rgba(29,78,216,0.2)' }}>

          {/* Nav links */}
          {navLinks.map(({ to, label, amber }) => (
            <Link key={to} to={to} onClick={closeMenu} className={linkClass(to, amber) + ' text-right'}>
              {label}
            </Link>
          ))}

          <div className="border-t my-2" style={{ borderColor: 'rgba(29,78,216,0.15)' }} />

          {user ? (
            <>
              <div className="text-right px-2 py-1">
                <div className="text-sm font-bold text-slate-200">{user.name}</div>
                <div className="text-[11px] text-blue-400/70">
                  {user.role === 'admin' ? 'מנהל מערכת' : user.role === 'venue_owner' ? 'מועדון פוקר' : 'שחקן'}
                </div>
              </div>
              <button onClick={handleLogout}
                className="text-sm text-red-400/80 hover:text-red-400 text-right px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
                יציאה
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 mt-1">
              <Link to="/login" onClick={closeMenu}
                className="w-full text-center px-4 py-2 rounded-lg border text-sm font-semibold text-slate-300 hover:text-white transition-all"
                style={{ borderColor: 'rgba(29,78,216,0.4)' }}>
                התחבר
              </Link>
              <Link to="/register" onClick={closeMenu}
                className="w-full text-center px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 0 16px rgba(29,78,216,0.4)' }}>
                הירשם
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
