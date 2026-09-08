/**
 * Unit tests for services/narrationGaps.js — the deterministic half of the
 * narration feature. No API calls, no key, runs in milliseconds.
 *
 *   node server/scripts/testNarrationGaps.js
 *
 * This is the half that decides what the player gets asked, so it is the half
 * that must never regress quietly.
 */

const {
  analyze, sanitize, findGaps, applyDefaults, materializeSuits, toWizardState, reachedStreets,
  inferResult,
} = require('../services/narrationGaps');
const { seatsFor } = require('../services/pokerPositions');
const { applyContradictionFix, seatsFromActingOrder } = require('../services/narrationGaps');

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

const card = (rank, suit = null) => ({ rank, suit });

// A hand with everything the five hard requirements need, for tests that want
// to vary exactly one thing.
const complete = () => ({
  game_type: 'tournament',
  blind_sb: 100, blind_bb: 200,
  hero_position: 'BTN',
  hero_cards: [card('A', 's'), card('K', 'h')],
  streets: { preflop: { actions: [{ actor: 'hero', action: 'bet', amount: 500 }] } },
});

// ── Gaps: exactly the five blockers, nothing more ────────────────────────────

t('יד מלאה — אפס פערים', () => {
  eq(findGaps(sanitize(complete()).clean).map(g => g.field), []);
});

t('החוסרים החוסמים מזוהים — וסוג המשחק כבר לא אחד מהם', () => {
  const g = findGaps(sanitize({}).clean).map(x => x.field);
  eq(g.sort(), ['blinds', 'hero_cards', 'hero_position', 'preflop_actions'].sort(),
    'סוג משחק מוגדר כטורניר כברירת מחדל, ולכן נשאלים בליינדים ולא סוג המשחק');
});

t('סוג משחק לא נשאל אף פעם — נופל לטורניר ומסומן', () => {
  const a = analyze({
    blind_sb: 100, blind_bb: 200, hero_position: 'BTN',
    hero_cards: [card('A', 's'), card('K', 'h')],
    streets: { preflop: { actions: [{ actor: 'hero', action: 'bet', amount: 600 }] } },
  });
  eq(a.gaps.filter(g => g.field === 'game_type'), []);
  eq(a.state.game_type, 'tournament');
  ok(a.state._inferred.some(i => i.field === 'game_type'),
    'ברירת המחדל חייבת להיות מסומנת — כרטיס האישור צובע אותה ומאפשר לתקן');
  ok(a.ready);
});

t('סוג משחק מפורש גובר על ברירת המחדל', () => {
  const a = analyze({
    game_type: 'cash', cash_stakes: '1/2', hero_position: 'BTN',
    hero_cards: [card('A', 's'), card('K', 'h')],
    streets: { preflop: { actions: [{ actor: 'hero', action: 'bet', amount: 6 }] } },
  });
  eq(a.state.game_type, 'cash');
  ok(!a.state._inferred.some(i => i.field === 'game_type'), 'לא הונח — נאמר');
});

t('בליינדים נשאלים רק בטורניר, סטייקים רק בקאש', () => {
  const tour = findGaps(sanitize({ game_type: 'tournament' }).clean).map(x => x.field);
  ok(tour.includes('blinds') && !tour.includes('cash_stakes'), 'טורניר צריך בליינדים');
  const cash = findGaps(sanitize({ game_type: 'cash_online' }).clean).map(x => x.field);
  ok(cash.includes('cash_stakes') && !cash.includes('blinds'), 'קאש צריך סטייקים');
});

t('שדות אופציונליים לעולם לא נחשבים פער', () => {
  // The whole product decision in one assertion: no ante, no stacks, no
  // opponent names, no result, no suits — and still zero questions.
  const g = findGaps(sanitize({
    ...complete(),
    hero_cards: [card('Q'), card('Q')], // suits unknown
  }).clean);
  eq(g.map(x => x.field), [], 'ערימות/אנטה/שמות/תוצאה/צבעים חייבים להיות מדלגים');
});

t('תוצאה חסרה אף פעם לא חוסמת — נשמרת כנקודת החלטה', () => {
  const a = analyze(complete());
  eq(a.gaps.map(g => g.field), []);
  eq(a.state.result, 'unknown');
  ok(a.ready, 'יד בלי תוצאה חייבת להיות מוכנה לשמירה');
});

t('בורד חלקי ברחוב שהיד הגיעה אליו — כן פער', () => {
  const s = { ...complete(), streets: {
    ...complete().streets,
    flop: { board: [card('A', 's'), card('7', 'd')], actions: [{ actor: 'hero', action: 'check' }] },
  } };
  const g = findGaps(sanitize(s).clean);
  eq(g.map(x => x.field), ['flop_board'], 'פלופ של 2 קלפים יתרנדר שגוי');
});

t('רחוב שהיד לא הגיעה אליו — לא פער', () => {
  eq(reachedStreets(sanitize(complete()).clean), ['preflop']);
  eq(findGaps(sanitize(complete()).clean).filter(g => g.field.endsWith('_board')), []);
});

t('רחובות עוקבים — טרן בלי פלופ לא נחשב שהיד הגיעה לטרן', () => {
  const s = { ...complete(), streets: {
    preflop: complete().streets.preflop,
    turn: { board: [card('9')], actions: [] },
  } };
  eq(reachedStreets(sanitize(s).clean), ['preflop']);
});

// ── Sanitizer: the only safety net, since createHand validates almost nothing ─

t('ערכים לא חוקיים נזרקים ומדווחים, לא מגיעים ל-DB', () => {
  const { clean, dropped } = sanitize({
    game_type: 'PLO',
    hero_position: 'BUTTON',
    hero_cards: [card('A', 's'), { rank: '10', suit: 'd' }],
    result: 'maybe',
    streets: { preflop: { actions: [
      { actor: 'hero', action: 'raise', amount: 300 },
      { actor: 'hero', action: 'call', amount: 300 },
    ] } },
  });
  eq(clean.game_type, undefined, 'PLO אינו סוג משחק נתמך');
  eq(clean.hero_position, undefined, '"BUTTON" אינו BTN');
  eq(clean.hero_cards.length, 1, 'rank "10" חייב ליפול — הקידוד הוא T');
  eq(clean.result, undefined);
  eq(clean.streets.preflop.actions.length, 1, '"raise" אינו ערך חוקי באפליקציה');
  ok(dropped.length >= 5, `ציפינו לדיווח על כל הפריטים שנזרקו, קיבלנו ${dropped.length}`);
});

t('amount: מספר או אחוז-קופה בלבד, אחרת null', () => {
  const { clean } = sanitize({ streets: { flop: { actions: [
    { actor: 'hero', action: 'bet', amount: '75%' },
    { actor: 'hero', action: 'bet', amount: '300' },
    { actor: 'hero', action: 'bet', amount: 'הרבה' },
  ] } } });
  eq(clean.streets.flop.actions.map(a => a.amount), ['75%', 300, null]);
});

// ── Defaults ─────────────────────────────────────────────────────────────────

t('יריבים נגזרים מהפעולות ומקבלים מושבים בלי התנגשות', () => {
  const s = applyDefaults(sanitize({
    ...complete(),
    streets: { preflop: { actions: [
      { actor: 'UTG', action: 'bet', amount: 500 },
      { actor: 'יוסי', action: 'call' },
      { actor: 'hero', action: 'three-bet', amount: 1500 },
    ] } },
  }).clean);
  eq(s.opponents.map(o => o.label).sort(), ['UTG', 'יוסי']);
  const seats = [s.hero_position, ...s.opponents.map(o => o.position)];
  eq(new Set(seats).size, seats.length, 'שני שחקנים לא יכולים לשבת באותו מושב');
  ok(s.opponents.find(o => o.label === 'UTG').position === 'UTG', 'ליבל שהוא עמדה שומר עליה');
});

t('players_count גדול מספיק שכל מושב בשימוש באמת קיים בשולחן', () => {
  // The old bug: a seat was handed out that the table size does not contain, so
  // PositionSelector never offered it back and the hand could not be edited.
  const s = applyDefaults(sanitize({ ...complete(), hero_position: 'CO',
    streets: { preflop: { actions: [{ actor: 'HJ', action: 'bet', amount: 300 }] } } }).clean);
  const seats = seatsFor(s.players_count);
  for (const p of [s.hero_position, ...s.opponents.map(o => o.position)]) {
    ok(seats.includes(p), `${p} לא קיים בשולחן של ${s.players_count}: ${seats.join(' ')}`);
  }
});

t('מושב שמחייב שולחן גדול מרים את players_count', () => {
  // LJ does not exist below seven-handed, so a hand with an LJ in it is at
  // least seven-handed no matter how few players were named.
  const s = applyDefaults(sanitize({ ...complete(), hero_position: 'LJ' }).clean);
  ok(s.players_count >= 7, `LJ מחייב 7+, קיבלנו ${s.players_count}`);
  ok(seatsFor(s.players_count).includes('LJ'));
});

t('MP+1 מחייב שולחן מלא של 10', () => {
  const s = applyDefaults(sanitize({ ...complete(), hero_position: 'MP+1' }).clean);
  eq(s.players_count, 10);
});

t('players_count נגזר מהיריבים ולא נשאל בנפרד', () => {
  const s = applyDefaults(sanitize({ ...complete(),
    players_count: 99, // a contradictory value the model might emit
    streets: { preflop: { actions: [{ actor: 'א', action: 'bet' }, { actor: 'ב', action: 'call' }] } },
  }).clean);
  eq(s.players_count, 3, 'הירו + 2 יריבים');
});

t('כל ברירת מחדל שהומצאה מסומנת ב-_inferred', () => {
  const s = applyDefaults(sanitize(complete()).clean);
  const fields = s._inferred.map(i => i.field);
  ok(fields.includes('ante') && fields.includes('result') && fields.includes('hero_stack'),
    `כרטיס האישור חייב לדעת מה נוחש: ${JSON.stringify(fields)}`);
});

// ── Seat collisions ──────────────────────────────────────────────────────────

t('עמדת הירו מתנגשת עם יריב שנקבע — נזרקת ונשאלת', () => {
  // The opponents' seats are stated outright; the hero's is the one the model
  // derives and gets wrong. Asking beats double-booking a chair.
  const a = analyze({
    ...complete(), hero_position: 'BB',
    opponents: [{ label: 'Rosco780', position: 'BB' }],
  });
  eq(a.state.hero_position, undefined, 'המושב הנגזר נמחק לגמרי');
  ok(a.gaps.some(g => g.field === 'hero_position'), JSON.stringify(a.gaps.map(g => g.field)));
  ok(a.dropped.some(d => /כבר תפוסה/.test(d)), JSON.stringify(a.dropped));
});

t('שני יריבים באותו מושב — סתירה', () => {
  const c = analyze({
    ...complete(),
    opponents: [{ label: 'א', position: 'CO' }, { label: 'ב', position: 'CO' }],
  }).contradictions;
  ok(c.some(x => /באותו מקום/.test(x.description)), JSON.stringify(c));
});

t('מושבים שונים — אין סתירה', () => {
  eq(analyze({
    ...complete(), hero_position: 'BTN',
    opponents: [{ label: 'Rosco780', position: 'BB' }, { label: 'tomBBaa', position: 'SB' }],
  }).contradictions, []);
});

t('מושבים שברירת המחדל חילקה לא נחשבים התנגשות', () => {
  // Those seats are ours, not the player's — flagging them would be flagging
  // our own bookkeeping back at them.
  eq(analyze({
    ...complete(),
    streets: { preflop: { actions: [
      { actor: 'א', action: 'bet', amount: 300 }, { actor: 'ב', action: 'call' },
    ] } },
  }).contradictions, []);
});

// ── Stated table size vs stated seats ────────────────────────────────────────

t('עמדה שלא קיימת בגודל השולחן שנמסר — סתירה', () => {
  const c = analyze({ ...complete(), players_count: 6, hero_position: 'UTG+1' }).contradictions;
  ok(c.some(x => x.field === 'players_count'), JSON.stringify(c));
});

t('אותה עמדה בשולחן שמכיל אותה — תקין', () => {
  eq(analyze({ ...complete(), players_count: 9, hero_position: 'UTG+1' }).contradictions, []);
});

t('LJ בשולחן של 6 — סתירה; בשולחן של 7 — תקין', () => {
  ok(analyze({ ...complete(), players_count: 6, hero_position: 'LJ' }).contradictions.length > 0);
  eq(analyze({ ...complete(), players_count: 7, hero_position: 'LJ' }).contradictions, []);
});

t('גודל שולחן שנמסר נשמר כשהוא מספיק גדול', () => {
  eq(analyze({ ...complete(), players_count: 9 }).state.players_count, 9,
    'שולחן של 9 עם שחקן אחד מוזכר הוא עדיין שולחן של 9');
});

t('גודל שולחן לא הגיוני נזרק ומדווח', () => {
  const { clean, dropped } = sanitize({ ...complete(), players_count: 99 });
  eq(clean.players_count, undefined);
  ok(dropped.some(d => /מספר שחקנים/.test(d)), JSON.stringify(dropped));
});

// ── Seats from acting order (foreign clients name seats differently) ─────────

// The real 8-handed 7XL hand, #TM6362116611. That client labels the seats
// UTG / MP / MP1 / CO, which in this app's vocabulary are UTG / LJ / HJ / CO.
const sevenXlHand = () => ({
  blind_sb: 3500, blind_bb: 7000,
  hero_position: 'UTG+1',
  hero_cards: [card('K', 'h'), card('T', 'd')],
  opponents: [
    { label: 'MikeBillions', position: 'UTG' },
    { label: 'timoisablue', position: 'MP' },
    { label: 'pokerarena', position: 'MP1' },
    { label: 'EpicStation', position: 'CO' },
    { label: 'Charles', position: 'BTN' },
    { label: 'tomBBaa', position: 'SB' },
    { label: 'Rosco780', position: 'BB' },
  ],
  streets: { preflop: { actions: [
    { actor: 'MikeBillions', action: 'fold' },
    { actor: 'hero', action: 'bet', amount: 14000 },
    { actor: 'timoisablue', action: 'fold' },
    { actor: 'pokerarena', action: 'fold' },
    { actor: 'EpicStation', action: 'fold' },
    { actor: 'Charles', action: 'call', amount: 14000 },
    { actor: 'tomBBaa', action: 'fold' },
    { actor: 'Rosco780', action: 'fold' },
  ] } },
});

t('שמות עמדות של לקוח זר מתורגמים לפי סדר הפעולות', () => {
  const a = analyze(sevenXlHand());
  eq(a.state.players_count, 8);
  eq(a.state.hero_position, 'MP', 'הירו פועל שני בשולחן של 8');
  const seat = Object.fromEntries(a.state.opponents.map(o => [o.label, o.position]));
  eq(seat.MikeBillions, 'UTG');
  eq(seat.timoisablue, 'LJ', '7XL קורא לזה MP — אצלנו זו LJ');
  eq(seat.pokerarena, 'HJ', '7XL קורא לזה MP1 — אצלנו זו HJ');
  eq(seat.EpicStation, 'CO');
  eq(seat.tomBBaa, 'SB');
  eq(seat.Rosco780, 'BB');
  eq(a.contradictions, [], 'אחרי התרגום אין שום סתירה');
});

t('כל מושב שהוזז מדווח — לא משנים בשקט', () => {
  const a = analyze(sevenXlHand());
  const note = a.dropped.find(d => /סדר הפעולות/.test(d));
  ok(note, JSON.stringify(a.dropped));
  ok(/timoisablue/.test(note) && /pokerarena/.test(note), note);
});

t('סדר פעולות משובש נדחה — הבליינדים והבאטן מסגירים אותו', () => {
  // The vision step occasionally returns the preflop actions shuffled. Applied
  // blindly that reseats the whole table confidently and wrongly, so the order
  // is checked against the seats every client names the same way.
  const h = sevenXlHand();
  h.streets.preflop.actions = ['pokerarena', 'hero', 'EpicStation', 'tomBBaa',
    'Rosco780', 'Charles', 'MikeBillions', 'timoisablue']
    .map(a => ({ actor: a, action: 'fold' }));
  eq(seatsFromActingOrder(h), null);

  // And nothing is quietly rewritten as a result.
  const a = analyze(h);
  eq(a.dropped.filter(d => /סדר הפעולות/.test(d)), []);
});

t('רשימה חלקית לא ממופה מחדש — היא תמציא שולחן', () => {
  const partial = {
    ...complete(),
    streets: { preflop: { actions: [
      { actor: 'UTG', action: 'bet', amount: 300 },
      { actor: 'hero', action: 'call' },
      { actor: 'x', action: 'fold' },
    ] } },
  };
  eq(seatsFromActingOrder(partial), null);
});

t('גודל שולחן לבדו לא מספיק — בלי תוויות אין איך לאמת את הסדר', () => {
  // Reading a hand out of a screenshot is not reliable enough to trust an
  // order nothing can check: the same image returned its preflop actions
  // shuffled on some runs, and applying that reseats the whole table wrongly.
  const actors = ['a', 'hero', 'b', 'c', 'd', 'e', 'f', 'g']
    .map(x => ({ actor: x, action: 'fold' }));
  eq(seatsFromActingOrder({ players_count: 8, streets: { preflop: { actions: actors } } }), null);
});

t('תווית חד-משמעית אחת לא מספיקה, שתיים כן', () => {
  const actors = ['a', 'hero', 'b', 'c', 'd', 'e', 'f', 'g']
    .map(x => ({ actor: x, action: 'fold' }));
  const base = { players_count: 8, streets: { preflop: { actions: actors } } };
  eq(seatsFromActingOrder({ ...base, opponents: [{ label: 'f', position: 'SB' }] }), null);

  const map = seatsFromActingOrder({ ...base,
    opponents: [{ label: 'f', position: 'SB' }, { label: 'g', position: 'BB' }] });
  ok(map, 'שתי תוויות שמסכימות עם הסדר — אפשר למפות');
  eq(map.get('a'), 'UTG');
  eq(map.get('hero'), 'MP');
});

t('בלי אף ראיה לשלמות — לא נוגעים', () => {
  const actors = ['a', 'b', 'c', 'd'].map(x => ({ actor: x, action: 'fold' }));
  eq(seatsFromActingOrder({ streets: { preflop: { actions: actors } } }), null);
});

t('עמדות נכונות כבר — המיפוי לא הורס אותן', () => {
  const clean9 = {
    ...complete(),
    hero_position: 'LJ',
    opponents: [
      { label: 'a', position: 'UTG' }, { label: 'b', position: 'UTG+1' },
      { label: 'c', position: 'MP' }, { label: 'd', position: 'HJ' },
      { label: 'e', position: 'CO' }, { label: 'f', position: 'BTN' },
      { label: 'g', position: 'SB' }, { label: 'h', position: 'BB' },
    ],
    streets: { preflop: { actions: [
      { actor: 'a', action: 'fold' }, { actor: 'b', action: 'fold' },
      { actor: 'c', action: 'fold' }, { actor: 'hero', action: 'bet', amount: 600 },
      { actor: 'd', action: 'fold' }, { actor: 'e', action: 'fold' },
      { actor: 'f', action: 'fold' }, { actor: 'g', action: 'fold' },
      { actor: 'h', action: 'fold' },
    ] } },
  };
  const a = analyze(clean9);
  eq(a.state.hero_position, 'LJ');
  eq(a.state.players_count, 9);
  eq(a.dropped.filter(d => /סדר הפעולות/.test(d)), [], 'אין מה לדווח כשכלום לא זז');
});

// ── Suggested repairs ────────────────────────────────────────────────────────

// The exact shape the site owner hit: the note said "they check to me, I bet 5",
// and the parser put the bet on an opponent and the check on the hero.
const misorderedFlop = () => ({
  ...complete(),
  streets: {
    preflop: { actions: [{ actor: 'hero', action: 'call', amount: 2500 }] },
    flop: {
      board: [card('A', 's'), card('7', 'd'), card('8', 's')],
      actions: [
        { actor: 'יריב 1', action: 'bet', amount: 5000 },
        { actor: 'יריב 2', action: 'call' },
        { actor: 'hero', action: 'check' },
      ],
    },
  },
});

t('צ׳ק מול הימור — מוצע תיקון, והוא באמת פותר', () => {
  const a = analyze(misorderedFlop());
  const c = a.contradictions.find(x => /צ׳ק/.test(x.description));
  ok(c && c.fix, `ציפינו להצעת תיקון: ${JSON.stringify(a.contradictions)}`);
  eq(c.fix.kind, 'move_before');

  const after = analyze(applyContradictionFix(a.state, c.fix));
  eq(after.contradictions, [], 'התיקון חייב באמת לאפס את הסתירה');
  // Nothing is thrown away — the actions are the same, only reordered.
  eq(after.state.streets.flop.actions.length, 3);
  eq(after.state.streets.flop.actions[0].actor, 'hero');
});

t('פולד בלי הימור — מוצע להפוך לצ׳ק', () => {
  const a = analyze({ ...complete(), streets: {
    preflop: complete().streets.preflop,
    flop: { board: [card('A', 's'), card('7', 'd'), card('2', 'c')], actions: [
      { actor: 'hero', action: 'check' },
      { actor: 'יריב 1', action: 'fold' },
    ] },
  } });
  const c = a.contradictions.find(x => x.fix?.kind === 'change_action');
  ok(c, JSON.stringify(a.contradictions));
  eq(analyze(applyContradictionFix(a.state, c.fix)).contradictions, []);
});

t('פעולה כפולה — מוצע להסיר אותה', () => {
  const a = analyze({ ...complete(), streets: { preflop: { actions: [
    { actor: 'hero', action: 'bet', amount: 300 },
    { actor: 'hero', action: 'call' },
  ] } } });
  const c = a.contradictions.find(x => x.fix?.kind === 'remove_action');
  ok(c, JSON.stringify(a.contradictions));
  const after = analyze(applyContradictionFix(a.state, c.fix));
  eq(after.state.streets.preflop.actions.length, 1);
});

t('עמדה שלא קיימת בשולחן — מוצע להגדיל את השולחן', () => {
  const a = analyze({ ...complete(), players_count: 6, hero_position: 'LJ' });
  const c = a.contradictions.find(x => x.fix?.kind === 'set_players_count');
  ok(c, JSON.stringify(a.contradictions));
  eq(c.fix.players_count, 7, 'LJ קיימת מ-7 שחקנים');
  eq(analyze(applyContradictionFix(a.state, c.fix)).contradictions, []);
});

t('תיקון לא מופעל מעצמו — רק כשקוראים לו', () => {
  // Every repair rewrites something the player told us, so nothing may happen
  // without a deliberate tap.
  const a = analyze(misorderedFlop());
  eq(a.state.streets.flop.actions[0].actor, 'יריב 1', 'המצב נשאר כפי שסופר');
  ok(a.ready, 'וסתירה עדיין לא חוסמת שמירה');
});

t('applyContradictionFix בלי תיקון מחזיר את המצב כמו שהוא', () => {
  const st = analyze(complete()).state;
  eq(applyContradictionFix(st, null), st);
});

// ── Board street tags ────────────────────────────────────────────────────────

t('בורד בלי תגית רחוב — הרחוב נגזר מהסדר', () => {
  // Seen in the wild: all five cards returned correctly with every `street`
  // omitted, which used to empty the board completely.
  const { clean } = sanitize({ board: [
    card('4', 'c'), card('9', 'd'), card('Q', 's'), card('J', 's'), card('Q', 'd'),
  ] });
  eq(clean.streets.flop.board.map(c => c.rank), ['4', '9', 'Q']);
  eq(clean.streets.turn.board.map(c => c.rank), ['J']);
  eq(clean.streets.river.board.map(c => c.rank), ['Q']);
});

t('תגיות רחוב שכן נמסרו גוברות על הסדר', () => {
  const { clean } = sanitize({ board: [
    { ...card('J', 's'), street: 'turn' },
    { ...card('4', 'c'), street: 'flop' },
  ] });
  eq(clean.streets.turn.board.map(c => c.rank), ['J'], 'לא להתעלם מתגית מפורשת');
  eq(clean.streets.flop.board.map(c => c.rank), ['4']);
});

t('בורד חלקי בלי תגיות — רק הפלופ מתמלא', () => {
  const { clean } = sanitize({ board: [card('4', 'c'), card('9', 'd'), card('Q', 's')] });
  eq(clean.streets.flop.board.length, 3);
  eq(clean.streets.turn.board, []);
});

// ── Chip sizing: asked, never assumed ────────────────────────────────────────

const sizingCase = (bb, amounts, answers = {}) => analyze({
  ...complete(), blind_sb: bb / 2, blind_bb: bb,
  streets: { preflop: { actions: amounts.map(a => ({ actor: 'hero', action: 'bet', amount: a })) } },
}, answers);

t('כל הסכומים קטנים מהבליינד — נשאלת שאלה, לא מנוחשת תשובה', () => {
  const a = sizingCase(2000, [2.5, 5, 20]);
  const gap = a.gaps.find(g => g.field === 'amount_scale');
  ok(gap, `ציפינו לשאלה על קנה המידה: ${JSON.stringify(a.gaps.map(g => g.field))}`);
  ok(gap.direct, 'זו שאלה חשבונית — נענית ישירות ולא חוזרת דרך המודל');
  eq(gap.options.map(o => o.value), ['thousands', 'bb', 'literal']);
  ok(gap.allowCustom, 'חייבת להיות גם הזנה ידנית של מכפיל');
  // Nothing is touched until the player answers.
  eq(a.state.streets.preflop.actions.map(x => x.amount), [2.5, 5, 20]);
});

t('השאלה מציגה את המספרים של השחקן עצמו', () => {
  const gap = sizingCase(2000, [2.5, 5]).gaps.find(g => g.field === 'amount_scale');
  ok(/2,500/.test(gap.options[0].label), `חייב להראות מה יוצא: ${gap.options[0].label}`);
  ok(/2\.5/.test(gap.options[2].label), gap.options[2].label);
});

t('תשובה "באלפים" מחילה את ההכפלה ומסירה את השאלה', () => {
  const a = sizingCase(2000, [2.5, 5, 20], { amount_scale: 'thousands' });
  eq(a.state.streets.preflop.actions.map(x => x.amount), [2500, 5000, 20000]);
  eq(a.gaps.filter(g => g.field === 'amount_scale'), []);
});

t('מכפיל שהוזן ידנית מוחל', () => {
  // Neither offered reading has to be right — a typed factor is the escape.
  const a = sizingCase(2000, [2.5, 5], { amount_scale: '100' });
  eq(a.state.streets.preflop.actions.map(x => x.amount), [250, 500]);
  eq(a.gaps.filter(g => g.field === 'amount_scale'), []);
});

t('תשובה "בדיוק ככה" משאירה את המספרים ומסירה את השאלה', () => {
  const a = sizingCase(2000, [2.5, 5, 20], { amount_scale: 'literal' });
  eq(a.state.streets.preflop.actions.map(x => x.amount), [2.5, 5, 20]);
  eq(a.gaps.filter(g => g.field === 'amount_scale'), []);
});

t('סכומים סבירים — אין שאלה בכלל', () => {
  eq(sizingCase(2000, [4000, 14000, 47520]).gaps.filter(g => g.field === 'amount_scale'), []);
});

t('סכום אחד גדול — לא שואלים, השחקן כתב צ׳יפים אמיתיים', () => {
  eq(sizingCase(2000, [5, 47520]).gaps.filter(g => g.field === 'amount_scale'), []);
});

t('קאש 1/2 — "הימרתי 5" זה באמת 5, בלי שאלה', () => {
  const a = analyze({
    game_type: 'cash', cash_stakes: '1/2', hero_position: 'BTN',
    hero_cards: [card('A', 's'), card('K', 'h')],
    streets: { preflop: { actions: [{ actor: 'hero', action: 'bet', amount: 5 }] } },
  });
  eq(a.gaps.filter(g => g.field === 'amount_scale'), [], 'בלי בליינדים בצ׳יפים אין קנה מידה לתהות עליו');
});

// ── Preflop opening positions ────────────────────────────────────────────────

const openerCase = (heroPos, actions, opponents = []) => analyze({
  hero_position: heroPos,
  opponents,
  streets: { preflop: { actions } },
}).contradictions;

t('פתיחה מ-UTG — תקין', () => {
  eq(openerCase('UTG', [{ actor: 'hero', action: 'bet', amount: 300 }]), []);
});

t('פתיחה מ-BTN — תקין', () => {
  eq(openerCase('BTN', [{ actor: 'hero', action: 'bet', amount: 300 }]), []);
});

t('פתיחה מה-BB בלי לימפים — סתירה, היד הייתה נגמרת', () => {
  const c = openerCase('BB', [
    { actor: 'UTG', action: 'fold' },
    { actor: 'hero', action: 'bet', amount: 300 },
  ], [{ label: 'UTG', position: 'UTG' }]);
  ok(c.some(x => /פותח ראשון/.test(x.description)), JSON.stringify(c));
});

t('פתיחה מה-SB כשכולם קיפלו — תקין, זו גניבה', () => {
  eq(openerCase('SB', [
    { actor: 'UTG', action: 'fold' },
    { actor: 'CO', action: 'fold' },
    { actor: 'hero', action: 'bet', amount: 300 },
  ], [{ label: 'UTG', position: 'UTG' }, { label: 'CO', position: 'CO' }]), []);
});

t('פתיחה מה-SB כששחקן עוד ביד — סתירה', () => {
  const c = openerCase('SB', [
    { actor: 'CO', action: 'bet', amount: 300 },
    { actor: 'hero', action: 'bet', amount: 900 },
  ], [{ label: 'CO', position: 'CO' }]);
  // The CO opened first here, so the SB action is a three-bet, not an open —
  // what must NOT happen is flagging the legitimate CO open.
  ok(!c.some(x => /CO.*פותח ראשון/.test(x.description)), JSON.stringify(c));
});

t('רייז מה-SB אחרי לימפים — תקין', () => {
  eq(openerCase('SB', [
    { actor: 'UTG', action: 'limp' },
    { actor: 'MP', action: 'limp' },
    { actor: 'hero', action: 'bet', amount: 900 },
  ], [{ label: 'UTG', position: 'UTG' }, { label: 'MP', position: 'MP' }]), []);
});

t('רייז מה-BB אחרי לימפים — תקין', () => {
  eq(openerCase('BB', [
    { actor: 'UTG', action: 'limp' },
    { actor: 'hero', action: 'bet', amount: 900 },
  ], [{ label: 'UTG', position: 'UTG' }]), []);
});

t('עמדה שלא נמסרה — לא ממציאים סתירה', () => {
  // applyDefaults hands out seats; flagging one we invented would be circular.
  eq(analyze({ streets: { preflop: { actions: [
    { actor: 'יריב 1', action: 'bet', amount: 300 },
  ] } } }).contradictions, []);
});

t('סתירת פתיחה לא חוסמת שמירה', () => {
  const a = analyze({
    ...complete(), hero_position: 'BB',
    streets: { preflop: { actions: [
      { actor: 'UTG', action: 'fold' },
      { actor: 'hero', action: 'bet', amount: 300 },
    ] } },
    opponents: [{ label: 'UTG', position: 'UTG' }],
  });
  ok(a.contradictions.length > 0);
  ok(a.ready, 'סתירה מוצגת לאישור, לא חוסמת');
});

// ── Result inference: computed from actions, not asked of the model ──────────

t('הירו קיפל → הפסיד', () => {
  const r = inferResult({ streets: {
    preflop: { actions: [{ actor: 'UTG', action: 'bet', amount: 300 }, { actor: 'hero', action: 'call' }] },
    flop: { actions: [{ actor: 'UTG', action: 'bet', amount: 800 }, { actor: 'hero', action: 'fold' }] },
  } });
  eq(r.result, 'lost');
});

t('כל היריבים קיפלו → הירו לקח את הקופה', () => {
  const r = inferResult({ streets: { preflop: { actions: [
    { actor: 'hero', action: 'bet', amount: 500 },
    { actor: 'UTG', action: 'fold' },
    { actor: 'BB', action: 'fold' },
  ] } } });
  eq(r.result, 'won');
});

t('יריב אחד עדיין ביד → לא מנחשים, נשאר unknown', () => {
  const r = inferResult({ streets: { preflop: { actions: [
    { actor: 'hero', action: 'bet', amount: 500 },
    { actor: 'UTG', action: 'fold' },
    { actor: 'BB', action: 'call' },
  ] } } });
  eq(r.result, 'unknown', 'שואודאון אינו ניתן להכרעה מרשימת הפעולות');
});

t('יריב שקיפל אחרי שקרא קודם — נספר לפי הפעולה האחרונה שלו', () => {
  const r = inferResult({ streets: {
    preflop: { actions: [{ actor: 'hero', action: 'bet', amount: 500 }, { actor: 'BB', action: 'call' }] },
    flop: { actions: [{ actor: 'hero', action: 'bet', amount: 900 }, { actor: 'BB', action: 'fold' }] },
  } });
  eq(r.result, 'won');
});

t('תוצאה מפורשת מהנרטיב גוברת על ההיסק', () => {
  // The narration said "split" — the action list must not overwrite that.
  const s = applyDefaults(sanitize({ ...complete(), result: 'split' }).clean);
  eq(s.result, 'split');
});

t('אין פעולות בכלל → unknown, בלי לזרוק', () => {
  eq(inferResult({ streets: {} }).result, 'unknown');
});

// ── Structural contradictions ────────────────────────────────────────────────

t('קיפול בפלופ בלי הימור פתוח — סתירה', () => {
  // The exact fixture the model extracted perfectly but never flagged.
  const c = analyze({ streets: { flop: { board: [], actions: [
    { actor: 'hero', action: 'check' },
    { actor: 'יריב 1', action: 'check' },
    { actor: 'hero', action: 'fold' },
  ] } } }).contradictions;
  ok(c.length >= 1 && /מקפל/.test(c[0].description), JSON.stringify(c));
});

t('קיפול פרה-פלופ תמיד חוקי — הביג בליינד הוא הימור חי', () => {
  const c = analyze({ streets: { preflop: { actions: [
    { actor: 'UTG', action: 'fold' },
    { actor: 'hero', action: 'fold' },
  ] } } }).contradictions;
  eq(c, [], 'פולד פרה-פלופ אינו סתירה');
});

t('צ׳ק מול הימור פתוח — סתירה', () => {
  const c = analyze({ streets: { turn: { board: [], actions: [
    { actor: 'hero', action: 'bet', amount: 500 },
    { actor: 'יריב 1', action: 'check' },
  ] } } }).contradictions;
  ok(c.some(x => /צ׳ק/.test(x.description)), JSON.stringify(c));
});

t('אותו שחקן פועל פעמיים ברצף — סתירה', () => {
  const c = analyze({ streets: { preflop: { actions: [
    { actor: 'hero', action: 'bet', amount: 300 },
    { actor: 'hero', action: 'call' },
  ] } } }).contradictions;
  ok(c.some(x => /פעמיים/.test(x.description)), JSON.stringify(c));
});

t('אותו שחקן פועל בסוף רחוב ובתחילת הבא — חוקי', () => {
  // Legitimate: last to act on the flop can be first to act on the turn.
  const c = analyze({ streets: {
    flop: { board: [], actions: [{ actor: 'hero', action: 'check' }] },
    turn: { board: [], actions: [{ actor: 'hero', action: 'bet', amount: 400 }] },
  } }).contradictions;
  eq(c, []);
});

t('יד תקינה לגמרי — אפס סתירות', () => {
  eq(analyze(complete()).contradictions, []);
});

t('סתירה לא חוסמת שמירה — רק מוצגת לאישור', () => {
  const a = analyze({ ...complete(), streets: {
    ...complete().streets,
    flop: { board: [card('A', 's'), card('7', 'd'), card('2', 'c')], actions: [
      { actor: 'hero', action: 'check' },
      { actor: 'יריב 1', action: 'check' },
      { actor: 'hero', action: 'fold' },
    ] },
  } });
  ok(a.contradictions.length > 0, 'הסתירה צריכה להיות מזוהה');
  ok(a.ready, 'אבל היא לא חוסמת — האפליקציה תמיד אפשרה לרשום יד כפי שנזכרה');
});

// ── Suits: nulls must never reach the renderer ───────────────────────────────

t('צבעים חסרים מקבלים ערך — הווידאו לא יודע לצייר null', () => {
  const s = materializeSuits({ ...complete(), hero_cards: [card('Q'), card('Q')],
    streets: { ...complete().streets, flop: { board: [card('A'), card('7'), card('2')], actions: [] } } });
  for (const c of [...s.hero_cards, ...s.streets.flop.board]) {
    ok(['s', 'h', 'd', 'c'].includes(c.suit), `צבע לא תקין: ${JSON.stringify(c)}`);
  }
  eq(new Set(s.hero_cards.map(c => c.suit)).size, 2, 'זוג חייב לקבל שני צבעים שונים');
});

t('"AKs" — אותו צבע לשני הקלפים', () => {
  const s = materializeSuits({ ...complete(),
    hero_cards: [card('A'), card('K')], hero_cards_suited: true });
  eq(s.hero_cards[0].suit, s.hero_cards[1].suit);
});

t('"AKo" — שני צבעים שונים', () => {
  const s = materializeSuits({ ...complete(),
    hero_cards: [card('A'), card('K')], hero_cards_suited: false });
  ok(s.hero_cards[0].suit !== s.hero_cards[1].suit, 'offsuit קיבל צבע זהה');
});

t('קלף שכבר על הבורד לא מוקצה שוב לירו', () => {
  const s = materializeSuits({ ...complete(),
    hero_cards: [card('A'), card('K', 'h')],
    streets: { ...complete().streets, flop: { board: [card('A', 's'), card('A', 'h'), card('2', 'c')], actions: [] } } });
  const all = [...s.hero_cards, ...s.streets.flop.board].map(c => `${c.rank}${c.suit}`);
  eq(new Set(all).size, all.length, `קלף כפול בחפיסה: ${all.join(' ')}`);
});

// ── Adapter into the wizard's shape ──────────────────────────────────────────

t('toWizardState מקנן opponents/streets תחת hand_data', () => {
  const st = toWizardState(applyDefaults(sanitize(complete()).clean));
  ok(st.hand_data && Array.isArray(st.hand_data.opponents), 'opponents חייב לשבת תחת hand_data');
  ok(st.hand_data.streets && st.hand_data.streets.preflop, 'streets חייב לשבת תחת hand_data');
  eq(st.opponents, undefined, 'אסור שיישאר עותק ברמה העליונה');
});

t('toWizardState מייצר בדיוק את המפתחות ש-buildState מייצר', () => {
  // Mirrors HandLoggerWizard.jsx buildState() — if that changes, this fails.
  const st = toWizardState(applyDefaults(sanitize(complete()).clean));
  eq(Object.keys(st).sort(), [
    'ante', 'blind_bb', 'blind_sb', 'cash_stakes', 'game_type', 'hand_data',
    'hero_cards', 'hero_position', 'hero_profit', 'hero_stack', 'notes',
    'players_count', 'result', 'tournament_stage',
  ]);
});

t('analyze על קלט ריק לגמרי לא זורק', () => {
  const a = analyze({});
  ok(!a.ready);
  ok(a.gaps.length > 0);
  toWizardState(a.state); // must not throw
});

console.log(`\n${'─'.repeat(50)}\n${pass} עברו · ${fail} נכשלו\n`);
process.exit(fail ? 1 : 0);
