import { useState, useEffect } from 'react';
import api from '../utils/api';
import TournamentCard from '../components/Tournament/TournamentCard';
import TournamentListRow from '../components/Tournament/TournamentListRow';
import TournamentDetailModal from '../components/Tournament/TournamentDetailModal';
import VenueMultiSelect from '../components/VenueMultiSelect';
import { DAYS_HE } from '../utils/whatsapp';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tournamentType, setTournamentType] = useState('all');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [day, setDay] = useState('');
  const [gtdMin, setGtdMin] = useState('');
  const [cities, setCities] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('pli_view') || 'list');
  const [sort, setSort] = useState('start_time');
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [allVenues, setAllVenues] = useState([]);
  const [selectedVenues, setSelectedVenues] = useState([]);
  const [stats, setStats] = useState({ tournaments: null, venues: null, users: null });

  useEffect(() => {
    api.get('/tournaments/public-venues')
      .then(res => setAllVenues(res.data))
      .catch(() => {});
    api.get('/stats')
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchTournaments(); }, [tournamentType, city, day, sort, selectedVenues, gtdMin]);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const params = { sort };
      if (city) params.city = city;
      if (day !== '') params.day = day;
      if (search) params.search = search;
      if (selectedVenues.length > 0) params.venue_ids = selectedVenues.join(',');
      if (gtdMin) params.gtd_min = gtdMin;
      if (tournamentType !== 'all') params.tournament_type = tournamentType;
      const res = await api.get('/tournaments', { params });
      setTournaments(res.data);
      const uniqueCities = [...new Set(res.data.map(t => t.venue_city))].filter(Boolean);
      if (uniqueCities.length > 0) setCities(uniqueCities);
    } catch {
      // show empty
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => { e.preventDefault(); fetchTournaments(); };

  const switchView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('pli_view', mode);
  };

  return (
    <div className="min-h-screen">
      {/* Tournament detail modal */}
      {selectedTournament && (
        <TournamentDetailModal
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
        />
      )}
      {/* Hero */}
      <div className="hero-bg relative overflow-hidden py-20 px-4">
        {/* Animated background dots */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #1d4ed8, transparent)' }} />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, #22d3ee, transparent)' }} />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(96,165,250,1) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Tag line */}
          <div className="badge-cycle inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-black mb-6 tracking-wide"
            style={{ border: '1.5px solid' }}>
            ♠ כל הטורנירים בישראל
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 animate-slide-up">
            מצא את הטורניר
            <br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              הבא שלך
            </span>
          </h1>

          <p className="text-slate-400 text-lg mb-10">
            כל טורנירי הפוקר בישראל — במקום אחד
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-4 sm:gap-8 mb-10 flex-wrap">
            {[
              { icon: '🏆', value: stats.tournaments, label: 'טורנירים במערכת' },
              { icon: '📍', value: stats.venues,      label: 'מועדונים פעילים' },
              { icon: '👥', value: stats.users,       label: 'משתמשים' },
            ].map(s => (
              <div key={s.label} className="stat-card text-center min-w-[110px]">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-black text-white">
                  {s.value === null ? '...' : s.value.toLocaleString('he-IL')}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Type selector ── */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <div className="flex gap-3 justify-center flex-wrap">
          {[
            { key: 'all',    icon: '🌐', label: 'הכל',             desc: 'כל סוגי האירועים' },
            { key: 'live',   icon: '🏠', label: 'טורניר לייב',    desc: 'מפגשים פיזיים במועדונים' },
            { key: 'online', icon: '💻', label: 'טורניר אונליין',  desc: 'משחקים ברשת' },
            { key: 'cash',   icon: '🃏', label: 'קאש גיים',        desc: 'משחקי קאש פרטיים' },
          ].map(({ key, icon, label, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTournamentType(key); setSearch(''); setCity(''); setDay(''); setGtdMin(''); setSelectedVenues([]); }}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl border-2 font-bold text-sm transition-all duration-200 hover:scale-105 ${
                tournamentType === key
                  ? 'border-blue-500 bg-blue-600/20 text-white shadow-lg'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
              style={tournamentType === key ? { boxShadow: '0 0 20px rgba(29,78,216,0.35)' } : {}}
            >
              <span className="text-2xl">{icon}</span>
              <div className="text-right">
                <div>{label}</div>
                <div className="text-xs font-normal opacity-60">{desc}</div>
              </div>
              {tournamentType === key && <span className="text-blue-400 text-base mr-1">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <form onSubmit={handleSearch} className="card p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-slate-400 mb-1">חיפוש</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="input-field text-sm" placeholder="שם טורניר, מועדון..." />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-400 mb-1">עיר</label>
            <select value={city} onChange={e => setCity(e.target.value)} className="input-field text-sm">
              <option value="">כל הערים</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-400 mb-1">יום</label>
            <select value={day} onChange={e => setDay(e.target.value)} className="input-field text-sm">
              <option value="">כל הימים</option>
              {DAYS_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <VenueMultiSelect
            venues={allVenues}
            selected={selectedVenues}
            onChange={setSelectedVenues}
          />
          <div className="min-w-[130px]">
            <label className="block text-xs text-slate-400 mb-1">💰 GTD מינימום (₪)</label>
            <input type="number" value={gtdMin} onChange={e => setGtdMin(e.target.value)}
              className="input-field text-sm" placeholder="ללא הגבלה" min="0" />
          </div>
          <button type="submit" className="btn-primary text-sm py-2 px-5 min-w-[90px]">🔍 חיפוש</button>
          {(search || city || day !== '' || selectedVenues.length > 0 || gtdMin) && (
            <button type="button" className="btn-ghost text-sm py-2 px-5 min-w-[90px]"
              onClick={() => { setSearch(''); setCity(''); setDay(''); setSelectedVenues([]); setGtdMin(''); fetchTournaments(); }}>
              נקה
            </button>
          )}
        </form>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 animate-spin inline-block">🂡</div>
            <p className="text-slate-400">טוען טורנירים...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-20">🃏</div>
            <h3 className="text-xl font-semibold text-slate-400 mb-2">לא נמצאו טורנירים</h3>
            <p className="text-slate-500 text-sm">נסה לשנות את פרמטרי החיפוש</p>
          </div>
        ) : (
          <>
            {/* Toolbar: count + sort + view toggle */}
            <div className="flex items-center justify-between gap-3 mb-5 min-h-[36px]">
              <h2 className="text-lg font-bold text-slate-300 flex items-center">
                {tournaments.length} טורנירים נמצאו
              </h2>

              <div className="flex items-center gap-2">
                {/* Sort selector */}
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-slate-400">מיון:</span>
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    className="text-sm text-slate-200 outline-none cursor-pointer"
                    style={{ background: '#0d1526' }}
                  >
                    <option value="start_time"  style={{ background: '#0d1526', color: '#e2e8f0' }}>קרוב בזמן</option>
                    <option value="day"          style={{ background: '#0d1526', color: '#e2e8f0' }}>לפי יום בשבוע</option>
                    <option value="cost_asc"     style={{ background: '#0d1526', color: '#e2e8f0' }}>עלות: נמוך לגבוה</option>
                    <option value="cost_desc"    style={{ background: '#0d1526', color: '#e2e8f0' }}>עלות: גבוה לנמוך</option>
                    <option value="venue_name"   style={{ background: '#0d1526', color: '#e2e8f0' }}>שם מועדון א-ת</option>
                  </select>
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button onClick={() => switchView('grid')} title="תצוגת כרטיסים"
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'grid' ? 'bg-poker-green text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button onClick={() => switchView('list')} title="תצוגת רשימה"
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'list' ? 'bg-poker-green text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Grid view */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments.map((t, i) => (
                  <TournamentCard key={t.id} t={t} index={i} onClick={() => setSelectedTournament(t)} />
                ))}
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && (
              <div className="card overflow-hidden">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>טורניר / מועדון</span>
                  <span>כתובת</span>
                  <span>התחלה</span>
                  <span>עלות</span>
                  <span></span>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {tournaments.map((t, i) => (
                    <TournamentListRow key={t.id} t={t} index={i} onClick={() => setSelectedTournament(t)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
