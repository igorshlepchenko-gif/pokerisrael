import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { DAYS_HE } from '../../utils/whatsapp';
import clubggLogo from '../../assets/clubgg-logo.png';
import pokerrrr2Logo from '../../assets/pokerrrr2.png';
import pppokerLogo from '../../assets/pppoker.png';
import upokerLogo from '../../assets/upoker.png';

// ── לוגואי פלטפורמות אונליין (SVG מובנה) ─────────────────────────
const ONLINE_PLATFORMS = [
  {
    id: 'ClubGG',
    name: 'ClubGG',
    logo: (
      <img src={clubggLogo} alt="ClubGG" width="40" height="40"
        className="rounded-[10px] object-cover bg-black" />
    ),
  },
  {
    id: 'Pokerrrr2',
    name: 'Pokerrrr 2',
    logo: (
      <img src={pokerrrr2Logo} alt="Pokerrrr 2" width="40" height="40"
        className="rounded-[10px] object-cover" />
    ),
  },
  {
    id: 'PPPoker',
    name: 'PPPoker',
    logo: (
      <img src={pppokerLogo} alt="PPPoker" width="40" height="40"
        className="rounded-[10px] object-cover" />
    ),
  },
  {
    id: 'UPoker',
    name: 'UPoker',
    logo: (
      <img src={upokerLogo} alt="UPoker" width="40" height="40"
        className="rounded-[10px] object-cover" />
    ),
  },
];

const BLIND_PRESETS = {
  hyper: {
    label: '⚡ Hyper',
    defaultDuration: 5,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 75,   big_blind: 150,  ante: 0   },
      { level: 4,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 5,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 6,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 7,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 8,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 9,  small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 10, small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 11, small_blind: 1000, big_blind: 2000, ante: 300 },
      { level: 12, small_blind: 1500, big_blind: 3000, ante: 400 },
    ],
  },
  turbo: {
    label: '🔥 Turbo',
    defaultDuration: 10,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 4,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 5,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 6,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 7,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 8,  small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 9,  small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 10, small_blind: 1000, big_blind: 2000, ante: 300 },
      { level: 11, small_blind: 1500, big_blind: 3000, ante: 400 },
      { level: 12, small_blind: 2000, big_blind: 4000, ante: 500 },
    ],
  },
  regular: {
    label: '🃏 Regular',
    defaultDuration: 20,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 75,   big_blind: 150,  ante: 0   },
      { level: 4,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 5,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 6,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 7,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 8,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 9,  small_blind: 500,  big_blind: 1000, ante: 100 },
      { level: 10, small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 11, small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 12, small_blind: 1000, big_blind: 2000, ante: 250 },
      { level: 13, small_blind: 1500, big_blind: 3000, ante: 300 },
      { level: 14, small_blind: 2000, big_blind: 4000, ante: 500 },
      { level: 15, small_blind: 3000, big_blind: 6000, ante: 600 },
    ],
  },
};

// תרגום שמות שדות לעברית להצגת שגיאות ולידציה
const FIELD_LABELS = {
  name:                'שם הטורניר',
  cost:                'עלות',
  start_time:          'שעת התחלה',
  estimated_end_time:  'שעת סיום משוערת',
  venue_id:            'מועדון',
  day_of_week:         'יום בשבוע',
  starting_stack:      'ערימה התחלתית',
  level_duration:      'זמן לשלב',
  re_entry:            'Re-Entry',
  late_reg_level:      'Late Reg',
  description:         'תיאור',
};

// המרת timestamp ל-datetime-local (שומרת שעה מקומית)
function toLocalDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseStages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export default function TournamentForm({ venues, tournament = null, onSuccess, onCancel }) {
  const isEdit = !!tournament;

  const [tournamentType, setTournamentType] = useState(tournament?.tournament_type ?? 'live');
  const [onlineSubType, setOnlineSubType] = useState('tournament'); // 'tournament' | 'cash'

  const [form, setForm] = useState({
    venue_id:            tournament?.venue_id       ?? '',
    name:                tournament?.name            ?? '',
    description:         tournament?.description     ?? '',
    cost:                tournament?.cost            ?? '',
    start_time:          toLocalDT(tournament?.start_time),
    estimated_end_time:  toLocalDT(tournament?.estimated_end_time),
    is_recurring:        tournament?.is_recurring    ?? false,
    day_of_week:         tournament?.day_of_week     ?? '',
    starting_stack:      tournament?.starting_stack  ?? '',
    level_duration:      tournament?.level_duration  ?? '',
    re_entry:            tournament?.re_entry        ?? '',
    late_reg_level:      tournament?.late_reg_level  ?? '',
    gtd:                 tournament?.gtd             ?? '',
    rake:                tournament?.rake            ?? '',
    rake_type:           tournament?.rake_type       ?? 'amount',
    platform:            tournament?.platform        ?? '',
  });

  // ── משחקי קאש: בחירה מרובה + ראשי/משני ─────────────────────────
  const CASH_GAMES = ['NLH', 'PLO', 'PLO5', 'PLO6'];
  const initGames = () => {
    const primary = tournament?.game_type || 'NLH';
    let sec = tournament?.secondary_games;
    if (typeof sec === 'string') { try { sec = JSON.parse(sec || '[]'); } catch { sec = []; } }
    if (!Array.isArray(sec)) sec = [];
    const selected = [...new Set([primary, ...sec.map(s => s.game)])];
    const hands = {};
    sec.forEach(s => { hands[s.game] = s.hands; });
    return { selected, primary, hands };
  };
  const [selectedGames, setSelectedGames] = useState(() => initGames().selected);
  const [primaryGame, setPrimaryGame]     = useState(() => initGames().primary);
  const [secondaryHands, setSecondaryHands] = useState(() => initGames().hands);

  const toggleGame = (g) => {
    setSelectedGames(prev => {
      if (prev.includes(g)) {
        const next = prev.filter(x => x !== g);
        // אם הסרנו את הראשי — נבחר ראשי חדש
        if (primaryGame === g && next.length > 0) setPrimaryGame(next[0]);
        return next;
      }
      return [...prev, g];
    });
  };
  const PRESET_DURATIONS = ['10','15','20','25','30','40','45','60'];

  const [blinds, setBlinds] = useState(() => parseStages(tournament?.stages));
  const [activePreset, setActivePreset] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // מצב ידני לזמן לשלב — פעיל אם הערך הקיים אינו בין ברירות המחדל
  const [customDuration, setCustomDuration] = useState(
    () => tournament?.level_duration != null && !PRESET_DURATIONS.includes(String(tournament.level_duration))
  );

  // ── תבניות שמורות ──────────────────────────────────────────────
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const templatesRef = useRef(null);

  useEffect(() => {
    api.get('/blind-templates').then(r => setTemplates(r.data)).catch(() => {});
  }, []);

  // סגירת dropdown בלחיצה מחוץ
  useEffect(() => {
    if (!showTemplates) return;
    const handler = (e) => {
      if (templatesRef.current && !templatesRef.current.contains(e.target))
        setShowTemplates(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplates]);

  const loadTemplate = (tpl) => {
    setBlinds(parseStages(tpl.stages));
    setActivePreset('');
    setShowTemplates(false);
  };

  const deleteTemplate = async (id, e) => {
    e.stopPropagation();
    if (!confirm('למחוק תבנית זו?')) return;
    await api.delete(`/blind-templates/${id}`);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return;
    setSaveLoading(true);
    setSaveMsg('');
    try {
      const res = await api.post('/blind-templates', { name: saveName.trim(), stages: blinds });
      setTemplates(prev => [res.data, ...prev]);
      setSaveName('');
      setSaveMode(false);
      setSaveMsg('✓ נשמר בהצלחה');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg(err.response?.data?.message || 'שגיאה בשמירה');
    } finally {
      setSaveLoading(false);
    }
  };

  const applyPreset = (key) => {
    setActivePreset(key);
    const dur = form.level_duration !== '' ? parseInt(form.level_duration) : BLIND_PRESETS[key].defaultDuration;
    setBlinds(BLIND_PRESETS[key].levels.map(r => ({ type: 'level', ...r, duration: dur })));
  };

  const updateBlindRow = (idx, field, value) => {
    setBlinds(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value === '' ? '' : Number(value) } : row));
    setActivePreset('');
  };

  const addBlindRow = () => {
    const lastLevel = [...blinds].reverse().find(r => r.type === 'level');
    const nextLevel = lastLevel ? lastLevel.level + 1 : 1;
    const nextSB    = lastLevel ? lastLevel.big_blind : 25;
    const nextBB    = nextSB * 2;
    const dur       = form.level_duration !== '' ? parseInt(form.level_duration) : (lastLevel?.duration ?? 20);
    setBlinds(prev => [...prev, { type: 'level', level: nextLevel, small_blind: nextSB, big_blind: nextBB, ante: lastLevel?.ante ?? 0, duration: dur }]);
    setActivePreset('');
  };

  const addBreakRow = () => {
    setBlinds(prev => [...prev, { type: 'break', duration: 15 }]);
    setActivePreset('');
  };

  const insertBreakAfter = (idx) => {
    setBlinds(prev => [
      ...prev.slice(0, idx + 1),
      { type: 'break', duration: 15 },
      ...prev.slice(idx + 1),
    ]);
    setActivePreset('');
  };

  const removeBlindRow = (idx) => {
    setBlinds(prev => prev.filter((_, i) => i !== idx));
    setActivePreset('');
  };

  const clearBlinds = () => { setBlinds([]); setActivePreset(''); };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // שמירת ערך הדרופדאון בלבד — ישמש כברירת מחדל לשורות חדשות בלבד
  const handleLevelDurationChange = (val) => {
    set('level_duration', val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        venue_id:           parseInt(form.venue_id),
        cost:               parseFloat(form.cost),
        estimated_end_time: form.estimated_end_time || null,
        day_of_week:        form.day_of_week !== '' ? parseInt(form.day_of_week) : null,
        starting_stack:     form.starting_stack !== '' ? parseInt(form.starting_stack) : null,
        level_duration:     form.level_duration !== '' ? parseInt(form.level_duration) : null,
        re_entry:           form.re_entry || null,
        late_reg_level:     form.late_reg_level !== '' ? parseInt(form.late_reg_level) : null,
        gtd:                form.gtd !== '' ? parseInt(form.gtd) : null,
        tournament_type:    tournamentType,
        venue_id:           tournamentType === 'live' ? parseInt(form.venue_id) : null,
        // משחקי קאש: ראשי + משניים עם ידיים בסיבוב
        game_type:          showGameType ? primaryGame : null,
        secondary_games:    showGameType
          ? selectedGames
              .filter(g => g !== primaryGame)
              .map(g => ({ game: g, hands: parseInt(secondaryHands[g]) || 1 }))
          : [],
        stages: (() => {
          let n = 0;
          return blinds.map(r => r.type === 'break' ? r : { ...r, level: ++n });
        })(),
      };

      // ולידציה למשחקי קאש
      if (showGameType && selectedGames.length === 0) {
        setError('• יש לבחור לפחות סוג משחק אחד');
        setLoading(false);
        return;
      }
      if (isEdit) {
        await api.put(`/tournaments/${tournament.id}`, payload);
      } else {
        await api.post('/tournaments', payload);
      }
      onSuccess();
    } catch (err) {
      const d = err.response?.data;
      if (d?.errors?.length > 0) {
        const lines = d.errors.map(e => {
          const label = FIELD_LABELS[e.path] || e.path || 'שדה לא ידוע';
          return `• ${label}: ${e.msg}`;
        });
        setError(lines.join('\n'));
      } else {
        setError(d?.message || 'שגיאה בשמירת הטורניר');
      }
    } finally {
      setLoading(false);
    }
  };

  const isLive        = tournamentType === 'live';
  const isOnline      = tournamentType === 'online';
  const isCash        = tournamentType === 'cash';
  const isOnlineCash  = isOnline && onlineSubType === 'cash';
  const isTournament  = isLive || (isOnline && onlineSubType === 'tournament');
  // שדות ספציפיים לסוג
  const showBlinds    = isTournament;          // מבנה בליינדים + Re-Entry + Late Reg
  const showGTD       = isTournament;          // GTD
  const showGameType  = isCash || isOnlineCash; // סוג משחק
  const showRake      = !isCash;               // Rake — לא לקאש פיזי

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── סוג האירוע ── */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">סוג האירוע *</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'live',   icon: '🏠', label: 'טורניר לייב', sub: 'פיזי במועדון' },
              { key: 'online', icon: '💻', label: 'אונליין', sub: 'ברשת' },
              { key: 'cash',   icon: '🃏', label: 'קאש גיים', sub: 'משחק פרטי' },
            ].map(({ key, icon, label, sub }) => (
              <button key={key} type="button"
                onClick={() => setTournamentType(key)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  tournamentType === key
                    ? 'border-blue-500 bg-blue-600/20 text-white'
                    : 'border-slate-600 bg-slate-800/40 text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-sm font-bold">{label}</div>
                <div className="text-[11px] opacity-60">{sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* מועדון — רק ללייב */}
        {isLive && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-300 mb-1">מועדון *</label>
            {isEdit ? (
              <div className="input-field bg-slate-700/40 text-slate-400 cursor-not-allowed">
                {venues.find(v => v.id === form.venue_id)?.name || tournament.venue_name}
                <span className="text-xs text-slate-500 mr-2">(לא ניתן לשינוי)</span>
              </div>
            ) : (
              <>
                <select value={form.venue_id} onChange={e => set('venue_id', e.target.value)}
                  className="input-field" required>
                  <option value="">בחר מועדון...</option>
                  {venues.filter(v => v.is_approved).map(v => (
                    <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                  ))}
                </select>
                {venues.filter(v => !v.is_approved).length > 0 && (
                  <p className="text-xs text-amber-400 mt-1">יש לך מועדונים ממתינים לאישור</p>
                )}
              </>
            )}
          </div>
        )}

        {/* סוג משנה לאונליין */}
        {isOnline && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-300 mb-2">סוג</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'tournament', icon: '🏆', label: 'טורניר', sub: 'טורניר עם מבנה בליינדים' },
                { val: 'cash',       icon: '💵', label: 'קאש',    sub: 'שולחן קאש מתמשך' },
              ].map(({ val, icon, label, sub }) => (
                <button key={val} type="button"
                  onClick={() => setOnlineSubType(val)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    onlineSubType === val
                      ? 'border-blue-500 bg-blue-600/20 text-white'
                      : 'border-slate-600 bg-slate-800/40 text-slate-400 hover:border-slate-500'
                  }`}>
                  <div className="text-xl mb-0.5">{icon}</div>
                  <div className="text-sm font-bold">{label}</div>
                  <div className="text-[11px] opacity-60">{sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* פלטפורמה — לאונליין */}
        {isOnline && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-300 mb-2">💻 פלטפורמה *</label>
            <div className="grid grid-cols-2 gap-2">
              {ONLINE_PLATFORMS.map(({ id, name, logo }) => (
                <button key={id} type="button"
                  onClick={() => set('platform', id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all ${
                    form.platform === id
                      ? 'border-blue-500 bg-blue-600/15'
                      : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
                  }`}>
                  <div className="shrink-0">{logo}</div>
                  <span className={`text-sm font-bold ${form.platform === id ? 'text-white' : 'text-slate-300'}`}>{name}</span>
                  {form.platform === id && <span className="text-blue-400 mr-auto">✓</span>}
                </button>
              ))}
            </div>
            {!form.platform && <p className="text-xs text-red-400 mt-1">יש לבחור פלטפורמה</p>}
          </div>
        )}

        {/* מיקום / מארגן — לקאש פיזי */}
        {isCash && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-300 mb-1">📍 מיקום / מארגן</label>
            <input type="text" value={form.platform} onChange={e => set('platform', e.target.value)}
              className="input-field" placeholder="למשל: דירה פרטית, מועדון X..." />
          </div>
        )}

        {/* סוג משחק — קאש פיזי או אונליין קאש: בחירה מרובה + ראשי/משני */}
        {showGameType && (
          <div className="sm:col-span-2 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                🃏 סוג משחק <span className="text-xs text-slate-500 font-normal">(ניתן לבחור כמה)</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {CASH_GAMES.map(g => (
                  <button key={g} type="button"
                    onClick={() => toggleGame(g)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-all ${
                      selectedGames.includes(g)
                        ? 'border-blue-500 bg-blue-600/25 text-white'
                        : 'border-slate-600 text-slate-400 hover:border-slate-400'
                    }`}>
                    {selectedGames.includes(g) && '✓ '}{g}
                  </button>
                ))}
              </div>
            </div>

            {/* כשנבחרו 2+ משחקים — בחירת ראשי + ידיים למשניים */}
            {selectedGames.length >= 2 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">המשחק הראשי</label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedGames.map(g => (
                      <button key={g} type="button"
                        onClick={() => setPrimaryGame(g)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                          primaryGame === g
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-slate-600 text-slate-400 hover:border-slate-400'
                        }`}>
                        {primaryGame === g && '⭐ '}{g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* משחקים משניים — ידיים בסיבוב */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">משחקים משניים — ידיים בסיבוב</label>
                  <div className="space-y-2">
                    {selectedGames.filter(g => g !== primaryGame).map(g => (
                      <div key={g} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-300 w-16">{g}</span>
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" max="20"
                            value={secondaryHands[g] ?? 1}
                            onChange={e => setSecondaryHands(prev => ({ ...prev, [g]: e.target.value }))}
                            className="input-field py-1 w-20 text-center text-sm" />
                          <span className="text-xs text-slate-500">ידיים בסיבוב</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    💡 לדוגמה: {primaryGame} כמשחק ראשי, ו{selectedGames.filter(g => g !== primaryGame)[0] || 'PLO5'} פעמיים בסיבוב
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-300 mb-1">
            {showGameType ? 'שם המשחק *' : 'שם הטורניר *'}
          </label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className="input-field"
            placeholder={showGameType ? 'למשל: קאש ראשון שישי' : isOnline ? 'למשל: Sunday Million' : 'למשל: טורניר שבועי'}
            required />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">
            {isCash ? 'Big Blind (₪)' : 'עלות (₪) *'}
          </label>
          <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)}
            className="input-field" placeholder="0" min="0" required />
        </div>

        {/* RAKE — רק ללייב ואונליין (לא לקאש פיזי) */}
        {showRake && (
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">RAKE</label>
            <div className="flex gap-2">
              {/* Toggle ₪ / % */}
              <div className="flex rounded-xl overflow-hidden border border-slate-600 shrink-0">
                {[
                  { val: 'amount',  label: '₪' },
                  { val: 'percent', label: '%' },
                ].map(({ val, label }) => (
                  <button key={val} type="button"
                    onClick={() => set('rake_type', val)}
                    className={`px-3 py-2 text-sm font-bold transition-all ${
                      form.rake_type === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}>{label}</button>
                ))}
              </div>
              <div className="relative flex-1">
                <input
                  type="number"
                  value={form.rake}
                  onChange={e => set('rake', e.target.value)}
                  className="input-field pl-10"
                  placeholder={form.rake_type === 'percent' ? 'למשל: 10' : 'למשל: 30'}
                  min="0"
                  max={form.rake_type === 'percent' ? 100 : undefined}
                  step={form.rake_type === 'percent' ? 0.5 : 1}
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
                  {form.rake_type === 'percent' ? '%' : '₪'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">שעת התחלה *</label>
          <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)}
            className="input-field" required />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">שעת סיום משוערת</label>
          <input type="datetime-local" value={form.estimated_end_time} onChange={e => set('estimated_end_time', e.target.value)}
            className="input-field" />
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)}
            className="w-4 h-4 accent-poker-green" />
          <label htmlFor="recurring" className="text-sm font-semibold text-slate-300">
            {showGameType ? 'משחק שבועי קבוע' : 'טורניר שבועי חוזר'}
          </label>
        </div>

        {form.is_recurring && (
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">יום בשבוע</label>
            <select value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)} className="input-field">
              <option value="">בחר יום...</option>
              {DAYS_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* GTD — רק לטורנירים */}
      {showGTD && <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">
          💰 פרסים מובטחים GTD
          <span className="text-xs text-slate-500 font-normal mr-2">(אופציונלי)</span>
        </label>
        <div className="relative">
          <input type="number" value={form.gtd} onChange={e => set('gtd', e.target.value)}
            className="input-field pl-12" placeholder="למשל: 15000" min="0" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">₪</span>
        </div>
      </div>}

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">
          {showGameType ? 'הערות' : 'תיאור הטורניר'}
        </label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          className="input-field resize-none" rows={3} placeholder="מידע כללי, פרייז פול, מבנה..." />
      </div>

      {/* Starting stack — רק לטורנירים */}
      {showBlinds && <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">גובה ערימה התחלתית</label>
        <div className="relative">
          <input type="number" value={form.starting_stack} onChange={e => set('starting_stack', e.target.value)}
            className="input-field" placeholder="למשל: 20000" min="0" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">צ'יפס</span>
        </div>
      </div>}

      {/* Level duration — רק לטורנירים */}
      {showBlinds && <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">זמן לשלב</label>
        {!customDuration ? (
          <select
            value={form.level_duration}
            onChange={e => {
              if (e.target.value === 'custom') {
                setCustomDuration(true);
                set('level_duration', '');
              } else {
                handleLevelDurationChange(e.target.value);
              }
            }}
            className="input-field"
          >
            <option value="">— בחר זמן לשלב —</option>
            <option value="10">10 דקות</option>
            <option value="15">15 דקות</option>
            <option value="20">20 דקות</option>
            <option value="25">25 דקות</option>
            <option value="30">30 דקות</option>
            <option value="40">40 דקות</option>
            <option value="45">45 דקות</option>
            <option value="60">60 דקות</option>
            <option value="custom">✏️ הזן ידנית...</option>
          </select>
        ) : (
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                type="number"
                value={form.level_duration}
                onChange={e => handleLevelDurationChange(e.target.value)}
                className="input-field pl-14"
                placeholder="הזן דקות"
                min="1"
                max="180"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">דקות</span>
            </div>
            <button
              type="button"
              onClick={() => { setCustomDuration(false); set('level_duration', ''); }}
              className="text-xs text-slate-500 hover:text-slate-300 border border-slate-600 hover:border-slate-500 px-3 py-2 rounded-lg transition-colors shrink-0"
            >
              חזור לרשימה
            </button>
          </div>
        )}
      </div>}

      {/* Blind Structure — רק לטורנירים */}
      {showBlinds && <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <label className="text-sm font-semibold text-slate-300">מבנה בליינדים</label>
          <div className="flex items-center gap-2">
            {/* כפתור שמירה */}
            {blinds.length > 0 && !saveMode && (
              <button type="button" onClick={() => { setSaveMode(true); setSaveMsg(''); }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-poker-green-light border border-slate-600 hover:border-poker-green/50 px-2 py-1 rounded-lg transition-all">
                💾 שמור מבנה
              </button>
            )}
            {/* dropdown תבניות שמורות */}
            {templates.length > 0 && (
              <div className="relative" ref={templatesRef}>
                <button type="button"
                  onClick={() => setShowTemplates(p => !p)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 border border-slate-600 hover:border-amber-500/50 px-2 py-1 rounded-lg transition-all">
                  📂 מבנים שמורים ({templates.length})
                </button>
                {showTemplates && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl min-w-[220px] overflow-hidden">
                    <div className="px-3 py-2 text-[11px] text-slate-500 border-b border-slate-700">לחץ על מבנה לטעינה</div>
                    {templates.map(tpl => (
                      <div key={tpl.id}
                        onClick={() => loadTemplate(tpl)}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-700/60 cursor-pointer group transition-colors">
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{tpl.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {tpl.stages.filter(s => s.type !== 'break').length} שלבים
                          </div>
                        </div>
                        <button type="button"
                          onClick={(e) => deleteTemplate(tpl.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xs px-1">
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {blinds.length > 0 && (
              <button type="button" onClick={clearBlinds}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                ✕ נקה
              </button>
            )}
          </div>
        </div>

        {/* שורת שמירת תבנית */}
        {saveMode && (
          <div className="flex gap-2 mb-3 items-center">
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTemplate(); } if (e.key === 'Escape') setSaveMode(false); }}
              placeholder="שם למבנה (למשל: טורניר שבועי רגיל)"
              className="input-field flex-1 py-1.5 text-sm"
              autoFocus
              maxLength={100}
            />
            <button type="button" onClick={handleSaveTemplate} disabled={saveLoading || !saveName.trim()}
              className="bg-poker-green/80 hover:bg-poker-green disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shrink-0">
              {saveLoading ? '...' : 'שמור'}
            </button>
            <button type="button" onClick={() => { setSaveMode(false); setSaveName(''); }}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5 rounded-lg transition-colors shrink-0">
              ביטול
            </button>
          </div>
        )}
        {saveMsg && (
          <div className={`text-xs mb-2 px-2 py-1 rounded ${saveMsg.startsWith('✓') ? 'text-poker-green-light' : 'text-red-400'}`}>
            {saveMsg}
          </div>
        )}

        {/* Preset buttons */}
        <div className="flex gap-2 mb-3">
          {Object.entries(BLIND_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                activePreset === key
                  ? 'bg-poker-green/20 border-poker-green text-poker-green-light'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {blinds.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-400">
                  <th className="py-2 px-2 text-center font-semibold w-9">#</th>
                  <th className="py-2 px-1 text-center font-semibold">סמול</th>
                  <th className="py-2 px-1 text-center font-semibold">ביג</th>
                  <th className="py-2 px-1 text-center font-semibold">אנטה</th>
                  <th className="py-2 px-1 text-center font-semibold">זמן</th>
                  <th className="py-2 px-1 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lvl = 0;
                  return blinds.flatMap((row, i) => {
                    const isBreak = row.type === 'break';
                    if (!isBreak) lvl++;
                    const displayLevel = isBreak ? null : lvl;

                    const mainRow = isBreak ? (
                      <tr key={`r${i}`} className="bg-amber-500/5 border-y border-amber-500/20">
                        <td className="py-1.5 px-2 text-center">
                          <span className="text-amber-400 text-[11px]">☕</span>
                        </td>
                        <td colSpan={3} className="py-1.5 px-1 text-center">
                          <span className="text-amber-400/80 text-[11px] font-semibold">הפסקה</span>
                        </td>
                        <td className="py-1 px-1">
                          <div className="flex items-center gap-1">
                            <input type="number" value={row.duration} min="1"
                              onChange={e => updateBlindRow(i, 'duration', e.target.value)}
                              className="w-full bg-transparent text-center text-slate-300 focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                            <span className="text-slate-500 text-[10px] shrink-0">דק׳</span>
                          </div>
                        </td>
                        <td className="py-1 px-1 text-center">
                          <button type="button" onClick={() => removeBlindRow(i)}
                            className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={`r${i}`} className="hover:bg-slate-700/20 transition-colors group/row">
                        <td className="py-1.5 px-1 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-poker-green-light font-black text-[11px] select-none">
                            {displayLevel}
                          </span>
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" value={row.small_blind} min="0"
                            onChange={e => updateBlindRow(i, 'small_blind', e.target.value)}
                            className="w-full bg-transparent text-center text-poker-gold focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" value={row.big_blind} min="0"
                            onChange={e => updateBlindRow(i, 'big_blind', e.target.value)}
                            className="w-full bg-transparent text-center text-poker-gold focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" value={row.ante} min="0"
                            onChange={e => updateBlindRow(i, 'ante', e.target.value)}
                            className="w-full bg-transparent text-center text-slate-400 focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                        </td>
                        <td className="py-1 px-1">
                          <div className="flex items-center gap-1">
                            <input type="number" value={row.duration ?? ''} min="1"
                              onChange={e => updateBlindRow(i, 'duration', e.target.value)}
                              className="w-full bg-transparent text-center text-slate-300 focus:outline-none focus:bg-slate-700/50 rounded px-1 py-0.5" />
                            <span className="text-slate-500 text-[10px] shrink-0">דק׳</span>
                          </div>
                        </td>
                        <td className="py-1 px-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => insertBreakAfter(i)}
                              title="הוסף הפסקה מתחת"
                              className="opacity-0 group-hover/row:opacity-100 text-slate-600 hover:text-amber-400 transition-all text-[13px] leading-none"
                            >☕</button>
                            <button type="button" onClick={() => removeBlindRow(i)}
                              className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                          </div>
                        </td>
                      </tr>
                    );

                    // Divider row between items (not after last)
                    const divider = i < blinds.length - 1 ? (
                      <tr key={`d${i}`} className="group/ins">
                        <td colSpan={6} className="p-0 h-0 relative">
                          <div className="h-px bg-slate-700/60 relative">
                            <button
                              type="button"
                              onClick={() => insertBreakAfter(i)}
                              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2
                                         opacity-0 group-hover/ins:opacity-100
                                         bg-slate-900 border border-dashed border-amber-500/60
                                         text-amber-400 text-[9px] px-2 py-0.5 rounded-full
                                         transition-opacity whitespace-nowrap z-10
                                         hover:bg-amber-500/10"
                            >
                              ☕ הוסף הפסקה כאן
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null;

                    return divider ? [mainRow, divider] : [mainRow];
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <button type="button" onClick={addBlindRow}
            className="flex-1 py-1.5 rounded-lg border border-dashed border-slate-600 text-slate-500 hover:border-poker-green hover:text-poker-green-light text-xs transition-all">
            + הוסף שלב
          </button>
          <button type="button" onClick={addBreakRow}
            className="flex-1 py-1.5 rounded-lg border border-dashed border-slate-600 text-slate-500 hover:border-amber-500 hover:text-amber-400 text-xs transition-all">
            ☕ הוסף הפסקה
          </button>
        </div>
      </div>}

      {/* Re-Entry — רק לטורנירים */}
      {showBlinds && <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">🔄 Re-Entry</label>
        <select value={form.re_entry} onChange={e => set('re_entry', e.target.value)} className="input-field">
          <option value="">ללא Re-Entry</option>
          <option value="1X">1X</option>
          <option value="2X">2X</option>
          <option value="3X">3X</option>
          <option value="4X">4X</option>
          <option value="Unlimited">Unlimited</option>
        </select>
      </div>}

      {/* Late Registration */}
      {showBlinds && blinds.filter(r => r.type !== 'break').length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">⏳ Late Registration — עד שלב</label>
          <select value={form.late_reg_level} onChange={e => set('late_reg_level', e.target.value)} className="input-field">
            <option value="">ללא Late Reg</option>
            {(() => {
              let n = 0;
              return blinds.map((row, i) => {
                if (row.type === 'break') return null;
                n++;
                const lvl = n;
                return (
                  <option key={i} value={lvl}>
                    שלב {lvl} — {row.small_blind?.toLocaleString()}/{row.big_blind?.toLocaleString()}
                  </option>
                );
              });
            })()}
          </select>

          {form.late_reg_level !== '' && (() => {
            const targetLevel = parseInt(form.late_reg_level);
            let n = 0, stageIdx = -1;
            for (let i = 0; i < blinds.length; i++) {
              if (blinds[i].type !== 'break') n++;
              if (n === targetLevel) { stageIdx = i; break; }
            }
            if (stageIdx === -1) return null;
            const stage = blinds[stageIdx];
            let totalMins = 0;
            for (let i = 0; i < stageIdx; i++) totalMins += parseInt(blinds[i].duration) || 0;
            let estTime = null;
            if (form.start_time) {
              const dt = new Date(form.start_time);
              dt.setMinutes(dt.getMinutes() + totalMins);
              estTime = dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            }
            return (
              <div className="mt-2 bg-slate-900/60 rounded-xl p-3 border border-slate-700/50 text-sm flex flex-wrap gap-4">
                <span className="text-slate-400">
                  🃏 בליינדים:{' '}
                  <span className="text-poker-gold font-bold">
                    {stage.small_blind?.toLocaleString()}/{stage.big_blind?.toLocaleString()}
                  </span>
                  {stage.ante > 0 && (
                    <span className="text-slate-500 mr-1">  אנטה: <span className="text-slate-300">{stage.ante?.toLocaleString()}</span></span>
                  )}
                </span>
                {estTime ? (
                  <span className="text-slate-400">
                    ⏰ שעה משוערת:{' '}
                    <span className="text-poker-green-light font-bold">{estTime}</span>
                    <span className="text-slate-500 text-xs mr-1">({totalMins} דק׳ מהתחלה)</span>
                  </span>
                ) : (
                  <span className="text-xs text-amber-400">הגדר שעת התחלה לחישוב שעה משוערת</span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3 whitespace-pre-line leading-relaxed">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'שומר...' : isEdit ? '💾 שמור שינויים' : '📤 שלח לאישור מנהל'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">ביטול</button>
      </div>
    </form>
  );
}
