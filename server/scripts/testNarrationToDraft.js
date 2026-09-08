/**
 * Tests the client-side handoff adapter (client/src/utils/narrationToDraft.js)
 * against the server's real output, in Node.
 *
 *   node server/scripts/testNarrationToDraft.js
 *
 * This is the seam where a mistake is silent and expensive: the wizard
 * references opponents by numeric `id` (sortedPlayers maps `actor: o.id`, and
 * getRevealedCards compares String(o.id) === String(actor)), while the parser
 * talks in labels. A bad mapping produces actions belonging to nobody — fold
 * tracking, showdown detection and the video all quietly go wrong, with no
 * error anywhere.
 *
 * The adapter is ESM and imports Vite-resolved paths, so it is bundled with the
 * client's own esbuild before being required. Same approach the handPots tests
 * used, since the project has no test runner configured.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..', '..');
const { analyze, toWizardState } = require('../services/narrationGaps');

function buildAdapter() {
  const esbuild = require(path.join(ROOT, 'client', 'node_modules', 'esbuild'));
  const outfile = path.join(os.tmpdir(), `narrationToDraft.${process.pid}.cjs`);
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'client', 'src', 'utils', 'narrationToDraft.js')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  const mod = require(outfile);
  fs.unlinkSync(outfile);
  return mod;
}

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

const { narrationToDraft } = buildAdapter();

// A parsed hand shaped exactly like the server returns it, with two named
// opponents acting across three streets and one of them showing at showdown.
const parsed = {
  game_type: 'tournament',
  blind_sb: 100, blind_bb: 200,
  hero_position: 'MP',
  hero_cards: [{ rank: 'J', suit: 's' }, { rank: 'J', suit: 'h' }],
  opponents: [
    { label: 'יוסי', position: 'CO', stack: 20000, cards: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 's' }] },
    { label: 'דני', position: 'BB', stack: 15000 },
  ],
  actions: [
    { street: 'preflop', actor: 'יוסי', action: 'bet', amount: '500' },
    { street: 'preflop', actor: 'hero', action: 'three-bet', amount: '1500' },
    { street: 'preflop', actor: 'דני', action: 'call' },
    { street: 'flop', actor: 'דני', action: 'check' },
    { street: 'flop', actor: 'hero', action: 'bet', amount: '1800' },
    { street: 'flop', actor: 'יוסי', action: 'fold' },
  ],
  board: [
    { street: 'flop', rank: '7', suit: 'd' },
    { street: 'flop', rank: '2', suit: 'c' },
    { street: 'flop', rank: '9', suit: 'h' },
  ],
  result: 'won',
};

const state = analyze(parsed).state;
const wizardState = toWizardState(state);
const draft = narrationToDraft(wizardState);

const allActions = ['preflop', 'flop', 'turn', 'river']
  .flatMap(st => draft.handData.streets[st].actions || []);

// ── The mapping this file exists to protect ──────────────────────────────────

t('כל שחקן מקבל id מספרי', () => {
  for (const o of draft.opponents) {
    ok(Number.isInteger(o.id), `id לא מספרי: ${JSON.stringify(o)}`);
  }
  eq(new Set(draft.opponents.map(o => o.id)).size, draft.opponents.length, 'id כפול');
});

t('actor בפעולות הוא id, לא ליבל — אחרת האשף מציג שחקן רפאים', () => {
  const ids = new Set(draft.opponents.map(o => o.id));
  for (const a of allActions) {
    ok(a.actor === 'hero' || ids.has(a.actor),
      `actor לא ממופה: ${JSON.stringify(a)} · ids=${[...ids]}`);
  }
});

t('כל ליבל מהנרטיב מגיע ל-id הנכון', () => {
  const byLabel = Object.fromEntries(draft.opponents.map(o => [o.label, o.id]));
  const preflop = draft.handData.streets.preflop.actions;
  eq(preflop[0].actor, byLabel['יוסי'], 'הפותח פרה-פלופ');
  eq(preflop[1].actor, 'hero');
  eq(preflop[2].actor, byLabel['דני']);
  eq(draft.handData.streets.flop.actions[2].actor, byLabel['יוסי'], 'המקפל בפלופ');
});

t('קלפי שואודאון יושבים על היריב, במקום שהאשף קורא ממנו', () => {
  const yossi = draft.opponents.find(o => o.label === 'יוסי');
  eq(yossi.cards, [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 's' }]);
  const dani = draft.opponents.find(o => o.label === 'דני');
  eq(dani.cards, null, 'מי שלא הראה לא מקבל קלפים');
});

// ── Draft shape the wizard hydrates from ─────────────────────────────────────

t('שמות השדות הם של הטיוטה, לא של buildState', () => {
  eq(draft.gameType, 'tournament');
  eq(draft.customSb, '100');
  eq(draft.customBb, '200');
  eq(draft.heroPosition, 'MP');
  eq(draft.heroCards.length, 2);
  ok(draft.handData && draft.handData.streets, 'handData.streets חסר');
  eq(draft.hero_cards, undefined, 'אסור שיישאר שם שדה של השרת');
});

t('נוחת ישר על שלב הסיכום', () => {
  eq(draft.step, 11);
});

t('בליינדים מוכרים נבחרים כ-preset', () => {
  eq(draft.blindPreset, '100/200');
});

t('בליינדים לא מוכרים נשארים custom בלבד', () => {
  const d = narrationToDraft({ ...wizardState, blind_sb: 75, blind_bb: 150 });
  eq(d.blindPreset, '');
  eq(d.customSb, '75');
});

t('פרה-פלופ בלי board — האשף לא מצפה לאחד', () => {
  eq(draft.handData.streets.preflop.board, undefined);
  eq(draft.handData.streets.flop.board.length, 3);
});

t('הנרטיב מוכן מראש — שלב הסיכום לא נפתח ריק', () => {
  ok(typeof draft.narrative === 'string' && draft.narrative.length > 0,
    'נרטיב ריק — HandSummary ייפתח בלי תוכן');
});

t('קאש: stakes במקום בליינדים', () => {
  const d = narrationToDraft({
    ...wizardState, game_type: 'cash', blind_sb: null, blind_bb: null, cash_stakes: '1/2',
  });
  eq(d.stakesPreset, '1/2');
  eq(d.customSb, '');
});

t('showdown מסומן כשמישהו הראה קלפים', () => {
  eq(draft.showShowdown, true);
  eq(draft.handData.showdown.reached, true);
  eq(draft.handData.showdown.opponent_cards.length, 1);
});

t('יד מינימלית לא מפילה את הממיר', () => {
  const minimal = toWizardState(analyze({
    game_type: 'cash', cash_stakes: '1/2', hero_position: 'BTN',
    hero_cards: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }],
    actions: [{ street: 'preflop', actor: 'hero', action: 'bet', amount: '6' }],
  }).state);
  const d = narrationToDraft(minimal);
  ok(d.opponents.length >= 1, 'תמיד צריך להיות לפחות יריב אחד');
  eq(d.step, 11);
});

console.log(`\n${'─'.repeat(50)}\n${pass} עברו · ${fail} נכשלו\n`);
process.exit(fail ? 1 : 0);
