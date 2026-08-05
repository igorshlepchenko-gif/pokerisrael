// Side-pot math for multi-way all-ins — Texas Hold'em
//
// Shared by the wizard (live action-lock + result step), the narrative
// generator and the video generator, so all three always agree on the same
// pot breakdown for a given hand_data. Everything here is pure/stateless —
// it only reads the streets/actions already stored on the hand.
import { compareEvals } from './handEvaluator';

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];

// Chronological, %-of-pot-aware walk through every action in recorded order
// (not per-actor independently), so a "75%" raise resolves against the real
// pot at that instant — the same conversion handVideo.js already uses for
// its chip animation, applied here to the actual running contributions.
// A bet/raise amount is the new absolute total for that street ("raises to");
// a call/limp/allin amount is incremental chips added on top of whatever that
// actor already committed this street. Mixing these up (e.g. summing every
// action's amount blindly, as elsewhere in this codebase) double-counts a
// player who bets, gets raised, and re-raises within the same street.
//
// Returns { totalContributed: {actor: chips}, folded: Set<actor>,
//           byStreet: [{street, contributedAfter: {actor: chips}}] } —
// contributedAfter is a running snapshot (not per-street delta) so callers
// can read "how much has this actor put in as of the end of street X".
function walkHand(handData, heroPosition, opponents, sbSize, bbSize, ante, isTournament) {
  const streets = handData?.streets || {};
  const actorIds = ['hero', ...opponents.map(o => String(o.id))];
  const positions = { hero: heroPosition };
  opponents.forEach(o => { positions[String(o.id)] = o.position; });

  const totalContributed = {};
  actorIds.forEach(id => { totalContributed[id] = 0; });
  const folded = new Set();

  const preflopActions = streets.preflop?.actions || [];
  const betActorsPreflop = new Set(
    preflopActions
      .filter(a => ['bet', 'raise', 'three-bet', 'four-bet'].includes(a.action) && a.amount)
      .map(a => String(a.actor))
  );
  actorIds.forEach(id => {
    if (betActorsPreflop.has(id)) return;
    if (positions[id] === 'BB') totalContributed[id] += (bbSize || 0);
    else if (positions[id] === 'SB') totalContributed[id] += (sbSize || 0);
  });

  let pot = Object.values(totalContributed).reduce((s, v) => s + v, 0)
    + (isTournament ? (ante || 0) * actorIds.length : 0);

  const byStreet = [];
  STREET_ORDER.forEach(street => {
    const streetCommitment = {};
    actorIds.forEach(id => { streetCommitment[id] = 0; });
    if (street === 'preflop') {
      actorIds.forEach(id => {
        if (betActorsPreflop.has(id)) return;
        if (positions[id] === 'BB') streetCommitment[id] = bbSize || 0;
        else if (positions[id] === 'SB') streetCommitment[id] = sbSize || 0;
      });
    }

    (streets[street]?.actions || []).forEach(a => {
      const actor = String(a.actor);
      if (a.action === 'fold') { folded.add(actor); return; }
      if (!(actor in totalContributed) || a.action === 'check') return;
      const raw = String(a.amount ?? '');
      if (!raw) return;
      const amount = raw.trim().endsWith('%')
        ? Math.round(pot * (parseFloat(raw) || 0) / 100)
        : (parseFloat(raw) || 0);
      if (!amount || amount <= 0) return;

      const before = streetCommitment[actor] || 0;
      const after = ['bet', 'raise', 'three-bet', 'four-bet'].includes(a.action)
        ? amount            // "raises to" — absolute total for the street
        : before + amount;  // call / limp / allin — incremental
      const delta = Math.max(0, after - before);
      streetCommitment[actor] = after;
      totalContributed[actor] += delta;
      pot += delta;
    });

    byStreet.push({ street, contributedAfter: { ...totalContributed } });
  });

  return { totalContributed, folded, byStreet, actorIds };
}

// Each player's final contribution to the pot across the whole hand, plus
// whether they folded — the direct input to computeSidePots.
export function getContributions(handData, heroPosition, opponents, sbSize, bbSize, ante, isTournament) {
  const { totalContributed, folded, actorIds } = walkHand(handData, heroPosition, opponents, sbSize, bbSize, ante, isTournament);
  return actorIds.map(actor => ({
    actor,
    contributed: totalContributed[actor],
    folded: folded.has(actor),
  }));
}

// Standard side-pot layering: each distinct all-in level slices off a pot
// layer, shared by everyone who contributed at least that much, won only by
// whoever among them didn't fold. contributions: [{actor, contributed, folded}]
// Returns pots ordered main-pot-first.
export function computeSidePots(contributions) {
  const active = contributions.filter(p => p.contributed > 0);
  if (!active.length) return [];
  const levels = [...new Set(active.map(p => p.contributed))].sort((a, b) => a - b);

  const pots = [];
  let prevLevel = 0;
  for (const level of levels) {
    const layerSize = level - prevLevel;
    prevLevel = level;
    if (layerSize <= 0) continue;
    const contributors = active.filter(p => p.contributed >= level);
    const eligible = contributors.filter(p => !p.folded).map(p => p.actor);
    // A layer everyone who reached it has folded can't happen once a hand
    // truly reaches showdown (see note below) — skip defensively.
    if (!eligible.length) continue;
    pots.push({ amount: layerSize * contributors.length, eligible });
  }
  return pots;
}
// Note on the "empty eligible" guard above: contribution is cumulative per
// player, so whoever is still in at showdown is, by construction, an eligible
// contributor to every layer up to their own total. computeSidePots is only
// meaningful once ≥2 players are still in — a hand decided by everyone else
// folding is resolved earlier (handEndedByFold) and never reaches this code.

// Resolve each pot's winner(s) given known hand evaluations.
// evalsByActor: { [actor]: evalResult|null } — null/missing = cards not
// revealed, so that pot can't be auto-resolved (caller falls back to manual).
// A pot with a single eligible player is won uncontested — no cards needed.
export function resolvePotWinners(pots, evalsByActor) {
  return pots.map(pot => {
    if (pot.eligible.length === 1) return { ...pot, winners: [pot.eligible[0]] };
    const known = pot.eligible.map(actor => ({ actor, ev: evalsByActor[actor] }));
    if (known.some(k => !k.ev)) return { ...pot, winners: null };
    let best = known[0].ev;
    known.forEach(k => { if (compareEvals(k.ev, best) > 0) best = k.ev; });
    const winners = known.filter(k => compareEvals(k.ev, best) === 0).map(k => k.actor);
    return { ...pot, winners };
  });
}

// The street after which no further betting is possible — among players
// still in the hand, at most one has chips left behind. Returns null if the
// hand never reaches that state, or is decided by folding instead (that's
// handEndedByFold's job, not this one).
export function getAllInLockStreet(handData, heroPosition, heroStack, opponents, sbSize, bbSize, ante, isTournament) {
  const { byStreet } = walkHand(handData, heroPosition, opponents, sbSize, bbSize, ante, isTournament);
  const initialStack = { hero: parseInt(heroStack) || 0 };
  opponents.forEach(o => { initialStack[String(o.id)] = o.stack || 0; });

  // Re-derive who had folded *by the end of* each street specifically (walkHand
  // only exposes the final all-streets fold set) by re-scanning fold actions
  // in street order alongside the contribution snapshots.
  const streets = handData?.streets || {};
  const foldedSoFar = new Set();
  for (const snap of byStreet) {
    (streets[snap.street]?.actions || []).forEach(a => {
      if (a.action === 'fold') foldedSoFar.add(String(a.actor));
    });
    const remaining = Object.keys(initialStack).filter(actor => !foldedSoFar.has(actor));
    if (remaining.length < 2) return null; // decided by fold, not by all-in
    const withChips = remaining.filter(actor => (initialStack[actor] - (snap.contributedAfter[actor] || 0)) > 0);
    if (withChips.length <= 1) return snap.street;
  }
  return null;
}
