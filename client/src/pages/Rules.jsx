import { useState, useMemo } from 'react';
import { TDA_PARTS } from '../data/tdaRules';

const HANDS = [
  { name: 'Royal Flush', emoji: '👑', desc: 'A-K-Q-J-10 מאותו צבע', example: 'A♦ K♦ Q♦ J♦ 10♦' },
  { name: 'Straight Flush', emoji: '🔥', desc: 'חמישה קלפים רצופים מאותו צבע', example: '10♥ 9♥ 8♥ 7♥ 6♥' },
  { name: 'Four of a Kind', emoji: '⚡', desc: 'ארבעה קלפים מאותו ערך', example: 'A♠ A♥ A♦ A♣ K♠' },
  { name: 'Full House',    emoji: '🏠', desc: 'שלישייה + זוג', example: '8♠ 8♥ 8♦ 4♣ 4♥' },
  { name: 'Flush',         emoji: '🎨', desc: 'חמישה קלפים מאותו צבע', example: 'Q♣ 10♣ 7♣ 6♣ 2♣' },
  { name: 'Straight',      emoji: '📏', desc: 'חמישה קלפים רצופים', example: '9♥ 8♣ 7♠ 6♦ 5♥' },
  { name: 'Three of a Kind', emoji: '🎯', desc: 'שלושה קלפים מאותו ערך', example: 'J♠ J♥ J♦ 7♣ 4♠' },
  { name: 'Two Pair',      emoji: '✌️', desc: 'שני זוגות', example: 'Q♠ Q♥ 7♣ 7♦ 4♠' },
  { name: 'One Pair',      emoji: '🤝', desc: 'זוג אחד', example: '10♠ 10♥ K♣ 4♦ 3♠' },
  { name: 'High Card',     emoji: '🃏', desc: 'הקלף הגבוה ביותר', example: 'A♠ J♥ 8♣ 5♦ 2♠' },
];

const HOW_TO_PLAY_SECTIONS = [
  {
    title: 'מטרת המשחק',
    content: 'לפני ואחרי חשיפת כל קלף(ים), השחקנים מהמרים בתורות. כדי להישאר ביד ולראות את הקלף הבא, כל השחקנים חייבים להכניס לקופה אותה כמות של ג\'טונים. יד הפוקר הטובה ביותר זוכה בקופה.'
  },
  {
    title: 'חלוקת הקלפים',
    content: 'כל שחקן מקבל שני קלפים לעיניו בלבד. הדילר פורש חמישה קלפים — שלושה בבת אחת, ואחר כך עוד אחד ועוד אחד — שכל השחקנים יכולים להשתמש בהם לבניית היד הטובה ביותר.'
  },
  {
    title: 'אופן המשחק',
    content: 'בהולד\'ם, כל שחקן מקבל שני קלפים פרטיים (hole cards) השייכים לו בלבד. חמישה קלפי קהילה (community cards) מחולקים פניהם כלפי מעלה ומהווים את ה-Board. כל השחקנים משתמשים בקלפי הקהילה המשותפים ביחד עם הקלפים הפרטיים שלהם לבניית יד חמישה קלפים הטובה ביותר. שחקן יכול להשתמש בכל שילוב מבין שבעת הקלפים.'
  },
  {
    title: 'העיוורים (Blinds)',
    content: 'בהולד\'ם, סמן הנקרא "הכפתור" (Dealer Button) מציין מי הוא הדילר בסיבוב הנוכחי. לפני שהמשחק מתחיל, השחקן שמייד בכיוון השעון מהכפתור מניח את ה-Small Blind, ההימור הכפוי הראשון. השחקן מייד בכיוון השעון מה-Small Blind מניח את ה-Big Blind — בדרך כלל פי שניים מה-Small Blind.'
  },
  {
    title: 'אפשרויות ההימור',
    content: 'בהולד\'ם, כמו בצורות פוקר אחרות, האפשרויות הזמינות הן Fold, Check, Bet, Call או Raise. אם אף אחד לא הימר עדיין, שחקן יכול לבצע Check (להמשיך בלי הימור) או Bet. אם שחקן הימר, השחקנים הבאים יכולים לעשות Fold, Call או Raise. Call = להתאים את ההימור הקודם. Raise = לא רק להתאים אלא גם להעלות.'
  },
  {
    title: 'Pre-Flop',
    content: 'לאחר שכל שחקן רואה את הקלפים שלו, כל שחקן יכול לשחק את ידו על ידי Call או Raise ל-Big Blind. הפעולה מתחילה משמאל ה-Big Blind — לאותו שחקן יש את האפשרות ל-Fold, Call או Raise. ההימורים ממשיכים בכל סיבוב עד שכל השחקנים הפעילים שמו הימורים שווים.'
  },
  {
    title: 'ה-Flop',
    content: 'שלושה קלפים מחולקים פניהם כלפי מעלה על השולחן — זהו ה-Flop. שלושת הקלפים הם קלפי קהילה הזמינים לכל השחקנים. ההימור מתחיל מהשחקן הפעיל מייד בכיוון השעון מהכפתור.'
  },
  {
    title: 'ה-Turn',
    content: 'לאחר סיום ההימורים ב-Flop, הקלף הרביעי (ה-Turn / "Fourth Street") מחולק פניו כלפי מעלה. סיבוב הימורים נוסף מתחיל מהשחקן הפעיל מייד בכיוון השעון מהכפתור.'
  },
  {
    title: 'ה-River',
    content: 'לאחר סיום ההימורים ב-Turn, הקלף החמישי והאחרון (ה-River / "Fifth Street") מחולק. ההימור שוב מתחיל מהשחקן הפעיל מייד בכיוון השעון מהכפתור.'
  },
  {
    title: 'ה-Showdown',
    content: 'אם יותר משחקן אחד נשאר לאחר סיום סיבוב ההימורים האחרון, האחרון שהמר או העלה מגלה את קלפיו. השחקן עם יד חמישה הקלפים הטובה ביותר זוכה בקופה. במקרה של ידיים זהות, הקופה מתחלקת שווה בשווה. לאחר חלוקת הקופה, הכפתור עובר לשחקן הבא בכיוון השעון.'
  },
];

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {highlight(text.slice(idx + query.length), query)}
    </>
  );
}

export default function Rules() {
  const [tab, setTab] = useState('how');
  const [tdaLang, setTdaLang] = useState('he');
  const [tdaSearch, setTdaSearch] = useState('');
  const [tdaPart, setTdaPart] = useState(1);

  const activePart = useMemo(() => TDA_PARTS.find(p => p.id === tdaPart), [tdaPart]);

  const filteredSections = useMemo(() => {
    if (!activePart) return [];
    const q = tdaSearch.toLowerCase().trim();
    if (!q) return activePart.sections;
    return activePart.sections
      .map(sec => ({
        ...sec,
        rules: sec.rules.filter(r =>
          r.id.toLowerCase().includes(q) ||
          r.title_en.toLowerCase().includes(q) ||
          r.title_he.toLowerCase().includes(q) ||
          r.en.toLowerCase().includes(q) ||
          r.he.toLowerCase().includes(q)
        ),
      }))
      .filter(sec => sec.rules.length > 0);
  }, [tdaSearch, tdaPart, activePart]);

  const totalResults = filteredSections.reduce((n, s) => n + s.rules.length, 0);
  const q = tdaSearch.trim();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {/* Header */}
      <div className="border-b border-blue-500/20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 py-10 text-center">
          <div className="text-4xl mb-3">🃏</div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">חוקי המשחק + TDA</h1>
          <p className="text-slate-400 text-sm">Texas Hold'em — הכלים שתצטרך לשולחן</p>
        </div>

        {/* Tab bar */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0">
          {[
            { id: 'how',   label: '📖 איך משחקים' },
            { id: 'tda',   label: '📋 TDA Rules' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-bold rounded-t-xl border-t border-x transition-all
                ${tab === t.id
                  ? 'bg-slate-950 border-blue-500/30 text-blue-400'
                  : 'bg-slate-900/50 border-transparent text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── HOW TO PLAY ── */}
        {tab === 'how' && (
          <div className="space-y-8">

            {/* Hand rankings */}
            <section>
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🏆</span> דרגות הידיים
                <span className="text-xs font-normal text-slate-500 mr-2">(מהגבוה לנמוך)</span>
              </h2>
              <div className="space-y-2">
                {HANDS.map((h, i) => (
                  <div key={h.name}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/20 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-slate-600 text-xs font-mono w-4 text-center">{i + 1}</span>
                      <span className="text-lg">{h.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm">{h.name}</div>
                        <div className="text-xs text-slate-400">{h.desc}</div>
                      </div>
                    </div>
                    <code className="text-xs text-emerald-400/80 font-mono shrink-0 hidden sm:block">{h.example}</code>
                  </div>
                ))}
              </div>
            </section>

            {/* Rules sections */}
            <section>
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">📖</span> חוקי Texas Hold'em
              </h2>
              <div className="space-y-4">
                {HOW_TO_PLAY_SECTIONS.map(s => (
                  <div key={s.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                    <h3 className="font-black text-white mb-2">{s.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{s.content}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── TDA RULES ── */}
        {tab === 'tda' && (
          <div className="space-y-5">

            {/* Controls row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              {/* Language toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-700 shrink-0">
                <button onClick={() => setTdaLang('he')}
                  className={`px-4 py-2 text-sm font-bold transition-all ${tdaLang === 'he' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                  🇮🇱 עברית
                </button>
                <button onClick={() => setTdaLang('en')}
                  className={`px-4 py-2 text-sm font-bold transition-all ${tdaLang === 'en' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                  🇺🇸 English
                </button>
              </div>
              {/* Search */}
              <div className="relative flex-1 max-w-sm w-full">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">🔍</span>
                <input type="text" value={tdaSearch} onChange={e => setTdaSearch(e.target.value)}
                  placeholder={tdaLang === 'he' ? 'חיפוש בכל החוקים...' : 'Search all rules...'}
                  dir="auto"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2 pr-9 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all" />
                {tdaSearch && (
                  <button onClick={() => setTdaSearch('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1">✕</button>
                )}
              </div>
            </div>

            {/* Part selector */}
            <div className="flex gap-2 flex-wrap">
              {TDA_PARTS.map(p => (
                <button key={p.id} onClick={() => { setTdaPart(p.id); setTdaSearch(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${tdaPart === p.id
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>
                  {tdaLang === 'he' ? p.title_he : p.title_en}
                </button>
              ))}
            </div>

            {/* Search result count */}
            {q && (
              <div className="text-xs text-slate-500 px-1">
                {tdaLang === 'he' ? `${totalResults} תוצאות עבור "${q}"` : `${totalResults} results for "${q}"`}
              </div>
            )}

            {/* Rules list */}
            {filteredSections.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <div className="text-3xl mb-3">🔍</div>
                <p>{tdaLang === 'he' ? 'לא נמצאו תוצאות' : 'No results found'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredSections.map(sec => (
                  <div key={sec.title_en}>
                    <h3 className="text-xs font-black uppercase tracking-widest text-blue-400/70 mb-3 px-1">
                      {tdaLang === 'he' ? sec.title_he : sec.title_en}
                    </h3>
                    <div className="space-y-2">
                      {sec.rules.map(rule => {
                        const title = tdaLang === 'he' ? rule.title_he : rule.title_en;
                        const body  = tdaLang === 'he' ? rule.he : rule.en;
                        return (
                          <div key={rule.id}
                            className="rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all overflow-hidden">
                            <div className="flex items-start gap-3 p-4">
                              <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-md bg-blue-600/15 text-blue-400 text-xs font-black font-mono border border-blue-500/20">
                                {rule.id}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-white text-sm mb-1.5">
                                  {q ? highlight(title, q) : title}
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed"
                                  dir={tdaLang === 'he' ? 'rtl' : 'ltr'}>
                                  {q ? highlight(body, q) : body}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Copyright */}
            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-600">
                TDA rules used by permission of the Poker TDA · Copyright 2024 pokertda.com
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
