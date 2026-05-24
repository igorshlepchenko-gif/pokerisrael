import { useState, useEffect } from 'react';
import api from '../utils/api';
import TournamentCard from '../components/Tournament/TournamentCard';
import TournamentListRow from '../components/Tournament/TournamentListRow';
import TournamentDetailModal from '../components/Tournament/TournamentDetailModal';
import { DAYS_HE } from '../utils/whatsapp';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [day, setDay] = useState('');
  const [cities, setCities] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('pli_view') || 'grid');
  const [sort, setSort] = useState('start_time');
  const [selectedTournament, setSelectedTournament] = useState(null);

  useEffect(() => { fetchTournaments(); }, [city, day, sort]);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const params = { sort };
      if (city) params.city = city;
      if (day !== '') params.day = day;
      if (search) params.search = search;
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
      <div className="relative overflow-hidden bg-gradient-to-b from-poker-felt-dark via-slate-900 to-transparent py-16 px-4 text-center">
        <div className="absolute inset-0 opacity-5 select-none pointer-events-none text-[200px] flex items-center justify-center gap-8 text-slate-300">
          ♠ ♥ ♦ ♣
        </div>
        <div className="relative">
          <div className="flex justify-center gap-3 text-4xl mb-4 animate-fade-in">
            <span>♠</span><span className="text-red-400">♥</span>
            <span className="text-red-400">♦</span><span>♣</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">
            פוקר לייב <span className="text-poker-green-light">ישראל</span>
          </h1>
          <p className="text-slate-400 text-lg mb-1">כל טורנירי הפוקר בישראל — במקום אחד</p>
          <p className="text-xs text-slate-500">טורנירים במרכזי משחקי קלפים מורשים בלבד</p>
        </div>
      </div>

      {/* Top ad banner — replace with actual ad code when ready */}
      {/* <div className="max-w-7xl mx-auto px-4 mb-6">...</div> */}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <form onSubmit={handleSearch} className="card p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-slate-400 mb-1">חיפוש</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="input-field text-sm" placeholder="שם טורניר, מקום..." />
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
          <button type="submit" className="btn-primary text-sm py-2 px-5 min-w-[90px]">🔍 חיפוש</button>
          {(search || city || day !== '') && (
            <button type="button" className="btn-ghost text-sm py-2 px-5 min-w-[90px]"
              onClick={() => { setSearch(''); setCity(''); setDay(''); fetchTournaments(); }}>
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
                    className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="start_time">קרוב ביותר</option>
                    <option value="venue_name">שם מקום א-ת</option>
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
                  <span>טורניר / מקום</span>
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
