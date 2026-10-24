// ── מנוע השעשועון — חוקי הצ'יפים, בלי DB (נבדק ב-tests/quiz.test.js) ─────────
const config = require('../config/quiz');

const round5 = (n) => Math.round(n / 5) * 5;

function modeConf(mode) {
  const m = config.modes[mode];
  if (!m) throw Object.assign(new Error('מצב משחק לא מוכר'), { status: 400 });
  return m;
}

// הבליינד (ההימור המינימלי) של שאלה מספר idx (מ-0)
function blindFor(mode, idx) {
  const m = modeConf(mode);
  if (mode === 'clock') return m.blinds[Math.min(Math.floor(idx / m.blindEvery), m.blinds.length - 1)];
  return m.blinds[Math.min(idx, m.blinds.length - 1)];
}

// הימור חוקי: מספר שלם, לפחות הבליינד (או כל הערימה אם היא קטנה ממנו), לכל היותר הערימה
function validateBet(stack, blind, bet) {
  const min = Math.min(stack, blind);
  if (!Number.isInteger(bet)) return { ok: false, message: 'הימור לא תקין' };
  if (bet < min) return { ok: false, message: `ההימור המינימלי הוא ${min}` };
  if (bet > stack) return { ok: false, message: 'אי אפשר להמר יותר ממה שיש לך' };
  return { ok: true };
}

// הערימה אחרי התשובה. נכון: + הימור × מכפיל הקושי (מעוגל ל-5). טעות / לא הספיק: − ההימור
function settle(stack, bet, difficulty, correct) {
  if (!correct) return stack - bet;
  return stack + round5(bet * (config.payout[difficulty] || 1));
}

// ערבוב דטרמיניסטי לפי מחרוזת (לסט היומי: אותו יום = אותו סדר לכולם)
function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// בחירת שאלות לפי רשימת קושי. candidates: [{id, difficulty, category}], preferred: ids עדיפים (לא נראו לאחרונה).
// מעדיף גיוון נושאים; אם אין מספיק בקושי המבוקש — לוקח מקושי אחר. מחזיר רשימת ids (אולי קצרה יותר אם אין מספיק).
function pickQuestions(candidates, difficulties, { rand = Math.random, preferred = null } = {}) {
  const fresh = preferred ? candidates.filter((q) => preferred.has(q.id)) : candidates;
  const pool = shuffle(fresh.length >= difficulties.length ? fresh : candidates, rand);
  const used = new Set();
  const usedCats = new Map();
  const out = [];
  for (const d of difficulties) {
    const take = (filter) => {
      const opts = pool.filter((q) => !used.has(q.id) && filter(q));
      if (!opts.length) return null;
      // הכי פחות מופיע מבחינת נושא — כדי שהסט לא יהיה 4 שאלות חוקים ברצף
      opts.sort((a, b) => (usedCats.get(a.category) || 0) - (usedCats.get(b.category) || 0));
      return opts[0];
    };
    const q = take((x) => x.difficulty === d) || take(() => true);
    if (!q) break;
    used.add(q.id);
    usedCats.set(q.category, (usedCats.get(q.category) || 0) + 1);
    out.push(q.id);
  }
  return out;
}

// התשובה הגיעה בזמן? (revealedAt — מתי השאלה נחשפה; ms)
function inTime(revealedAt, now, seconds) {
  return now - revealedAt <= seconds * 1000 + config.graceMs;
}

// יש בטקסט קלפים כמו A♠ / 10♦ (→ זמן נוסף לענות)
const hasCards = (text) => /(?:10|[2-9TJQKA])[♠♥♦♣]/.test(String(text || ''));
// כמה שניות לענות על שאלה במצב הזה
function answerSecondsFor(mode, questionText) {
  const base = modeConf(mode).answerSeconds;
  return base == null ? null : base + (hasCards(questionText) ? config.cardBonusSeconds || 0 : 0);
}

// שורת התוצאה לשיתוף: 🟩 נכון, 🟥 טעות, ⬜ לא הספיק
function shareLine(results) {
  return [...results].map((r) => (r === 'C' ? '🟩' : r === 'T' ? '⬜' : '🟥')).join('');
}

module.exports = { blindFor, validateBet, settle, seededRandom, shuffle, pickQuestions, inTime, shareLine, modeConf, round5, hasCards, answerSecondsFor };
