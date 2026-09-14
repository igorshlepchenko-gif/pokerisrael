/**
 * Puts each street's recorded actions back into seat order.
 *
 * Actions are stored in the order they were entered. Until the wizard started
 * offering one player at a time (2026-09-14), a player could be tapped out of
 * turn — a real 9-handed hand saved HJ's fold ahead of LJ's — and everything
 * that replays a hand (the video, the hand-history text) replayed that wrong
 * order, even after the wizard itself was fixed.
 *
 * This replays each betting round: at every point it takes the action of the
 * player whose turn it actually is (same rule as the wizard). A correctly
 * ordered street comes back unchanged. If the player whose turn it is has no
 * action left — an incomplete record — the next action in stored order is
 * kept, so nothing is ever dropped or invented.
 */
import { preflopOrder, postflopOrder } from './pokerPositions';

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const AGGRESSIVE = ['bet', 'raise', 'three-bet', 'four-bet', 'allin'];

// Actor ids ('hero' or String(opponent id)) in acting order for a street.
function seatOrder(street, heroPosition, opponents, playersCount) {
  const n = playersCount || opponents.length + 1;
  const order = street === 'preflop' ? preflopOrder(n) : postflopOrder(n);
  const rank = (position) => { const i = order.indexOf(position); return i < 0 ? 99 : i; };
  return [
    { actor: 'hero', position: heroPosition },
    ...opponents.map(o => ({ actor: String(o.id), position: o.position })),
  ].sort((a, b) => rank(a.position) - rank(b.position)).map(p => p.actor);
}

// Who still has to act after `done` — the wizard's playersWhoNeedToAct rule.
function needToAct(done, seats, inactive) {
  const out = new Set(inactive);
  done.forEach(a => { if (a.action === 'fold' || a.action === 'allin') out.add(String(a.actor)); });
  const canAct = seats.filter(s => !out.has(s));
  let lastAggr = -1;
  for (let i = done.length - 1; i >= 0; i--) {
    if (AGGRESSIVE.includes(done[i].action)) { lastAggr = i; break; }
  }
  if (lastAggr < 0) {
    const acted = new Set(done.map(a => String(a.actor)));
    return canAct.filter(s => !acted.has(s));
  }
  const aggressor = String(done[lastAggr].actor);
  const actedAfter = new Set(done.slice(lastAggr + 1).map(a => String(a.actor)));
  return canAct.filter(s => s !== aggressor && !actedAfter.has(s));
}

// The first seat clockwise from the last actor that still has to act.
function nextToAct(done, seats, inactive) {
  const need = new Set(needToAct(done, seats, inactive));
  if (!need.size) return null;
  const last = done.length ? String(done[done.length - 1].actor) : null;
  const start = last == null ? 0 : seats.indexOf(last) + 1;
  for (let k = 0; k < seats.length; k++) {
    const s = seats[(start + k) % seats.length];
    if (need.has(s)) return s;
  }
  return null;
}

/**
 * @param {object[]} actions - one street's actions, as stored
 * @param {string[]} seats - actor ids in acting order for the street
 * @param {Set<string>} inactive - folded or all-in on an earlier street
 */
export function resequenceStreet(actions, seats, inactive = new Set()) {
  const remaining = [...(actions || [])];
  const done = [];
  while (remaining.length) {
    const next = nextToAct(done, seats, inactive);
    let i = next == null ? -1 : remaining.findIndex(a => String(a.actor) === next);
    if (i < 0) i = 0; // nobody's turn matches a recorded action — keep stored order
    done.push(remaining.splice(i, 1)[0]);
  }
  return done;
}

/** A copy of hand_data with every street's actions in seat order. */
export function resequenceHandActions(handData, heroPosition, opponents, playersCount) {
  if (!handData?.streets) return handData;
  const inactive = new Set();
  const streets = { ...handData.streets };
  STREETS.forEach(street => {
    const s = streets[street];
    if (!s?.actions?.length) return;
    const seats = seatOrder(street, heroPosition, opponents || [], playersCount).filter(a => !inactive.has(a));
    const actions = resequenceStreet(s.actions, seats, inactive);
    streets[street] = { ...s, actions };
    actions.forEach(a => { if (a.action === 'fold' || a.action === 'allin') inactive.add(String(a.actor)); });
  });
  return { ...handData, streets };
}
