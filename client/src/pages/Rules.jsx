import { useState } from 'react';

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
    content: 'לפני ואחרי חשיפת כל קלף(ים), השחקנים מהמרים בתורות. כדי להישאר ביד ולראות את הקלף הבא, כל השחקנים חייבים להכניס לסיר אותה כמות של ג\'טונים. יד הפוקר הטובה ביותר זוכה בסיר.'
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
    content: 'אם יותר משחקן אחד נשאר לאחר סיום סיבוב ההימורים האחרון, האחרון שהמר או העלה מגלה את קלפיו. השחקן עם יד חמישה הקלפים הטובה ביותר זוכה בסיר. במקרה של ידיים זהות, הסיר מתחלק שווה בשווה. לאחר חלוקת הסיר, הכפתור עובר לשחקן הבא בכיוון השעון.'
  },
];

export default function Rules() {
  const [tab, setTab] = useState('how');

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
              <h2 className="text-xl font-black text-black mb-4 flex items-center gap-2">
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
                        <div className="font-bold text-black text-sm">{h.name}</div>
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
              <h2 className="text-xl font-black text-black mb-4 flex items-center gap-2">
                <span className="text-2xl">📖</span> חוקי Texas Hold'em
              </h2>
              <div className="space-y-4">
                {HOW_TO_PLAY_SECTIONS.map(s => (
                  <div key={s.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                    <h3 className="font-black text-black mb-2">{s.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{s.content}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── TDA ── */}
        {tab === 'tda' && (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">📋</div>
            <h2 className="text-xl font-bold text-slate-300">TDA Rules — בקרוב</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              חוקי ה-Tournament Directors Association יתווספו כאן בקרוב.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
