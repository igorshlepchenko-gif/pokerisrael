// ── שעשועון הפוקר: משחקים, שאלות וטבלאות דירוג ─────────────────────────────
// החוקים עצמם ב-services/quizEngine.js וההגדרות ב-config/quiz.js.
//
// כל ההחלטות בשרת: התשובה הנכונה לא נשלחת לדפדפן לפני שענו, הזמן נמדד מרגע חשיפת
// השאלה בשרת, והניקוד מחושב כאן. מזהה המשחק אקראי וארוך — הוא גם "המפתח" של אורח.
//
// זרימה (daily/topic): משחק חדש → רואים נושא+קושי+בליינד → מהמרים (POST bet, השאלה
// נחשפת) → עונים (POST answer) → השאלה הבאה... עד 10 שאלות או 0 צ'יפים.
// clock: אין בחירת הימור — כל שאלה נחשפת מיד על הבליינד, 90 שניות לכל המשחק.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const config = require('../config/quiz');
const engine = require('./quizEngine');

const israelDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
const httpError = (status, message) => Object.assign(new Error(message), { status });
const questionKey = (q) => crypto.createHash('md5').update(String(q).trim()).digest('hex');
const FINAL = ['finished', 'busted', 'abandoned'];

// ── שאלות ──────────────────────────────────────────────────────────────────
// מכניס שאלות חדשות מקובץ הזרע (data/quizQuestions.json) כ-pending. שאלה שכבר קיימת
// (לפי הטקסט) לא נוגעים בה — כדי לא לדרוס עריכה/אישור/פסילה מהפאנל.
async function seedQuestions(file = path.join(__dirname, '../data/quizQuestions.json')) {
  if (!fs.existsSync(file)) return 0;
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  for (const q of list) {
    const r = await pool.query(
      `INSERT INTO quiz_questions (question_key, category, difficulty, question, options, correct, explanation, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (question_key) DO NOTHING`,
      [questionKey(q.question), q.category, q.difficulty, q.question, JSON.stringify(q.options), q.correct, q.explanation || null, q.source || null]
    );
    added += r.rowCount;
  }
  return added;
}

// שאלות שמותר להגיש. אדמין (שלב הבדיקה) רואה גם שאלות שעוד לא אושרו, כדי לבדוק אותן תוך כדי משחק
// בודק שאלות = אדמין, או משתמש שקיבל בפאנל "בודק" (users.quiz_reviewer): משחק גם בשאלות ממתינות,
// פוסל שאלה בלחיצה תוך כדי משחק, ומאשר/עורך שאלות במסך "בדיקת שאלות"
const isReviewer = (user) => user?.role === 'admin' || !!user?.quiz_reviewer;
const statusesFor = (user) => (isReviewer(user) ? ['approved', 'pending'] : ['approved']);

// שאלות כלליות (venue_id IS NULL). שאלות של מועדון מוגשות רק בצ'אלנג' של אותו מועדון
async function candidates(statuses, topic = null) {
  const r = await pool.query(
    `SELECT id, difficulty, category FROM quiz_questions
     WHERE status = ANY($1) AND venue_id IS NULL AND ($2::text IS NULL OR category = $2)`,
    [statuses, topic]
  );
  return r.rows;
}

async function clubCandidates(statuses, venueId) {
  const r = await pool.query(
    `SELECT id, difficulty, category FROM quiz_questions WHERE status = ANY($1) AND venue_id = $2`, [statuses, venueId]);
  return r.rows;
}

// ── גישה (שלב סגור) ───────────────────────────────────────────────────────
// פתוח לכולם (גם לאורחים) רק כשהמנהל הדליק את המתג; אחרת — אדמין ומשתמשים שאושרו
async function isOpenToAll() {
  const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'quiz_open_to_all'`);
  return r.rows[0]?.value === 'true';
}
async function access(user) {
  const open = await isOpenToAll();
  const reviewer = isReviewer(user);
  return { open, loggedIn: !!user, reviewer, allowed: open || reviewer || !!user?.quiz_access };
}
async function requireAccess(user) {
  if (!(await access(user)).allowed) throw httpError(403, user ? 'השעשועון בשלב סגור — עוד לא קיבלת גישה' : 'השעשועון בשלב סגור');
}

// שאלות שהמשתמש לא ראה בימים האחרונים (לגוון)
async function freshFor(userId, ids) {
  if (!userId) return null;
  const r = await pool.query(
    `SELECT DISTINCT question_id FROM quiz_answers WHERE user_id = $1 AND created_at > NOW() - ($2 || ' days')::interval`,
    [userId, String(config.avoidRepeatDays)]
  );
  const seen = new Set(r.rows.map((x) => x.question_id));
  return new Set(ids.filter((id) => !seen.has(id)));
}

// הסט היומי: נקבע מהשאלות המאושרות בפעם הראשונה שמישהו מבקש אותו, ונשמר — כך שזהה לכולם.
// אם עדיין אין מספיק שאלות מאושרות, אדמין מקבל סט זמני (גם מ-pending, קבוע לאותו יום) שלא נשמר.
async function dailySet(day, user) {
  const saved = await pool.query(`SELECT question_ids FROM quiz_daily_sets WHERE day = $1`, [day]);
  if (saved.rows[0]) return saved.rows[0].question_ids;
  const m = config.modes.daily;
  const rand = engine.seededRandom(`daily:${day}`);
  const approved = await candidates(['approved']);
  // לא לחזור על שאלות מהסטים היומיים של החודשיים האחרונים (אם יש מספיק אחרות)
  const recent = await pool.query(`SELECT question_ids FROM quiz_daily_sets WHERE day > $1::date - 60`, [day]);
  const used = new Set(recent.rows.flatMap((r) => r.question_ids));
  const preferred = new Set(approved.map((q) => q.id).filter((id) => !used.has(id)));
  const ids = engine.pickQuestions(approved, m.difficulties, { rand, preferred });
  if (ids.length === m.questions) {
    await pool.query(`INSERT INTO quiz_daily_sets (day, question_ids) VALUES ($1,$2) ON CONFLICT (day) DO NOTHING`, [day, ids]);
    return (await pool.query(`SELECT question_ids FROM quiz_daily_sets WHERE day = $1`, [day])).rows[0].question_ids;
  }
  if (!isReviewer(user)) throw httpError(503, 'השעשועון עוד לא מוכן — חסרות שאלות');
  const preview = engine.pickQuestions(await candidates(statusesFor(user)), m.difficulties, { rand: engine.seededRandom(`daily:${day}`) });
  if (preview.length < m.questions) throw httpError(503, 'אין מספיק שאלות לסט יומי');
  return preview;
}

async function rankedCountToday(userId, mode, day) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM quiz_games WHERE user_id = $1 AND day = $2 AND mode = $3 AND ranked`,
    [userId, day, mode]
  );
  return r.rows[0].n;
}

// ── משחק ──────────────────────────────────────────────────────────────────
async function startGame({ user, mode, topic, venueId }) {
  await requireAccess(user);
  const m = engine.modeConf(mode);
  if (mode === 'topic' && (!config.categories[topic] || topic === 'club')) throw httpError(400, 'נושא לא מוכר');
  let venue = null;
  if (mode === 'club') {
    venue = (await pool.query(`SELECT id, name FROM venues WHERE id = $1`, [Number(venueId) || 0])).rows[0];
    if (!venue) throw httpError(404, 'מועדון לא נמצא');
  }
  const day = israelDay();
  const userId = user?.id || null;

  let ids;
  if (mode === 'daily') {
    ids = await dailySet(day, user);
    if (userId) {
      const prev = await pool.query(
        `SELECT id, status FROM quiz_games WHERE user_id = $1 AND day = $2 AND mode = 'daily' AND ranked`, [userId, day]);
      if (prev.rows[0]?.status === 'active') return getState(prev.rows[0].id, user); // רענון באמצע — ממשיכים
      if (prev.rows[0]) throw httpError(409, 'כבר שיחקת את הסט היומי היום — מחר יש סט חדש');
    }
  } else if (mode === 'club') {
    // 10 שאלות כלליות לפי תוכנית הקושי, ובמקומות 2,5,7,9 — שאלות המועדון (אם יש)
    const general = await candidates(statusesFor(user));
    const fresh = await freshFor(userId, general.map((q) => q.id));
    const clubQs = engine.shuffle(await clubCandidates(statusesFor(user), venue.id)).slice(0, m.clubQuestions)
      .sort((a, b) => a.difficulty - b.difficulty);
    const slots = [1, 4, 6, 8].slice(0, clubQs.length);
    const plan = m.difficulties.filter((_, i) => !slots.includes(i));
    const gen = engine.pickQuestions(general, plan, { preferred: fresh });
    ids = [];
    for (let i = 0, g = 0, c = 0; i < m.questions; i++) {
      if (slots.includes(i)) ids.push(clubQs[c++].id);
      else if (g < gen.length) ids.push(gen[g++]);
    }
    if (ids.length < m.questions) throw httpError(503, 'אין מספיק שאלות עדיין');
  } else {
    const pool_ = await candidates(statusesFor(user), mode === 'topic' ? topic : null);
    const difficulties = mode === 'clock'
      ? Array.from({ length: m.questions }, (_, i) => (i < 10 ? 1 : i < 25 ? 2 : 3)) // מתחיל קל ומתקשה
      : [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];
    ids = engine.pickQuestions(pool_, difficulties, { preferred: await freshFor(userId, pool_.map((q) => q.id)) });
    if (ids.length < (mode === 'clock' ? 10 : m.questions)) throw httpError(503, 'אין מספיק שאלות בנושא הזה עדיין');
  }

  // מדורג = נכנס לטבלאות. אורח אף פעם; משתמש — עד המכסה היומית של המצב
  const ranked = !!userId && (await rankedCountToday(userId, mode, day)) < m.rankedPerDay;
  const id = crypto.randomBytes(16).toString('hex');
  const clock = mode === 'clock';
  await pool.query(
    `INSERT INTO quiz_games (id, user_id, mode, topic, day, question_ids, stack, ranked, bet, revealed_at, venue_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, userId, mode, mode === 'topic' ? topic : null, day, ids, config.startStack, ranked,
      clock ? engine.blindFor('clock', 0) : null, clock ? new Date() : null, venue?.id || null]
  );
  return getState(id, user);
}

async function loadGame(client, id, user, lock = false) {
  if (!/^[0-9a-f]{32}$/.test(String(id))) throw httpError(404, 'משחק לא נמצא');
  const r = await client.query(`SELECT * FROM quiz_games WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  const g = r.rows[0];
  if (!g) throw httpError(404, 'משחק לא נמצא');
  // משחק של משתמש רשום — רק הוא. משחק אורח — מי שמחזיק את המזהה
  if (g.user_id && g.user_id !== user?.id) throw httpError(404, 'משחק לא נמצא');
  return g;
}

async function questionPublic(client, qid) {
  const r = await client.query(`SELECT id, category, difficulty, question, options FROM quiz_questions WHERE id = $1`, [qid]);
  return r.rows[0];
}

// סגירת משחק: ניקוד = הערימה הסופית (רק במשחק מדורג שהסתיים — לא בנטישה)
async function finalize(client, g, status) {
  const points = g.ranked && status !== 'abandoned' ? Math.max(0, g.stack) : 0;
  // גם הערימה/התוצאות — כשהמשחק נגמר בתשובה האחרונה, הן עוד לא נשמרו
  await client.query(
    `UPDATE quiz_games SET status = $2, points = $3, stack = $4, idx = $5, results = $6,
       finished_at = NOW(), bet = NULL, revealed_at = NULL WHERE id = $1`,
    [g.id, status, points, g.stack, g.idx, g.results]
  );
  Object.assign(g, { status, points, bet: null, revealed_at: null });
}

// משחק נגד השעון שהזמן שלו נגמר / משחק שננטש — נסגר כשנוגעים בו
async function expireIfNeeded(client, g) {
  if (g.status !== 'active') return;
  const now = Date.now();
  const m = config.modes[g.mode];
  if (g.mode === 'clock' && now > new Date(g.started_at).getTime() + m.totalSeconds * 1000 + config.graceMs) {
    return finalize(client, g, 'finished');
  }
  if (now > new Date(g.started_at).getTime() + config.abandonAfterMinutes * 60000) {
    return finalize(client, g, 'abandoned');
  }
}

// המצב שהדפדפן מקבל. השאלה עצמה — רק אחרי הימור (או מיד בנגד השעון); התשובה הנכונה — אף פעם מכאן
async function stateOf(client, g) {
  const m = config.modes[g.mode];
  const total = g.mode === 'clock' ? null : g.question_ids.length;
  const s = {
    id: g.id, mode: g.mode, topic: g.topic, venueId: g.venue_id, status: g.status, ranked: g.ranked,
    stack: g.stack, startStack: config.startStack, index: g.idx, total, results: g.results,
    points: g.points, share: engine.shareLine(g.results), day: g.day,
  };
  // זמן שנותר נשלח במילישניות (לא שעה) — כך שעון לא מכוון בטלפון לא משנה את הטיימר
  if (g.mode === 'clock') s.clockMsLeft = Math.max(0, new Date(g.started_at).getTime() + m.totalSeconds * 1000 - Date.now());
  if (g.status !== 'active') return s;
  const qid = g.question_ids[g.idx];
  const q = await questionPublic(client, qid);
  s.blind = engine.blindFor(g.mode, g.idx);
  const seconds = engine.answerSecondsFor(g.mode, q.question);
  s.next = { category: q.category, categoryLabel: config.categories[q.category], difficulty: q.difficulty, payout: config.payout[q.difficulty], seconds };
  if (g.bet != null) {
    s.bet = g.bet;
    s.question = { text: q.question, options: q.options };
    if (g.mode !== 'clock') {
      s.answerSeconds = seconds;
      s.msLeft = Math.max(0, new Date(g.revealed_at).getTime() + seconds * 1000 - Date.now());
    }
  }
  return s;
}

async function getState(id, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const g = await loadGame(client, id, user, true);
    await expireIfNeeded(client, g);
    const s = await stateOf(client, g);
    await client.query('COMMIT');
    return s;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function placeBet(id, user, bet) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const g = await loadGame(client, id, user, true);
    await expireIfNeeded(client, g);
    if (g.status !== 'active') throw httpError(409, 'המשחק הסתיים');
    if (g.mode === 'clock') throw httpError(400, 'בנגד השעון אין בחירת הימור');
    if (g.bet != null) throw httpError(409, 'כבר הימרת על השאלה הזו');
    const v = engine.validateBet(g.stack, engine.blindFor(g.mode, g.idx), Number(bet));
    if (!v.ok) throw httpError(400, v.message);
    await client.query(`UPDATE quiz_games SET bet = $2, revealed_at = NOW() WHERE id = $1`, [g.id, Number(bet)]);
    Object.assign(g, { bet: Number(bet), revealed_at: new Date() });
    const s = await stateOf(client, g);
    await client.query('COMMIT');
    return s;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function answer(id, user, choice) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const g = await loadGame(client, id, user, true);
    await expireIfNeeded(client, g);
    if (g.status !== 'active') {
      const s = await stateOf(client, g);
      await client.query('COMMIT');
      return { ...s, timeUp: g.mode === 'clock' };
    }
    if (g.bet == null) throw httpError(409, 'קודם מהמרים');
    const m = config.modes[g.mode];
    const qid = g.question_ids[g.idx];
    const qr = await client.query(`SELECT question, difficulty, options, correct, explanation FROM quiz_questions WHERE id = $1`, [qid]);
    const q = qr.rows[0];
    const now = Date.now();
    const ms = now - new Date(g.revealed_at).getTime();
    const onTime = g.mode === 'clock' || engine.inTime(new Date(g.revealed_at).getTime(), now, engine.answerSecondsFor(g.mode, q.question));
    const c = Number.isInteger(choice) && choice >= 0 && choice < q.options.length ? choice : null;
    const correct = onTime && c === q.correct;
    const bet = g.bet;
    const prevStack = g.stack;
    const stack = engine.settle(prevStack, bet, q.difficulty, correct);
    const results = g.results + (correct ? 'C' : onTime ? 'W' : 'T');

    await client.query(
      `INSERT INTO quiz_answers (game_id, idx, question_id, user_id, bet, choice, correct, ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [g.id, g.idx, qid, g.user_id, bet, c, correct, ms]
    );
    await client.query(
      `UPDATE quiz_questions SET times_shown = times_shown + 1, times_correct = times_correct + $2::int WHERE id = $1`,
      [qid, correct ? 1 : 0]
    );

    const idx = g.idx + 1;
    Object.assign(g, { stack, idx, results });
    const done = stack <= 0 ? 'busted' : idx >= g.question_ids.length ? 'finished' : null;
    if (done) {
      await finalize(client, g, done);
    } else {
      // נגד השעון: השאלה הבאה נחשפת מיד על הבליינד (או כל הערימה אם היא קטנה ממנו)
      const nextBet = g.mode === 'clock' ? Math.min(stack, engine.blindFor('clock', idx)) : null;
      await client.query(
        `UPDATE quiz_games SET stack = $2, idx = $3, results = $4, bet = $5, revealed_at = $6 WHERE id = $1`,
        [g.id, stack, idx, results, nextBet, nextBet != null ? new Date() : null]
      );
      Object.assign(g, { bet: nextBet, revealed_at: nextBet != null ? new Date() : null });
    }
    const s = await stateOf(client, g);
    await client.query('COMMIT');
    return {
      ...s,
      last: { correct, timedOut: !onTime, choice: c, correctIndex: q.correct, explanation: q.explanation, bet, delta: stack - prevStack, questionId: qid },
    };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

// נגד השעון: הדפדפן מודיע שהזמן נגמר
async function finishClock(id, user) {
  return getState(id, user);
}

// ── דירוג ──────────────────────────────────────────────────────────────────
function periodStart(period, day = israelDay()) {
  if (period === 'day') return day;
  if (period === 'quarter') {
    const [y, mo] = day.split('-').map(Number);
    return `${y}-${String(Math.floor((mo - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  }
  if (period === 'all') return '2000-01-01';
  throw httpError(400, 'תקופה לא מוכרת');
}

// "ישראל ישראלי" → "ישראל י." — שם מלא לא מוצג בטבלה ציבורית
function displayName(name, nickname) {
  if (nickname) return nickname;
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'שחקן';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

// venueId — טבלת מועדון: רק משחקי הצ'אלנג' של אותו מועדון
async function leaderboard(period, user, venueId = null, limit = 50) {
  await requireAccess(user);
  const from = periodStart(period);
  const r = await pool.query(
    `WITH t AS (
       SELECT user_id, SUM(points)::int AS points, COUNT(*)::int AS games
       FROM quiz_games WHERE ranked AND status IN ('finished','busted') AND day >= $1
         AND ($4::int IS NULL OR (mode = 'club' AND venue_id = $4))
       GROUP BY user_id
     ), ranked AS (
       SELECT t.*, RANK() OVER (ORDER BY points DESC) AS rank FROM t WHERE points > 0
     )
     SELECT ranked.*, u.name, u.quiz_nickname FROM ranked JOIN users u ON u.id = ranked.user_id
     WHERE ranked.rank <= $2 OR ranked.user_id = $3
     ORDER BY rank, games`,
    [from, limit, user?.id || 0, venueId ? Number(venueId) : null]
  );
  const rows = r.rows.map((x) => ({
    rank: Number(x.rank), name: displayName(x.name, x.quiz_nickname), points: x.points, games: x.games, me: x.user_id === user?.id,
  }));
  return { period, from, venueId: venueId ? Number(venueId) : null, top: rows.filter((x) => x.rank <= limit), me: rows.find((x) => x.me) || null };
}

// לובי: מה שיחקתי היום, כמה משחקים מדורגים נשארו, רצף ימים של סט יומי
async function me(user) {
  const day = israelDay();
  const acc = await access(user);
  if (!acc.allowed || !user) return { ...acc, day };
  const games = await pool.query(
    `SELECT mode, ranked, status, points, results, id FROM quiz_games WHERE user_id = $1 AND day = $2 ORDER BY started_at`, [user.id, day]);
  const daily = games.rows.find((g) => g.mode === 'daily' && g.ranked);
  const left = {};
  for (const mode of Object.keys(config.modes)) {
    left[mode] = Math.max(0, config.modes[mode].rankedPerDay - games.rows.filter((g) => g.mode === mode && g.ranked).length);
  }
  const days = await pool.query(
    `SELECT DISTINCT day::text AS day FROM quiz_games WHERE user_id = $1 AND mode = 'daily' AND ranked AND status IN ('finished','busted')
     ORDER BY day DESC LIMIT 400`, [user.id]);
  let streak = 0;
  const cur = new Date(`${day}T12:00:00Z`);
  if (!days.rows.some((d) => d.day === day)) cur.setUTCDate(cur.getUTCDate() - 1); // עוד לא שיחק היום — הרצף עדיין חי
  for (const d of days.rows) {
    if (d.day !== cur.toISOString().slice(0, 10)) break;
    streak++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  const u = await pool.query(`SELECT name, quiz_nickname FROM users WHERE id = $1`, [user.id]);
  const active = games.rows.find((g) => g.status === 'active');
  return {
    ...acc, day,
    name: displayName(u.rows[0]?.name, u.rows[0]?.quiz_nickname), nickname: u.rows[0]?.quiz_nickname || null,
    daily: daily ? { status: daily.status, points: daily.points, share: engine.shareLine(daily.results), id: daily.id } : null,
    rankedLeft: left, streak, activeGameId: active?.id || null,
  };
}

async function setNickname(user, nickname) {
  const n = String(nickname || '').trim().replace(/\s+/g, ' ');
  if (n && !/^[\p{L}\p{N} _.\-']{2,20}$/u.test(n)) throw httpError(400, 'כינוי: 2–20 תווים, אותיות/מספרים בלבד');
  await pool.query(`UPDATE users SET quiz_nickname = $2 WHERE id = $1`, [user.id, n || null]);
  return { nickname: n || null };
}

async function flagQuestion(user, questionId, reason) {
  await requireAccess(user);
  const id = Number(questionId);
  if (!Number.isInteger(id)) throw httpError(400, 'שאלה לא תקינה');
  // בודק שמסמן שאלה תוך כדי משחק — נפסלת מיד
  if (isReviewer(user)) {
    await pool.query(`UPDATE quiz_questions SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`, [id, user.id]);
    return { rejected: true };
  }
  await pool.query(`INSERT INTO quiz_flags (question_id, user_id, reason) VALUES ($1,$2,$3)`, [id, user?.id || null, String(reason || '').slice(0, 300) || null]);
  await pool.query(`UPDATE quiz_questions SET flags = flags + 1 WHERE id = $1`, [id]);
  return { flagged: true };
}

// מסך פתיחה של צ'אלנג' מועדון (מי שסרק QR)
async function clubInfo(venueId) {
  const r = await pool.query(
    `SELECT v.id, v.name, v.logo_url,
       (SELECT COUNT(*)::int FROM quiz_questions q WHERE q.venue_id = v.id AND q.status = 'approved') AS questions
     FROM venues v WHERE v.id = $1`, [Number(venueId) || 0]);
  if (!r.rows[0]) throw httpError(404, 'מועדון לא נמצא');
  return r.rows[0];
}

// ── ניהול גישה (פאנל) ────────────────────────────────────────────────────
// משתמשי דמה (is_seed_data — קיים רק בפרודקשן, לכן דרך to_jsonb) לא מוצגים ולא מקבלים גישה גורפת
const NOT_SEED = `COALESCE((to_jsonb(u) ->> 'is_seed_data')::boolean, false) = false`;

async function adminAccess() {
  const users = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.quiz_access, u.quiz_reviewer, u.is_active FROM users u WHERE ${NOT_SEED}
     ORDER BY (u.role = 'admin') DESC, u.quiz_reviewer DESC, u.quiz_access DESC, u.name`);
  return { open: await isOpenToAll(), users: users.rows };
}
async function adminSetOpen(open) {
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('quiz_open_to_all', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [open ? 'true' : 'false']);
  return { open: !!open };
}
// userIds — משתמשים ספציפיים; 'all' — כל המשתמשים (גורף)
async function adminSetUserAccess(userIds, allowed) {
  const r = userIds === 'all'
    ? await pool.query(`UPDATE users u SET quiz_access = $1 WHERE u.role <> 'admin' AND ${NOT_SEED}`, [!!allowed])
    : await pool.query(`UPDATE users SET quiz_access = $2 WHERE id = ANY($1)`, [(userIds || []).map(Number).filter(Number.isInteger), !!allowed]);
  return { updated: r.rowCount };
}

// בודק שאלות — תמיד גם עם גישה
async function adminSetReviewer(userIds, reviewer) {
  const ids = (userIds || []).map(Number).filter(Number.isInteger);
  const r = await pool.query(
    `UPDATE users SET quiz_reviewer = $2, quiz_access = (quiz_access OR $2) WHERE id = ANY($1) AND role <> 'admin'`, [ids, !!reviewer]);
  return { updated: r.rowCount };
}

// מועדונים לצ'אלנג' QR: כמה שאלות יש לכל אחד, והקישור לסריקה
async function adminClubs(site) {
  const r = await pool.query(
    `SELECT v.id, v.name, v.logo_url,
       COUNT(q.id) FILTER (WHERE q.status = 'approved')::int AS approved,
       COUNT(q.id) FILTER (WHERE q.status = 'pending')::int AS pending
     FROM venues v LEFT JOIN quiz_questions q ON q.venue_id = v.id
     WHERE COALESCE(v.is_approved, true) GROUP BY v.id ORDER BY approved DESC, pending DESC, v.name`);
  return r.rows.map((v) => ({ ...v, link: `${site}/quiz?club=${v.id}&utm_source=club_qr` }));
}

// ── ניהול שאלות (פאנל) ───────────────────────────────────────────────────
function validateQuestion(q) {
  if (!config.categories[q.category]) throw httpError(400, 'נושא לא מוכר');
  const venueId = q.venue_id ? Number(q.venue_id) : null;
  if ((q.category === 'club') !== !!venueId) throw httpError(400, 'שאלת מועדון = הנושא "שאלות המועדון" + בחירת מועדון');
  if (![1, 2, 3].includes(Number(q.difficulty))) throw httpError(400, 'קושי 1–3');
  if (!String(q.question || '').trim()) throw httpError(400, 'חסר טקסט שאלה');
  const opts = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
  if (opts.length < 2 || opts.length > 4) throw httpError(400, '2–4 תשובות');
  if (new Set(opts).size !== opts.length) throw httpError(400, 'יש תשובות כפולות');
  const correct = Number(q.correct);
  if (!Number.isInteger(correct) || correct < 0 || correct >= opts.length) throw httpError(400, 'לא נבחרה תשובה נכונה');
  return { category: q.category, difficulty: Number(q.difficulty), question: String(q.question).trim(), options: opts, correct,
    explanation: String(q.explanation || '').trim() || null, source: String(q.source || '').trim() || null, venue_id: venueId };
}

async function adminList({ status, category }) {
  const r = await pool.query(
    `SELECT q.*, (SELECT COALESCE(json_agg(f.reason ORDER BY f.created_at DESC) FILTER (WHERE f.reason IS NOT NULL), '[]') FROM quiz_flags f WHERE f.question_id = q.id) AS flag_reasons
       , v.name AS venue_name, ru.name AS reviewed_by_name
     FROM quiz_questions q LEFT JOIN venues v ON v.id = q.venue_id LEFT JOIN users ru ON ru.id = q.reviewed_by
     WHERE ($1::text IS NULL OR q.status = $1) AND ($2::text IS NULL OR q.category = $2)
     ORDER BY q.flags DESC, q.category, q.difficulty, q.id`,
    [status || null, category || null]
  );
  const counts = await pool.query(`SELECT status, category, COUNT(*)::int AS n FROM quiz_questions GROUP BY status, category`);
  return { questions: r.rows, counts: counts.rows, categories: config.categories };
}

// by — מי ששמר/אישר (נשמר ב-reviewed_by, מוצג בפאנל "אושר ע"י")
async function adminSave(id, body, by = null) {
  const q = validateQuestion(body);
  const status = ['pending', 'approved', 'rejected'].includes(body.status) ? body.status : 'pending';
  if (id) {
    const r = await pool.query(
      `UPDATE quiz_questions SET category=$2, difficulty=$3, question=$4, options=$5, correct=$6, explanation=$7, source=$8, status=$9,
         venue_id=$10, reviewed_by=$11, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, q.category, q.difficulty, q.question, JSON.stringify(q.options), q.correct, q.explanation, q.source, status, q.venue_id, by]
    );
    if (!r.rows[0]) throw httpError(404, 'שאלה לא נמצאה');
    return r.rows[0];
  }
  const r = await pool.query(
    `INSERT INTO quiz_questions (question_key, category, difficulty, question, options, correct, explanation, source, status, venue_id, reviewed_by, reviewed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) ON CONFLICT (question_key) DO NOTHING RETURNING *`,
    [questionKey(q.question), q.category, q.difficulty, q.question, JSON.stringify(q.options), q.correct, q.explanation, q.source, status, q.venue_id, by]
  );
  if (!r.rows[0]) throw httpError(409, 'שאלה זהה כבר קיימת');
  return r.rows[0];
}

async function adminSetStatus(ids, status, by = null) {
  if (!['pending', 'approved', 'rejected'].includes(status)) throw httpError(400, 'סטטוס לא מוכר');
  const list = (ids || []).map(Number).filter(Number.isInteger);
  const r = await pool.query(
    `UPDATE quiz_questions SET status = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = ANY($1)`, [list, status, by]);
  return { updated: r.rowCount };
}

module.exports = {
  seedQuestions, startGame, getState, placeBet, answer, finishClock, access, clubInfo,
  adminAccess, adminSetOpen, adminSetUserAccess, adminSetReviewer, adminClubs, isReviewer,
  leaderboard, me, setNickname, flagQuestion, displayName, periodStart,
  adminList, adminSave, adminSetStatus, validateQuestion, questionKey, israelDay,
};
