/**
 * Table positions — MIRROR of server/services/pokerPositions.js.
 *
 * Do not edit here alone. The server copy is canonical; everything below the
 * header is byte-identical to it, and server/scripts/testPokerPositions.js
 * fails if the two drift. Client and server are separate packages, which is the
 * only reason there are two files at all.
 *
 * See the server copy for why this exists: four separate hard-coded lists, each
 * taking "the first N of eight seats", produced a wrong set at every table size.
 */


// Full ring, clockwise from the small blind.
const FULL_RING = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'MP+1', 'LJ', 'HJ', 'CO', 'BTN'];

// The order seats are given up as the table shrinks. The first four entries are
// the owner's 10→6 tables exactly; the rest continue the same logic down to
// three-handed, where only the blinds and the button remain.
const SHRINK_ORDER = ['MP+1', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'UTG'];

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

/** Every seat name the app can ever produce. */
const ALL_POSITIONS = [...FULL_RING];

/**
 * Seats in play at a given table size, clockwise from the small blind.
 *   6 → SB BB UTG HJ CO BTN
 *   9 → SB BB UTG UTG+1 MP LJ HJ CO BTN
 */
function seatsFor(playersCount) {
  const n = Math.max(MIN_PLAYERS, Math.min(Number(playersCount) || MAX_PLAYERS, MAX_PLAYERS));
  // Heads-up has no button seat of its own — the small blind IS the button.
  if (n === 2) return ['SB', 'BB'];

  let seats = [...FULL_RING];
  for (const seat of SHRINK_ORDER) {
    if (seats.length <= n) break;
    seats = seats.filter(s => s !== seat);
  }
  return seats;
}

/**
 * Preflop acting order: starts left of the big blind and the blinds act LAST.
 * Heads-up inverts — the small blind is the button and acts first preflop.
 */
function preflopOrder(playersCount) {
  const seats = seatsFor(playersCount);
  if (seats.length === 2) return ['SB', 'BB'];
  return [...seats.slice(2), ...seats.slice(0, 2)];
}

/**
 * Postflop acting order: the small blind is first and the button last.
 * Heads-up inverts again — the big blind acts first once the flop is out.
 */
function postflopOrder(playersCount) {
  const seats = seatsFor(playersCount);
  if (seats.length === 2) return ['BB', 'SB'];
  return [...seats];
}

/** True when `position` is a real seat at a table of this size. */
function isValidAt(position, playersCount) {
  return seatsFor(playersCount).includes(position);
}

/** Smallest table at which this seat exists — 6 for HJ, 7 for LJ, 10 for MP+1. */
function minPlayersFor(position) {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    if (seatsFor(n).includes(position)) return n;
  }
  return MAX_PLAYERS;
}

export {
  FULL_RING, SHRINK_ORDER, ALL_POSITIONS, MIN_PLAYERS, MAX_PLAYERS,
  seatsFor, preflopOrder, postflopOrder, isValidAt, minPlayersFor,
};
