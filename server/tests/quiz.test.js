// בדיקות לחוקי הצ'יפים של השעשועון — בלי DB
const { test } = require('node:test');
const assert = require('node:assert');
const engine = require('../services/quizEngine');
const config = require('../config/quiz');

test('blinds rise per question; clock blinds rise every 5 questions', () => {
  assert.equal(engine.blindFor('daily', 0), 50);
  assert.equal(engine.blindFor('daily', 9), 400);
  assert.equal(engine.blindFor('daily', 30), 400); // מעבר לטבלה — הבליינד האחרון
  assert.equal(engine.blindFor('clock', 4), 100);
  assert.equal(engine.blindFor('clock', 5), 150);
  assert.equal(engine.blindFor('clock', 999), 800);
  assert.throws(() => engine.blindFor('nope', 0), { status: 400 });
});

test('bet must be between the blind (or the whole stack if smaller) and the stack', () => {
  assert.ok(engine.validateBet(1000, 100, 100).ok);
  assert.ok(engine.validateBet(1000, 100, 1000).ok); // אול-אין
  assert.ok(!engine.validateBet(1000, 100, 99).ok);
  assert.ok(!engine.validateBet(1000, 100, 1001).ok);
  assert.ok(!engine.validateBet(1000, 100, 150.5).ok);
  assert.ok(!engine.validateBet(1000, 100, NaN).ok);
  assert.ok(engine.validateBet(60, 100, 60).ok); // ערימה קטנה מהבליינד — רק אול-אין
  assert.ok(!engine.validateBet(60, 100, 50).ok);
});

test('payout by difficulty, losing costs the bet', () => {
  assert.equal(engine.settle(1000, 200, 1, true), 1200);
  assert.equal(engine.settle(1000, 200, 2, true), 1300);
  assert.equal(engine.settle(1000, 200, 3, true), 1400);
  assert.equal(engine.settle(1000, 200, 3, false), 800);
  assert.equal(engine.settle(1000, 1000, 2, false), 0); // אול-אין שנכשל = הודחת
  assert.equal(engine.settle(1000, 55, 2, true), 1085); // 82.5 → מעוגל ל-85
});

test('all wrong on minimum bets busts the daily set (no points for not knowing)', () => {
  let stack = config.startStack;
  for (let i = 0; i < 10 && stack > 0; i++) {
    const bet = Math.min(stack, engine.blindFor('daily', i));
    stack = engine.settle(stack, bet, 1, false);
  }
  assert.equal(stack, 0);
});

test('seeded shuffle is deterministic per seed (same daily set for everyone)', () => {
  const a = engine.shuffle([1, 2, 3, 4, 5, 6, 7, 8], engine.seededRandom('daily:2026-10-23'));
  const b = engine.shuffle([1, 2, 3, 4, 5, 6, 7, 8], engine.seededRandom('daily:2026-10-23'));
  const c = engine.shuffle([1, 2, 3, 4, 5, 6, 7, 8], engine.seededRandom('daily:2026-10-24'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('pickQuestions follows the difficulty plan, mixes topics, falls back when short', () => {
  const pool = [];
  let id = 1;
  for (const category of ['rules', 'history', 'math']) for (const difficulty of [1, 2, 3]) for (let k = 0; k < 4; k++) pool.push({ id: id++, category, difficulty });
  const plan = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];
  const ids = engine.pickQuestions(pool, plan, { rand: engine.seededRandom('x') });
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  const byId = Object.fromEntries(pool.map((q) => [q.id, q]));
  assert.deepEqual(ids.map((i) => byId[i].difficulty), plan);
  const cats = ids.slice(0, 3).map((i) => byId[i].category);
  assert.equal(new Set(cats).size, 3); // שלוש הקלות — משלושה נושאים שונים

  const onlyEasy = pool.filter((q) => q.difficulty === 1); // אין בינוניות/קשות — לוקח מה שיש
  assert.equal(engine.pickQuestions(onlyEasy, plan).length, 10);
  assert.equal(engine.pickQuestions(onlyEasy.slice(0, 4), plan).length, 4);

  // preferred (לא נראו לאחרונה) מקבלים עדיפות כשיש מספיק מהן
  const preferred = new Set(pool.slice(0, 20).map((q) => q.id));
  assert.ok(engine.pickQuestions(pool, [1, 2], { preferred }).every((i) => preferred.has(i)));
});

test('answer timing with grace, and the share line', () => {
  assert.ok(engine.inTime(0, 20000, 20));
  assert.ok(engine.inTime(0, 20000 + config.graceMs, 20));
  assert.ok(!engine.inTime(0, 20001 + config.graceMs, 20));
  assert.equal(engine.shareLine('CWTC'), '🟩🟥⬜🟩');
});

test('display name hides the family name; question validation', () => {
  const quiz = require('../services/quiz');
  assert.equal(quiz.displayName('ישראל ישראלי'), 'ישראל י.');
  assert.equal(quiz.displayName('Igor', null), 'Igor');
  assert.equal(quiz.displayName('ישראל ישראלי', 'השארק'), 'השארק');
  assert.equal(quiz.displayName(''), 'שחקן');
  assert.equal(quiz.periodStart('quarter', '2026-11-05'), '2026-10-01');
  assert.equal(quiz.periodStart('quarter', '2026-03-31'), '2026-01-01');
  const ok = quiz.validateQuestion({ category: 'rules', difficulty: 2, question: 'ש?', options: ['א', 'ב'], correct: 1 });
  assert.equal(ok.correct, 1);
  assert.throws(() => quiz.validateQuestion({ category: 'rules', difficulty: 2, question: 'ש?', options: ['א', 'א'], correct: 0 }), /כפולות/);
  assert.throws(() => quiz.validateQuestion({ category: 'x', difficulty: 2, question: 'ש?', options: ['א', 'ב'], correct: 0 }), /נושא/);
  assert.throws(() => quiz.validateQuestion({ category: 'rules', difficulty: 2, question: 'ש?', options: ['א', 'ב'], correct: 2 }), /נכונה/);
});
