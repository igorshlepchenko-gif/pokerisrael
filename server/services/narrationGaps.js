/**
 * Hand Logger narration — deterministic gap detection, defaults, and the
 * adapter into the wizard's own state shape.
 *
 * WHY THIS IS NOT IN THE LLM PROMPT: fixture runs (scripts/testHandNarration.js,
 * 2026-09-02) showed the model judging completeness inconsistently and, worse,
 * demanding things the product explicitly wants skippable — stack sizes, the
 * suits of a pocket pair, opponent names. Completeness is a closed, checkable
 * question, so it belongs in plain JS where it is testable and where the
 * "skip whatever can be skipped" policy lives in exactly one place.
 *
 * The product rule this file encodes: only five things genuinely block
 * producing a hand. Everything else gets a default and is surfaced on the
 * review card for the player to correct if they care.
 */

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['s', 'h', 'd', 'c'];
const ACTIONS = ['fold', 'check', 'limp', 'call', 'bet', 'three-bet', 'four-bet', 'allin'];
const STREETS = ['preflop', 'flop', 'turn', 'river'];

// Positions come from ONE place — see services/pokerPositions.js for why.
const {
  ALL_POSITIONS, seatsFor, preflopOrder, minPlayersFor, MIN_PLAYERS, MAX_PLAYERS,
} = require('./pokerPositions');
const POSITIONS = new Set(ALL_POSITIONS);

const BOARD_SIZE = { flop: 3, turn: 1, river: 1 };

const isTournament = t => t === 'tournament' || t === 'tournament_online';
const isCash = t => t === 'cash' || t === 'cash_online';

// ── Validation ───────────────────────────────────────────────────────────────
// The server's own createHand validates almost nothing inside hand_data (no
// rank/suit check, no action check), so this is the only safety net there is.

const validCard = c =>
  !!c && typeof c === 'object' &&
  RANKS.includes(c.rank) &&
  (c.suit == null || SUITS.includes(c.suit));

/**
 * Strips anything the model produced that the app cannot represent, rather
 * than letting it reach the DB. Returns {clean, dropped} so the caller can
 * tell the player what was discarded instead of losing it silently.
 */
function sanitize(raw) {
  const dropped = [];
  const e = { ...(raw || {}) };

  if (e.game_type && !['tournament', 'cash', 'tournament_online', 'cash_online'].includes(e.game_type)) {
    dropped.push(`סוג משחק לא מוכר: ${e.game_type}`);
    delete e.game_type;
  }

  if (e.hero_position && !POSITIONS.has(e.hero_position)) {
    dropped.push(`עמדה לא מוכרת: ${e.hero_position}`);
    delete e.hero_position;
  }

  if (Array.isArray(e.hero_cards)) {
    const bad = e.hero_cards.filter(c => !validCard(c));
    if (bad.length) dropped.push(`קלפי הירו לא תקינים: ${JSON.stringify(bad)}`);
    e.hero_cards = e.hero_cards.filter(validCard).slice(0, 2);
  } else if (e.hero_cards != null) {
    delete e.hero_cards;
  }

  e.opponents = (Array.isArray(e.opponents) ? e.opponents : [])
    .filter(o => o && typeof o === 'object')
    .map(o => ({
      label: String(o.label || '').trim() || null,
      position: POSITIONS.has(o.position) ? o.position : null,
      stack: Number.isFinite(+o.stack) ? +o.stack : null,
      // Shown hole cards. Only a complete, valid pair is kept — a half-read
      // showdown would render a one-card hand in the video.
      cards: Array.isArray(o.cards) && o.cards.filter(validCard).length === 2
        ? o.cards.filter(validCard) : null,
    }));

  // The parser returns one flat, sequential action list and one flat board list,
  // each entry labelled with its street (the nested-per-street shape produced a
  // grammar the API rejected as too complex). Regroup into the per-street shape
  // the wizard and the video renderer expect. Accepts the nested shape too, so
  // a hand-written state or an older cached priorState still round-trips.
  const flatActions = Array.isArray(e.actions) ? e.actions : null;
  let flatBoard = Array.isArray(e.board) ? e.board : null;

  // The board is always dealt in one fixed order, so its street is derivable
  // from position and does not need the model's cooperation. Observed: a run
  // that returned all five cards correctly and simply omitted every `street`
  // tag, which silently emptied the whole board. Positional assignment when the
  // tags are absent turns a total loss into no loss at all.
  if (flatBoard && flatBoard.length && !flatBoard.some(c => c && c.street)) {
    const streetByIndex = ['flop', 'flop', 'flop', 'turn', 'river'];
    flatBoard = flatBoard.slice(0, 5).map((c, i) => ({ ...c, street: streetByIndex[i] }));
  }

  const streets = {};
  for (const st of STREETS) {
    const src = (e.streets || {})[st] || {};

    const rawActions = flatActions
      ? flatActions.filter(a => a && a.street === st)
      : (Array.isArray(src.actions) ? src.actions : []);

    const actions = rawActions
      .filter(a => {
        if (!a || !ACTIONS.includes(a.action)) {
          if (a) dropped.push(`פעולה לא חוקית ב-${st}: ${JSON.stringify(a)}`);
          return false;
        }
        return true;
      })
      .map(a => ({
        actor: String(a.actor ?? 'hero'),
        action: a.action,
        // The wizard accepts a number or a "NN%" pot-fraction string; anything
        // else becomes null rather than a NaN that silently breaks pot math.
        amount:
          typeof a.amount === 'string' && /^\d+(\.\d+)?%$/.test(a.amount.trim()) ? a.amount.trim()
          : Number.isFinite(+a.amount) && a.amount !== null && a.amount !== '' ? +a.amount
          : null,
      }));

    const rawBoard = flatBoard
      ? flatBoard.filter(c => c && c.street === st).map(c => ({ rank: c.rank, suit: c.suit ?? null }))
      : (Array.isArray(src.board) ? src.board : []);

    const board = rawBoard.filter(validCard);
    if (st !== 'preflop' && board.length > BOARD_SIZE[st]) board.length = BOARD_SIZE[st];
    streets[st] = st === 'preflop' ? { actions } : { board, actions };
  }
  e.streets = streets;
  // Flat forms are consumed — drop them so the state fed back as priorState has
  // exactly one representation of the hand.
  delete e.actions;
  delete e.board;

  // Foreign clients name seats differently, so believe the acting order over
  // the labels whenever the order is complete enough to trust.
  applyActingOrderSeats(e, msg => dropped.push(msg));

  // A hero seat that collides with a named opponent's is dropped rather than
  // flagged. The opponents' seats are the ones the narration states outright,
  // while the hero's is the one the model is prone to deriving from acting
  // order — and getting wrong. Dropping it turns a silent double-booking into
  // the app's cheapest question.
  if (e.hero_position) {
    const clash = e.opponents.find(o => o.position === e.hero_position);
    if (clash) {
      dropped.push(`עמדת הירו (${e.hero_position}) כבר תפוסה ע"י ${clash.label || 'יריב'} — נשאל עליה`);
      delete e.hero_position;
    }
  }

  if (e.result && !['won', 'lost', 'split', 'unknown'].includes(e.result)) {
    dropped.push(`תוצאה לא מוכרת: ${e.result}`);
    delete e.result;
  }

  // Only a table size in the range the app can represent is worth keeping.
  if (e.players_count != null) {
    const n = +e.players_count;
    if (!Number.isFinite(n) || n < MIN_PLAYERS || n > MAX_PLAYERS) {
      dropped.push(`מספר שחקנים לא הגיוני: ${e.players_count}`);
      delete e.players_count;
    } else e.players_count = n;
  }

  for (const k of ['blind_sb', 'blind_bb', 'ante', 'hero_stack', 'hero_profit']) {
    if (e[k] != null && !Number.isFinite(+e[k])) { dropped.push(`${k} לא מספרי`); delete e[k]; }
    else if (e[k] != null) e[k] = +e[k];
  }

  return { clean: e, dropped };
}

// ── Seats from acting order ──────────────────────────────────────────────────

/**
 * Re-derives everyone's seat from the order they acted preflop.
 *
 * WHY THIS EXISTS: other poker clients do not use our position names, and the
 * names cannot be translated one for one because the vocabulary shifts with
 * table size. On a real 8-handed 7XL hand (2026-09-08) that client's labels
 * were UTG / MP / MP1 / CO, which are our UTG / LJ / HJ / CO — so "MP" taken
 * literally put a player two seats away from where he sat, and "MP1" became our
 * "MP+1", a seat that exists only ten-handed and dragged the whole table to ten.
 * The first failure was loud; the second was silent, which is worse.
 *
 * Acting order does not have this problem. Preflop the action runs from UTG
 * round to the big blind, so the order players first act IS the seat order,
 * whatever anyone calls the seats.
 *
 * Applied only when the list demonstrably covers the whole table: the blinds
 * act last preflop, so a complete list ends with the small blind then the big
 * blind. Without that evidence the list may be a fragment, and re-seating from
 * a fragment would invent a table.
 */
// Seat names that carry the same meaning across poker clients, so a mismatch
// against them is evidence the acting order was misread.
const UNAMBIGUOUS_SEATS = new Set(['SB', 'BB', 'BTN', 'UTG', 'CO']);

const map0 = (actors, order) => new Map(actors.map((a, i) => [a, order[i]]));

function seatsFromActingOrder(e) {
  const acts = e.streets?.preflop?.actions || [];
  const actors = [...new Set(acts.map(a => a.actor))];
  const n = actors.length;
  if (n < 3 || n > MAX_PLAYERS) return null;

  const stated = new Map();
  if (e.hero_position) stated.set('hero', e.hero_position);
  for (const o of e.opponents || []) if (o.label && o.position) stated.set(o.label, o.position);

  // The list must demonstrably cover the whole table — re-seating from a
  // fragment would invent a table nobody sat at. The blinds act last preflop,
  // so a complete list ends with the small blind then the big blind; a stated
  // table size matching the actor count says the same thing another way.
  const [secondLast, last] = actors.slice(-2).map(a => stated.get(a));
  const endsWithBlinds = secondLast === 'SB' && last === 'BB';
  const matchesStatedSize = e.players_count === n;
  if (!endsWithBlinds && !matchesStatedSize) return null;

  // And the order must be CHECKABLE. Reading a hand out of a screenshot is not
  // reliable enough to trust an unverified order: the same 7XL image returned
  // its preflop actions shuffled on some runs, and a shuffled order re-seats
  // the entire table confidently and wrongly. So insist on at least two seats
  // whose names mean the same in every client, and make the order agree with
  // them. With nothing to check against, leave the hand alone.
  const checkable = [...map0(actors, preflopOrder(n))]
    .filter(([actor]) => UNAMBIGUOUS_SEATS.has(stated.get(actor)));
  if (checkable.length < 2) return null;

  const order = preflopOrder(n);
  if (order.length !== n) return null;
  const map = map0(actors, order);

  // Sanity-check the order against the seats every client names identically.
  // Clients disagree about the middle of the field — one client's MP is this
  // app's LJ — but nobody disagrees about the blinds, the button, UTG or the
  // cutoff. If the derived order puts someone somewhere those labels rule out,
  // it is the ORDER that is wrong, not the labels: seen when the vision step
  // returned a 7XL hand's preflop actions shuffled, which would otherwise have
  // reseated the whole table confidently and wrongly. Better to leave it alone.
  for (const [actor, seat] of map) {
    const claimed = stated.get(actor);
    if (UNAMBIGUOUS_SEATS.has(claimed) && claimed !== seat) return null;
  }
  return map;
}

/**
 * Rewrites seats when the acting order disagrees with the labels, and says so.
 * Nothing is silent: every seat that moves is reported, because the player may
 * know better than either source.
 */
function applyActingOrderSeats(e, report) {
  const map = seatsFromActingOrder(e);
  if (!map) return;

  const changes = [];
  const heroSeat = map.get('hero');
  if (heroSeat && heroSeat !== e.hero_position) {
    changes.push(`אני: ${e.hero_position || '—'} → ${heroSeat}`);
    e.hero_position = heroSeat;
  }
  for (const o of e.opponents || []) {
    const seat = map.get(o.label);
    if (seat && seat !== o.position) {
      changes.push(`${o.label}: ${o.position || '—'} → ${seat}`);
      o.position = seat;
    }
  }

  if (changes.length) {
    e.players_count = map.size;
    report(`עמדות סודרו לפי סדר הפעולות (${map.size} שחקנים): ${changes.join(', ')}`);
  }
}

// ── Which street did the hand actually reach ─────────────────────────────────

/** A street counts as reached if it has a board or any action on it. */
function reachedStreets(e) {
  const reached = ['preflop'];
  for (const st of ['flop', 'turn', 'river']) {
    const s = e.streets?.[st] || {};
    if ((s.board || []).length || (s.actions || []).length) reached.push(st);
    else break; // streets are strictly sequential — a gap means the hand ended
  }
  return reached;
}

/**
 * Best guess at how many were at the table, used only to decide which seats to
 * offer or hand out. Errs large: showing a seat that turns out not to exist is
 * recoverable, while hiding the seat the player actually sat in is not.
 */
function tableSize(e) {
  const seats = [e.hero_position, ...(e.opponents || []).map(o => o.position)].filter(Boolean);
  const actors = new Set();
  for (const st of STREETS) {
    for (const a of e.streets?.[st]?.actions || []) actors.add(a.actor);
  }
  return Math.min(MAX_PLAYERS, Math.max(
    actors.size,
    (e.opponents || []).length + 1,
    ...seats.map(minPlayersFor),
    2));
}

/**
 * The overwhelming majority of hands logged here are tournaments, so an
 * unstated format is treated as one rather than asked about — a question every
 * player answers the same way is a question worth removing. The model still
 * sets `cash` outright when the narration says so or quotes the stakes in real
 * money (₪ / $ / €), which is the signal that separates the two in practice.
 * The review card carries a dropdown for the times this guesses wrong.
 */
const DEFAULT_GAME_TYPE = 'tournament';
const effectiveGameType = (e) => e.game_type || DEFAULT_GAME_TYPE;

// ── Gap detection ────────────────────────────────────────────────────────────

/**
 * The five things that genuinely block producing a hand, plus any board that
 * is half-filled on a street the hand demonstrably reached (a 2-card flop
 * would render wrong, so that one is worth a tap).
 *
 * Each gap is UI-ready: `kind` tells the client which control to render, so
 * the player answers with a tap instead of typing.
 */
function findGaps(e, answers = {}) {
  const gaps = [];
  const add = (field, kind, label, extra = {}) => gaps.push({ field, kind, label, ...extra });

  // game_type is no longer asked. Nearly every hand logged here is a tournament,
  // so absent an explicit "cash" or blinds quoted in real currency it defaults
  // to tournament — and the review card lets it be changed in one tap, which is
  // cheaper than a question every player would answer the same way.
  const gameType = effectiveGameType(e);

  // Blinds/stakes follow from which kind of game it is.
  if (isTournament(gameType) && !(e.blind_sb && e.blind_bb)) {
    // Suggestions plus free entry, never suggestions alone: blind levels climb
    // through values no preset list can cover, and a player who cannot type the
    // level they actually played is stuck.
    add('blinds', 'blinds', 'מה היו הבליינדים?', {
      allowCustom: true,
      options: ['25/50', '50/100', '100/200', '200/400', '500/1000', '1000/2000']
        .map(v => ({ value: v, label: v })),
    });
  } else if (isCash(gameType) && !e.cash_stakes) {
    add('cash_stakes', 'stakes', 'באילו סטייקים שיחקת?', {
      allowCustom: true,
      options: ['0.5/1', '1/2', '1/3', '2/5', '5/10'].map(v => ({ value: v, label: v })),
    });
  }

  if (!POSITIONS.has(e.hero_position)) {
    // Offer the seats that actually exist at this table — a 6-handed table has
    // no UTG+1 and no LJ, and offering them is how wrong seats got recorded.
    // Which seats to offer. A size the player STATED is authoritative. Without
    // one, offer the full ring: the derived size is only as good as the number
    // of players the narration happened to name, and a hand mentioning nobody
    // would otherwise offer the two blinds alone — leaving someone who sat on
    // the button with no way to say so. players_count then follows from the
    // seat they pick, and the size control is there to pin it.
    const derived = tableSize(e);
    const size = e.players_count || MAX_PLAYERS;
    add('hero_position', 'position', 'באיזו עמדה ישבת?', {
      playersCount: size,
      derivedPlayersCount: derived,
      adjustableTableSize: true,
      options: seatsFor(size).map(p => ({ value: p, label: p })),
    });
  }

  if (!Array.isArray(e.hero_cards) || e.hero_cards.length !== 2) {
    add('hero_cards', 'cards', 'אילו קלפים היו לך?', { count: 2 });
  }

  if (!(e.streets?.preflop?.actions || []).length) {
    add('preflop_actions', 'actions', 'מה קרה בפרה-פלופ?', { street: 'preflop' });
  }

  // Sizing that cannot be taken at face value — ask, never assume. Once the
  // player has answered, the question is settled even if they chose "as
  // written", which leaves the numbers looking exactly as ambiguous as before.
  if (!answers.amount_scale && amountScaleIsAmbiguous(e)) {
    const sample = collectAmounts(e).slice(0, 3).map(a => a.amount);
    const asWritten = sample.join(', ');
    const asThousands = sample.map(v => (v * 1000).toLocaleString('en-US')).join(', ');
    const asBigBlinds = sample.map(v => (v * e.blind_bb).toLocaleString('en-US')).join(', ');
    add('amount_scale', 'choice', `הסכומים קטנים מהביג בליינד (${e.blind_bb}) — למה התכוונת?`, {
      // Answered directly rather than re-parsed: this is arithmetic, not language.
      direct: true,
      allowCustom: true,
      customLabel: 'או הזן כמה להכפיל (למשל 100)',
      options: [
        { value: 'thousands', label: `באלפים — ${asThousands}` },
        { value: 'bb', label: `בביג בליינדים — ${asBigBlinds}` },
        { value: 'literal', label: `בדיוק ככה — ${asWritten}` },
      ],
    });
  }

  // Board completeness, but only on streets the hand actually got to.
  for (const st of reachedStreets(e).filter(s => s !== 'preflop')) {
    const board = e.streets[st].board || [];
    if (board.length !== BOARD_SIZE[st]) {
      add(`${st}_board`, 'cards', { flop: 'אילו קלפים היו בפלופ?', turn: 'מה בא בטרן?', river: 'ומה בריבר?' }[st], {
        count: BOARD_SIZE[st], street: st, have: board,
      });
    }
  }

  return gaps;
}

// ── Result inference ─────────────────────────────────────────────────────────

/** Every action in the hand, in order, flattened across streets. */
function allActions(e) {
  return STREETS.flatMap(st => (e.streets?.[st]?.actions || []).map(a => ({ ...a, street: st })));
}

/**
 * Derives won/lost from the action list where it is unambiguous, and stays at
 * 'unknown' otherwise. Deliberately conservative: guessing an outcome would
 * put a wrong number on the player's saved hand and a wrong winner in the
 * video, whereas 'unknown' renders as the app's existing "decision point"
 * summary, which is always an honest reading of an unfinished narration.
 */
function inferResult(e) {
  const actions = allActions(e);
  if (!actions.length) return { result: 'unknown', why: 'אין פעולות — נשמר כנקודת החלטה' };

  if (actions.some(a => a.actor === 'hero' && a.action === 'fold')) {
    return { result: 'lost', why: 'הירו קיפל — היד הפסידה' };
  }

  // Everyone else folded and the hero was still in: the pot is uncontested.
  const opponents = [...new Set(actions.map(a => a.actor).filter(a => a !== 'hero'))];
  if (opponents.length) {
    const allFolded = opponents.every(o => {
      const theirs = actions.filter(a => a.actor === o);
      return theirs.length && theirs[theirs.length - 1].action === 'fold';
    });
    if (allFolded) return { result: 'won', why: 'כל היריבים קיפלו — הקופה לירו' };
  }

  // Reached a showdown, or the narration simply stops — either way the winner
  // is not something the action list alone can settle.
  return { result: 'unknown', why: 'לא צוינה תוצאה — נשמר כנקודת החלטה' };
}

// Action names as the player sees them, so a suggested repair reads like the
// review card it appears on rather than like the storage format.
// The review card calls the hero "אני"; messages that name an actor should read
// the same way rather than leaking the internal token.
const actorName = (a) => (a === 'hero' ? 'אני' : a);
// Possessive form, so a label reads "הצ׳ק שלי" rather than "הצ׳ק של אני".
const actorPossessive = (a) => (a === 'hero' ? 'שלי' : `של ${a}`);

const STREET_HE = { preflop: 'פרה-פלופ', flop: 'פלופ', turn: 'טרן', river: 'ריבר' };

const ACTION_HE = {
  fold: 'פולד', check: 'צ׳ק', limp: 'לימפ', call: 'קול',
  bet: 'הימור', 'three-bet': '3-בט', 'four-bet': '4-בט', allin: 'אול-אין',
};

/**
 * Applies one suggested repair and hands back a new state. Never called on its
 * own initiative — only when the player taps the suggestion, because every one
 * of these rewrites something they told us.
 */
function applyContradictionFix(state, fix) {
  if (!fix) return state;
  const next = JSON.parse(JSON.stringify(state));

  if (fix.kind === 'set_players_count') {
    next.players_count = fix.players_count;
    return next;
  }

  const acts = next.streets?.[fix.street]?.actions;
  if (!Array.isArray(acts) || !acts[fix.index]) return next;

  if (fix.kind === 'remove_action') {
    acts.splice(fix.index, 1);
  } else if (fix.kind === 'change_action') {
    acts[fix.index] = { ...acts[fix.index], action: fix.action, amount: null };
  } else if (fix.kind === 'move_before' && fix.before >= 0) {
    const [moved] = acts.splice(fix.index, 1);
    acts.splice(fix.before, 0, moved);
  }
  return next;
}

// ── Structural NLH contradictions ────────────────────────────────────────────

const AGGRESSIVE = new Set(['bet', 'three-bet', 'four-bet', 'allin']);

/**
 * A seat the stated table size does not contain. UTG+1 exists only nine-handed
 * and up, LJ only from seven, MP+1 only at ten — so "6 שחקנים" plus a UTG+1 is
 * two claims that cannot both hold. Checked here rather than left to the model,
 * which treats it as a detail and lets it through.
 */
function checkSeatsFitTable(e, out) {
  const n = e.players_count;
  if (!n) return;
  const seats = seatsFor(n);
  const claimed = [
    ['הירו', e.hero_position],
    ...(e.opponents || []).map(o => [o.label || 'יריב', o.position]),
  ].filter(([, pos]) => pos);

  for (const [who, pos] of claimed) {
    if (!seats.includes(pos)) {
      const needed = minPlayersFor(pos);
      out.push({
        field: 'players_count',
        description: `${who} ב-${pos}, אבל בשולחן של ${n} אין עמדה כזו (${seats.join(' ')})`,
        fix: {
          kind: 'set_players_count', players_count: needed,
          label: `שנה את השולחן ל-${needed} שחקנים, שבו ${pos} קיימת`,
        },
      });
    }
  }
}

/**
 * Two players cannot occupy the same seat. Worth checking because the seats do
 * not all come from one place: the hero's may be stated by the player while the
 * opponents' come from the narration, and an image read can assert a hero seat
 * that another named player already holds. applyDefaults would quietly shuffle
 * the loser to a free chair, so without this the clash disappears unnoticed.
 * Only stated seats are compared — defaulted ones are ours, not the player's.
 */
function checkSeatCollisions(e, out) {
  const seats = new Map();
  const claim = (who, pos) => {
    if (!pos) return;
    if (seats.has(pos)) {
      out.push({
        field: 'hero_position',
        description: `${seats.get(pos)} וגם ${who} מסומנים ב-${pos} — שני שחקנים לא יכולים לשבת באותו מקום`,
      });
    } else seats.set(pos, who);
  };
  // The hero's own clash is already resolved in sanitize() by dropping the
  // derived seat, so what reaches here is opponent against opponent.
  claim('הירו', e.hero_position);
  for (const o of e.opponents || []) claim(o.label || 'יריב', o.position);
}

// Seats that can make the first voluntary raise of a hand: everyone except the
// blinds, who act last preflop. Derived rather than listed — an earlier hard
// -coded list silently went stale the moment LJ and MP+1 were added.
const CAN_OPEN = new Set(ALL_POSITIONS.filter(p => p !== 'SB' && p !== 'BB'));

/**
 * The first aggressive action preflop can only come from UTG through BTN.
 * The two exceptions, both real:
 *   - SB may open when everyone folded to it (a blind steal); BB never can,
 *     because if it folds to the big blind the hand is simply over.
 *   - Once anyone has limped or called, either blind may raise over them —
 *     that raise is still the street's first aggression, so it stays "bet".
 *
 * Only checked when the position was actually stated. applyDefaults() hands out
 * seats to unnamed opponents, and flagging a seat we invented ourselves would
 * be inventing the contradiction too.
 */
function checkPreflopOpener(e, out) {
  const actions = e.streets?.preflop?.actions || [];
  const i = actions.findIndex(a => AGGRESSIVE.has(a.action));
  if (i < 0) return;

  const seats = new Map();
  if (e.hero_position) seats.set('hero', e.hero_position);
  for (const o of e.opponents || []) if (o.label && o.position) seats.set(o.label, o.position);

  const opener = actions[i];
  const pos = seats.get(opener.actor);
  if (!pos || CAN_OPEN.has(pos)) return;

  const before = actions.slice(0, i);
  // A limp or a call before the raise means there is something to raise over.
  if (before.some(a => a.action === 'limp' || a.action === 'call')) return;
  // Folded around to the small blind — the one legitimate blind open.
  if (pos === 'SB' && before.every(a => a.action === 'fold')) return;

  const why = pos === 'BB'
    ? 'אם כולם מקפלים ל-BB היד נגמרת — הוא לא יכול לפתוח'
    : 'פרה-פלופ הפעולה מתחילה ב-UTG, והבליינדים פועלים אחרונים';
  out.push({
    field: `preflop.actions[${i}]`,
    description: `${actorName(opener.actor)} (${pos}) פותח ראשון פרה-פלופ — ${why}. בטוח שזו העמדה?`,
  });
}

/**
 * Rule violations that are decidable from the action list alone. The model is
 * left to catch the semantic ones it is actually good at (a seat that cannot
 * exist at the stated table size, a mis-heard card); fixture runs showed it
 * reliably missing these structural ones even when it extracted the actions
 * perfectly — "צ׳ק, צ׳ק, ואז קיפלתי" came back verbatim and unflagged.
 *
 * Reported, never auto-corrected: a wrong repair here would rewrite what the
 * player told us. The UI asks.
 */
function findContradictions(e) {
  const out = [];

  checkSeatCollisions(e, out);
  checkSeatsFitTable(e, out);
  checkPreflopOpener(e, out);

  for (const st of STREETS) {
    const actions = e.streets?.[st]?.actions || [];
    let aggression = 0;

    actions.forEach((a, i) => {
      const prev = actions[i - 1];

      // Within one betting round a player never acts twice running.
      if (prev && prev.actor === a.actor) {
        out.push({
          field: `${st}.actions[${i}]`,
          description: `${actorName(a.actor)} פועל פעמיים ברצף ב${STREET_HE[st] || st} בלי שאף אחד פעל ביניהם`,
          fix: {
            kind: 'remove_action', street: st, index: i,
            label: `הסר את הפעולה הכפולה (${ACTION_HE[a.action] || a.action})`,
          },
        });
      }

      // Preflop the big blind is a live bet, so there is always something to
      // fold to. Postflop there must have been aggression first.
      if (st !== 'preflop') {
        if (a.action === 'fold' && aggression === 0) {
          out.push({
            field: `${st}.actions[${i}]`,
            description: `${actorName(a.actor)} מקפל ב${STREET_HE[st] || st} כשאין הימור פתוח מולו — אפשר היה לצ׳ק`,
            fix: {
              kind: 'change_action', street: st, index: i, action: 'check',
              label: `שנה את הפולד ${actorPossessive(a.actor)} לצ׳ק`,
            },
          });
        }
        if (a.action === 'check' && aggression > 0) {
          // The check is legal, just in the wrong place — it belongs before the
          // street's first bet. Moving it keeps every action the player told us
          // and only reorders them, which is the least destructive repair.
          const firstAgg = actions.findIndex(x => AGGRESSIVE.has(x.action));
          out.push({
            field: `${st}.actions[${i}]`,
            description: `${actorName(a.actor)} עושה צ׳ק ב${STREET_HE[st] || st} מול הימור פתוח`,
            fix: {
              kind: 'move_before', street: st, index: i, before: firstAgg,
              label: `הזז את הצ׳ק ${actorPossessive(a.actor)} ללפני ההימור`,
            },
          });
        }
      }

      if (AGGRESSIVE.has(a.action)) aggression++;
    });
  }

  return out;
}

// ── Chip shorthand ───────────────────────────────────────────────────────────

/**
 * Live players write sizes in thousands: at 1000/2000, "אני 5" is 5,000.
 * Taken literally that is a pot of a few dozen chips, and the narrative and
 * video come out nonsense.
 *
 * ⚠ We do NOT resolve this ourselves. An earlier version multiplied by 1000
 * whenever every size sat below the big blind and merely noted it — and the
 * very first real hand proved the danger: the player's own blind level was not
 * what the note appeared to say, so a silent guess would have rewritten his
 * hand with confident, wrong numbers. Ambiguous sizing is now a QUESTION.
 *
 * The tell stays the same: nobody bets less than a big blind, so if every
 * amount in the hand is smaller than the BB, the hand was written in some other
 * unit. Which unit is for the player to say.
 */
function amountScaleIsAmbiguous(e) {
  const bb = e.blind_bb;
  if (!bb || bb < 100) return false; // cash stakes like 1/2 are already literal
  const amounts = collectAmounts(e);
  return amounts.length > 0 && amounts.every(a => a.amount < bb);
}

function collectAmounts(e) {
  const out = [];
  for (const st of STREETS) {
    for (const a of e.streets?.[st]?.actions || []) {
      if (typeof a.amount === 'number') out.push(a);
    }
  }
  return out;
}

/**
 * Applies the player's answer. 'literal' deliberately changes nothing, and a
 * bare number is a multiplier they typed themselves when none of the offered
 * readings matched what they meant.
 */
function applyAmountScale(e, choice) {
  const factor =
    choice === 'thousands' ? 1000
    : choice === 'bb' ? (e.blind_bb || 0)
    : Number.isFinite(+choice) && +choice > 0 ? +choice
    : 0;
  if (!factor) return;
  for (const a of collectAmounts(e)) a.amount = Math.round(a.amount * factor);
}

// ── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Fills everything that is NOT a gap, and records what it invented under
 * `_inferred` so the review card can flag those values rather than presenting
 * a guess as if the player had said it.
 */
function applyDefaults(e) {
  const out = { ...e, streets: { ...e.streets } };
  const inferred = [];
  const note = (field, why) => inferred.push({ field, why });

  // Opponents: prefer the actors the narration actually mentions, so labels
  // used in the action list always resolve to a real seat.
  const actors = new Set();
  for (const st of STREETS) {
    for (const a of out.streets?.[st]?.actions || []) {
      if (a.actor && a.actor !== 'hero') actors.add(a.actor);
    }
  }

  const known = new Map((out.opponents || []).filter(o => o.label).map(o => [o.label, o]));
  for (const label of actors) if (!known.has(label)) known.set(label, { label, position: null, stack: null });
  let opponents = [...known.values()];

  if (!opponents.length) {
    opponents = [{ label: 'יריב 1', position: null, stack: null }];
    note('opponents', 'לא הוזכר אף יריב — נוצר יריב אחד');
  }

  // Seats: an opponent whose label IS a position (very common — the model
  // falls back to "UTG" when unnamed) keeps it; the rest get the next free
  // seat, deterministically, so the same narration always renders the same.
  const taken = new Set([out.hero_position].filter(Boolean));
  for (const o of opponents) if (o.position) taken.add(o.position);
  for (const o of opponents) {
    if (o.position) continue;
    if (POSITIONS.has(o.label) && !taken.has(o.label)) {
      o.position = o.label;
    } else {
      o.position = seatsFor(tableSize(out)).find(p => !taken.has(p))
        || seatsFor(MAX_PLAYERS).find(p => !taken.has(p)) || 'UTG';
      note(`opponent:${o.label}`, `עמדה לא צוינה — שובץ ל-${o.position}`);
    }
    taken.add(o.position);
  }

  // The table must be big enough that every seat in use actually exists at it —
  // an LJ in play means at least seven-handed, an MP+1 means ten.
  const required = Math.min(MAX_PLAYERS, Math.max(
    opponents.length + 1,
    ...[...taken].map(minPlayersFor),
    2));
  // A stated size wins when it can actually hold the hand; when it cannot, the
  // hand itself is the harder evidence and the clash is already flagged as a
  // contradiction rather than resolved silently.
  const players_count = out.players_count && out.players_count >= required
    ? out.players_count : required;
  out.opponents = opponents;
  out.players_count = players_count;

  if (!out.game_type) {
    out.game_type = DEFAULT_GAME_TYPE;
    note('game_type', 'לא צוין סוג משחק — הונח טורניר');
  }

  if (out.ante == null) { out.ante = 0; note('ante', 'לא צוינה אנטה — 0'); }

  if (out.hero_stack == null) {
    // 100bb is the conventional starting assumption when nobody says otherwise.
    out.hero_stack = isTournament(out.game_type) ? (out.blind_bb || 0) * 100 || 10000 : 100;
    note('hero_stack', `ערימה לא צוינה — הונח ${out.hero_stack}`);
  }
  for (const o of out.opponents) {
    if (o.stack == null) { o.stack = out.hero_stack; note(`stack:${o.label}`, 'ערימה לא צוינה'); }
  }

  if (!out.result) {
    // Whether the hand was won or lost is usually derivable from the actions
    // themselves, and doing it here beats asking the model: fixture runs showed
    // it returning no result even for "קיפלתי" and "לקחתי את הקופה".
    // 'unknown' is a first-class value in this app (the wizard's "?" button),
    // so falling through to it never blocks anything.
    const derived = inferResult(out);
    out.result = derived.result;
    note('result', derived.why);
  }

  if (!out.showdown) {
    out.showdown = { reached: false, opponent_cards: [] };
  }

  out._inferred = inferred;
  return out;
}

// ── Suit materialization ─────────────────────────────────────────────────────

/**
 * The renderer needs concrete suits — handVideo.js and CardPicker both draw a
 * specific suit glyph, so a null cannot survive into the saved hand. Assigns
 * the remaining unused suits deterministically, honouring hero_cards_suited
 * when the player said "AKs"/"offsuit" without naming actual suits.
 */
function materializeSuits(e) {
  const used = new Set();
  const collect = c => { if (c?.suit) used.add(`${c.rank}${c.suit}`); };
  (e.hero_cards || []).forEach(collect);
  for (const st of ['flop', 'turn', 'river']) (e.streets?.[st]?.board || []).forEach(collect);

  const pick = rank => {
    const s = SUITS.find(su => !used.has(`${rank}${su}`)) || 's';
    used.add(`${rank}${s}`);
    return s;
  };

  const hero = (e.hero_cards || []).map(c => ({ ...c }));
  if (hero.length === 2 && hero[0].suit == null && hero[1].suit == null && e.hero_cards_suited === true
      && hero[0].rank !== hero[1].rank) {
    // Same suit, and it must be free for both ranks.
    const s = SUITS.find(su => !used.has(`${hero[0].rank}${su}`) && !used.has(`${hero[1].rank}${su}`)) || 's';
    hero.forEach(c => { c.suit = s; used.add(`${c.rank}${s}`); });
  } else {
    // Offsuit (or unspecified): pick per card, and for an explicit "offsuit"
    // make sure we don't accidentally hand back a suited combo.
    hero.forEach(c => { if (c.suit == null) c.suit = pick(c.rank); });
    if (e.hero_cards_suited === false && hero.length === 2 && hero[0].suit === hero[1].suit) {
      const alt = SUITS.find(su => su !== hero[0].suit && !used.has(`${hero[1].rank}${su}`));
      if (alt) { hero[1].suit = alt; used.add(`${hero[1].rank}${alt}`); }
    }
  }

  const streets = { ...e.streets };
  for (const st of ['flop', 'turn', 'river']) {
    streets[st] = {
      ...streets[st],
      board: (streets[st]?.board || []).map(c => (c.suit ? c : { ...c, suit: pick(c.rank) })),
    };
  }

  return { ...e, hero_cards: hero, streets };
}

// ── Adapter into the wizard's state shape ────────────────────────────────────

/**
 * Produces exactly what HandLoggerWizard.jsx's buildState() produces, so the
 * existing generateNarrative() / handVideo.js / createHand path needs no
 * changes. The narration feature is an alternative way IN to this shape —
 * never a second engine.
 *
 * Note the nesting difference the parser output does not have: opponents and
 * streets live under hand_data here, not at the top level.
 */
function toWizardState(e) {
  const s = materializeSuits(e);
  return {
    game_type: s.game_type,
    tournament_stage: s.tournament_stage || '',
    blind_sb: s.blind_sb ?? null,
    blind_bb: s.blind_bb ?? null,
    ante: s.ante ?? 0,
    cash_stakes: s.cash_stakes || '',
    players_count: s.players_count,
    hero_position: s.hero_position,
    hero_stack: s.hero_stack ?? 0,
    hero_cards: s.hero_cards,
    hand_data: {
      opponents: s.opponents,
      streets: s.streets,
      // The parser carries shown cards on each opponent (the output schema has
      // a hard cap on optional fields); the wizard wants them collected under
      // showdown, so regroup here. `reached` follows from whether anyone
      // actually showed — never asked as a separate question.
      showdown: (() => {
        const shown = (s.opponents || [])
          .filter(o => o.cards)
          .map(o => ({ label: o.label, cards: o.cards }));
        return { reached: shown.length > 0, opponent_cards: shown };
      })(),
    },
    result: s.result,
    hero_profit: s.hero_profit ?? null,
    notes: s.notes || '',
  };
}

/** One call the controller can make: sanitize → gaps → defaults. */
function analyze(rawExtracted, answers = {}) {
  const { clean, dropped } = sanitize(rawExtracted);
  // Direct answers are applied before anything is measured, so a resolved
  // question stops being a gap and the numbers downstream are the real ones.
  if (answers.amount_scale) applyAmountScale(clean, answers.amount_scale);
  const gaps = findGaps(clean, answers);
  const contradictions = findContradictions(clean);
  const withDefaults = applyDefaults(clean);
  return {
    state: withDefaults,
    gaps,
    contradictions,
    dropped,
    // Contradictions don't block saving — they are shown on the review card for
    // the player to confirm or fix, since the app has always allowed logging a
    // hand exactly as remembered, misremembered details included.
    ready: gaps.length === 0,
  };
}

module.exports = {
  analyze, sanitize, findGaps, applyDefaults, materializeSuits, toWizardState,
  reachedStreets, inferResult, allActions, tableSize, seatsFromActingOrder, effectiveGameType, DEFAULT_GAME_TYPE, findContradictions, applyContradictionFix, checkPreflopOpener, checkSeatCollisions, checkSeatsFitTable, amountScaleIsAmbiguous, applyAmountScale, RANKS, SUITS, ACTIONS, ALL_POSITIONS,
};
