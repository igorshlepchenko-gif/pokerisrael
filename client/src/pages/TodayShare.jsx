import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { splitCanaries } from '../utils/pageToken';
import { israelWallClock, zonedTimeToUTC, tzParts, startInstant, IL_TZ } from '../utils/whatsapp';
import chipUrl from '../assets/chip.svg';
import { drawSchedule, splitTitle, THEMES, FONTS_TO_LOAD } from '../utils/scheduleImage';

// "טורנירי היום" — תמונה ממותגת לשיתוף בוואטסאפ/אינסטגרם, נוצרת בדפדפן (canvas).
// כל שיתוף מפיץ את PokerIsrael.org; טורנירי פיתיון (canary) לא נכנסים לתמונה.

const SITE = 'https://www.pokerisrael.org';
const ROWS_PER_IMAGE = 10;
const THEME_KEY = 'pli_share_theme';

const ymd = (p) => `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;

// מתי הטורניר מתקיים בתאריך היעד (שעון ישראל), או null אם לא באותו יום
function occurrenceOn(t, target /* {year,month,day,weekday} */) {
  const skipped = Array.isArray(t.skipped_dates) ? t.skipped_dates
    : (() => { try { return JSON.parse(t.skipped_dates || '[]'); } catch { return []; } })();
  if (t.is_recurring) {
    const wall = israelWallClock(t.start_time);
    if (!wall) return null;
    const dow = t.day_of_week === null || t.day_of_week === undefined ? wall.weekday : Number(t.day_of_week);
    if (dow !== target.weekday || skipped.includes(ymd(target))) return null;
    return zonedTimeToUTC(target.year, target.month, target.day, wall.hour, wall.minute, IL_TZ);
  }
  const inst = startInstant(t, t.start_time);
  if (!inst) return null;
  return ymd(tzParts(inst, IL_TZ)) === ymd(target) ? inst : null;
}

const timeIL = (d) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: IL_TZ });
const money = (n) => (n || n === 0) && Number(n) > 0 ? `₪${Number(n).toLocaleString('he-IL')}` : '';

function loadImage(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

export default function TodayShare() {
  const [dayOffset, setDayOffset] = useState(0);
  const [theme, setTheme] = useState(() => { try { return THEMES[localStorage.getItem(THEME_KEY)] ? localStorage.getItem(THEME_KEY) : 'gold'; } catch { return 'gold'; } });
  const chooseTheme = (k) => { setTheme(k); try { localStorage.setItem(THEME_KEY, k); } catch { /* ignore */ } };
  const [rows, setRows] = useState(null);
  const [images, setImages] = useState([]); // [{blob, url}]
  const [msg, setMsg] = useState('');
  const urlsRef = useRef([]);

  const target = (() => {
    const p = tzParts(new Date(Date.now() + dayOffset * 86400000), IL_TZ);
    return { year: p.year, month: p.month, day: p.day, weekday: p.weekday };
  })();
  const dateLabel = new Date(Date.UTC(target.year, target.month - 1, target.day, 12))
    .toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const title = dayOffset === 0 ? 'טורנירי היום' : 'טורנירי מחר';

  // טעינת כל הטורנירים (כל העמודים), סינון לתאריך היעד, בלי פיתיונות ובלי קאש
  useEffect(() => {
    let alive = true;
    setRows(null); setImages([]); setMsg('');
    (async () => {
      const all = [];
      for (let page = 1; page <= 10; page++) {
        const r = await api.get('/tournaments', { params: { sort: 'start_time', page, page_size: 50 } });
        const { visible } = await splitCanaries(r.data.items);
        all.push(...visible);
        if (!r.data.has_more) break;
      }
      const list = all
        .filter((t) => t.tournament_type !== 'cash')
        .map((t) => ({ t, at: occurrenceOn(t, target) }))
        .filter((x) => x.at)
        .sort((a, b) => a.at - b.at)
        .map(({ t, at }) => ({
          id: t.id,
          time: timeIL(at),
          name: t.name,
          venue: (t.tournament_type === 'online' ? '🌐 ' : '') + (t.venue_name || t.platform || ''),
          logoUrl: t.venue_logo || null,
          stack: Number(t.starting_stack) > 0 ? Number(t.starting_stack).toLocaleString('he-IL') : '',
          levelMin: Number(t.level_duration) > 0 ? Number(t.level_duration) : '',
          cost: money(t.cost),
          gtd: Number(t.gtd) > 0 ? `₪${Number(t.gtd).toLocaleString('he-IL')}` : '',
        }));
      if (alive) setRows(list);
    })().catch(() => alive && setRows([]));
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOffset]);

  // יצירת התמונות
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    let alive = true;
    (async () => {
      await Promise.all(FONTS_TO_LOAD.map((f) => document.fonts.load(f, 'אבג12₪').catch(() => {})));
      const brandLogo = await loadImage(chipUrl);
      const logos = {};
      await Promise.all([...new Set(rows.map((r) => r.logoUrl).filter(Boolean))].map(async (u) => { logos[u] = await loadImage(u); }));
      const drawRows = rows.map((r) => ({ ...r, ...splitTitle(r.name), logo: logos[r.logoUrl] || null }));
      const pages = Math.ceil(drawRows.length / ROWS_PER_IMAGE);
      const out = [];
      for (let i = 0; i < pages; i++) {
        const canvas = drawSchedule(document.createElement('canvas'), {
          rows: drawRows.slice(i * ROWS_PER_IMAGE, (i + 1) * ROWS_PER_IMAGE),
          title, dateLabel: dateLabel.replace(', ', ' | '), page: i + 1, pages, theme, brandLogo,
        });
        const blob = await toBlob(canvas);
        out.push({ blob, url: URL.createObjectURL(blob) });
      }
      if (!alive) return out.forEach((o) => URL.revokeObjectURL(o.url));
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = out.map((o) => o.url);
      setImages(out);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, theme]);

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // נוסח הודעה לערוץ הוואטסאפ: פתיחה מתחלפת לפי התאריך (שלא ייראה אוטומטי), ובערב — "טורנירי מחר".
  // הקישור מסומן utm_source=wa_channel כדי לראות בטאב "כניסות" כמה הגיעו מהערוץ.
  const count = rows?.length || 0;
  const weekday = dateLabel.split(',')[0];
  const openers = dayOffset === 0 ? [
    `☀️ בוקר טוב! אלה טורנירי היום ♠️\nמה בא לכם — באונטי, דיפ סטאק או משהו גדול?`,
    `🃏 הלוח של היום מוכן — ${count} טורנירים בכל הארץ!`,
    `🔥 ${weekday} בשולחנות — הנה מה שמחכה לכם היום:`,
    `♠️ מי משחק הערב? כל הטורנירים במקום אחד 👇`,
  ] : [
    `🌙 מתכננים את מחר? הנה טורנירי מחר ♠️\nתפסו מקום מראש — יש טורנירים שמתמלאים מהר.`,
  ];
  const opener = openers[(target.day + target.month) % openers.length];
  const shareText = `${opener}\n\n📲 פרטים והרשמה בלחיצה:\n${SITE}/?utm_source=wa_channel`;
  const files = () => images.map((im, i) => new File([im.blob], `pokerisrael-${ymd(target)}${images.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));

  const share = async () => {
    setMsg('');
    const f = files();
    if (navigator.canShare && navigator.canShare({ files: f })) {
      try { await navigator.share({ files: f, text: shareText }); } catch { /* המשתמש ביטל */ }
      return;
    }
    download();
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
    setMsg('התמונה ירדה למחשב — צרף אותה להודעה בוואטסאפ שנפתחה.');
  };

  const download = () => {
    files().forEach((f) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f); a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  };

  const copyText = async () => {
    const lines = rows.map((r) => `${r.time}  ${r.name} — ${r.venue}${r.cost ? ` — ${r.cost}` : ''}`);
    const text = `♠️ ${title} — ${dateLabel}\n\n${lines.join('\n')}\n\nפרטים והרשמה: ${SITE}/?utm_source=wa_channel`;
    try { await navigator.clipboard.writeText(text); setMsg('הרשימה הועתקה — אפשר להדביק בוואטסאפ.'); } catch { setMsg('לא הצלחתי להעתיק'); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10" dir="rtl">
      <h1 className="text-3xl font-black text-white mb-2">📲 {title} לשיתוף</h1>
      <p className="text-slate-400 mb-5 text-sm">
        תמונה מוכנה עם כל הטורנירים — שתפו בקבוצות הוואטסאפ, בסטורי או בכל מקום. מתעדכנת אוטומטית מהאתר.
      </p>

      <div className="flex gap-2 mb-5">
        {[['היום', 0], ['מחר', 1]].map(([label, off]) => (
          <button key={off} onClick={() => setDayOffset(off)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${dayOffset === off ? 'bg-poker-green text-white' : 'bg-slate-800 text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-sm text-slate-400">עיצוב:</span>
        {Object.entries(THEMES).map(([k, t]) => (
          <button key={k} onClick={() => chooseTheme(k)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border ${theme === k ? 'border-white/60 text-white' : 'border-slate-700 text-slate-400'}`}
            style={{ background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})` }}>
            <span className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
            {t.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="text-slate-400 py-10 text-center">טוען טורנירים…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400 py-10 text-center">אין טורנירים ב{dayOffset === 0 ? 'יום הזה' : 'מחר'}.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={share} disabled={!images.length}
              className="flex-1 min-w-[180px] py-3 rounded-xl font-bold text-white bg-[#25D366] hover:brightness-110 disabled:opacity-50">
              📲 שתף בוואטסאפ
            </button>
            <button onClick={download} disabled={!images.length}
              className="py-3 px-4 rounded-xl font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50">⬇️ הורד</button>
            <button onClick={copyText}
              className="py-3 px-4 rounded-xl font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700">📋 העתק כטקסט</button>
          </div>
          {msg && <p className="text-sm text-emerald-300 mb-3">{msg}</p>}
          <p className="text-xs text-slate-500 mb-3">{rows.length} טורנירים{images.length > 1 ? ` · ${images.length} תמונות` : ''}</p>
          <div className="space-y-4">
            {images.length === 0 && <p className="text-slate-400 text-center py-6">יוצר תמונה…</p>}
            {images.map((im, i) => (
              <img key={im.url} src={im.url} alt={`${title} ${i + 1}`} className="w-full rounded-2xl border border-slate-700 shadow-xl" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
