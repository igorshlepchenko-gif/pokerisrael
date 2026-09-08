/**
 * Position tables — the owner's spec, asserted literally, plus a drift guard
 * between the server copy and its client mirror.
 *
 *   node server/scripts/testPokerPositions.js
 *
 * The literal tables below are the ones the site owner supplied on 2026-09-06.
 * They are written out in full rather than derived, so that if the shrink rule
 * is ever "improved" the spec itself still fails loudly.
 */

const path = require('path');
const fs = require('fs');
const P = require('../services/pokerPositions');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`✅ ${name}`); pass++; }
  catch (e) { console.log(`❌ ${name}\n   ${e.message}`); fail++; }
};
const eq = (got, want, what = '') => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) throw new Error(`${what}\n   ציפינו: ${w}\n   קיבלנו: ${g}`);
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

// ── The spec, exactly as given ───────────────────────────────────────────────

const SPEC = {
  6:  ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
  7:  ['SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO', 'BTN'],
  8:  ['SB', 'BB', 'UTG', 'MP', 'LJ', 'HJ', 'CO', 'BTN'],
  9:  ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'],
  10: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'MP+1', 'LJ', 'HJ', 'CO', 'BTN'],
};

for (const [n, seats] of Object.entries(SPEC)) {
  t(`${n} שחקנים — בדיוק לפי ההגדרה`, () => {
    eq(P.seatsFor(+n), seats);
    eq(P.seatsFor(+n).length, +n, 'מספר המושבים חייב להתאים לגודל השולחן');
  });
}

t('שולחן קטן מוריד מהאמצע, לא מהקצוות', () => {
  // The blinds and the button survive every size — that is the whole rule.
  for (let n = 3; n <= 10; n++) {
    const seats = P.seatsFor(n);
    for (const must of ['SB', 'BB', 'BTN']) {
      ok(seats.includes(must), `${must} חסר בשולחן של ${n}`);
    }
  }
});

t('הד-אפ — הסמול הוא הבאטן, אין מושב באטן נפרד', () => {
  eq(P.seatsFor(2), ['SB', 'BB']);
});

t('גדלים מחוץ לטווח נחתכים ולא זורקים', () => {
  eq(P.seatsFor(99), P.seatsFor(10));
  eq(P.seatsFor(1), P.seatsFor(2));
  eq(P.seatsFor(undefined), P.seatsFor(10));
});

// ── Acting order ─────────────────────────────────────────────────────────────

t('פרה-פלופ מתחיל ב-UTG והבליינדים אחרונים', () => {
  eq(P.preflopOrder(9), ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  eq(P.preflopOrder(6), ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
});

t('פוסט-פלופ מתחיל בסמול ומסתיים בבאטן', () => {
  eq(P.postflopOrder(9), ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN']);
  eq(P.postflopOrder(6), ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']);
});

t('הד-אפ הופך סדר בין הרחובות', () => {
  // The button acts first before the flop and last after it.
  eq(P.preflopOrder(2), ['SB', 'BB']);
  eq(P.postflopOrder(2), ['BB', 'SB']);
});

t('כל סדר פעולה מכיל בדיוק את מושבי השולחן', () => {
  for (let n = 2; n <= 10; n++) {
    eq([...P.preflopOrder(n)].sort(), [...P.seatsFor(n)].sort(), `פרה-פלופ ${n}`);
    eq([...P.postflopOrder(n)].sort(), [...P.seatsFor(n)].sort(), `פוסט-פלופ ${n}`);
  }
});

// ── Helpers used by the gap checker and the UI ───────────────────────────────

t('isValidAt חוסם עמדה שלא קיימת בגודל הזה', () => {
  ok(!P.isValidAt('UTG+1', 6), 'UTG+1 לא קיים בשולחן של 6 — זה בדיוק הבאג הישן');
  ok(!P.isValidAt('LJ', 6), 'LJ מתחיל רק ב-7');
  ok(P.isValidAt('HJ', 6));
  ok(P.isValidAt('CO', 6));
});

t('minPlayersFor — מאיזה גודל המושב קיים', () => {
  eq(P.minPlayersFor('BTN'), 3);
  eq(P.minPlayersFor('HJ'), 6);
  eq(P.minPlayersFor('LJ'), 7);
  eq(P.minPlayersFor('MP'), 8);
  eq(P.minPlayersFor('UTG+1'), 9);
  eq(P.minPlayersFor('MP+1'), 10);
});

t('LJ ו-MP+1 קיימים — לא היו באפליקציה כלל לפני', () => {
  ok(P.ALL_POSITIONS.includes('LJ') && P.ALL_POSITIONS.includes('MP+1'));
  eq(P.ALL_POSITIONS.length, 10);
});

// ── Drift guard between the two copies ───────────────────────────────────────

t('העותק בקליינט זהה לשרת', () => {
  const server = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'pokerPositions.js'), 'utf8');
  const client = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'pokerPositions.js'), 'utf8');

  // Only the header comment and the export statement legitimately differ.
  const strip = (s) => s
    .split(' */\n').slice(1).join(' */\n')
    .replace(/^(module\.exports = |export )/m, 'EXPORT ')
    .replace(/\r\n/g, '\n')
    .trim();

  eq(strip(client), strip(server),
    'הקבצים נפרדו — ערוך את השרת והרץ מחדש את המראה, אל תערוך רק צד אחד');
});

console.log(`\n${'─'.repeat(50)}\n${pass} עברו · ${fail} נכשלו\n`);
process.exit(fail ? 1 : 0);
