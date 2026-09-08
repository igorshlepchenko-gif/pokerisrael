/**
 * Converts the narration parser's output into a HandLoggerWizard draft.
 *
 * The wizard hydrates its entire state from localStorage on mount (loadDraft()
 * in HandLoggerWizard.jsx), so handing off is a matter of writing a draft in
 * exactly its shape and then opening it — no changes to the wizard at all.
 * That keeps the narration feature what it was always meant to be: an
 * alternative way IN to the same hand, never a second engine.
 *
 * Two shape differences matter and are handled here:
 *   1. The server returns buildState()'s shape (blind_sb, hero_cards, hand_data…);
 *      the draft uses the wizard's own field names (customSb, heroCards, handData…).
 *   2. Actions in the wizard reference opponents by numeric `id`, not by label —
 *      sortedPlayers() maps `actor: o.id`, and getRevealedCards() looks players up
 *      with String(o.id) === String(actor). The parser talks in labels, so every
 *      actor is rewritten to its opponent's id below. Getting this wrong would
 *      silently break fold tracking, showdown detection and the video.
 */

import { HAND_LOGGER_DRAFT_KEY } from './handLoggerDraft';
import { generateNarrative } from './handNarrative';

const BLIND_PRESETS = ['25/50', '50/100', '100/200', '200/400', '400/800', '1000/2000'];
const STAKES_PRESETS = ['1/2', '2/5', '5/10', '10/20', '25/50'];

const SUMMARY_STEP = 11;

/**
 * @param {object} wizardState - the server's `wizardState` (buildState shape)
 * @returns {object} a draft object matching HandLoggerWizard's localStorage schema
 */
export function narrationToDraft(wizardState) {
  const s = wizardState || {};
  const hd = s.hand_data || {};

  // Stable ids derived from index rather than Date.now(), so the same parse
  // always produces the same draft — makes the handoff reproducible and keeps
  // React keys stable if the player steps back into the wizard to edit.
  const opponents = (hd.opponents || []).map((o, i) => ({
    id: i + 1,
    label: o.label || `יריב ${i + 1}`,
    position: o.position || '',
    stack: o.stack ?? (parseInt(s.hero_stack) || 100),
    stackTouched: false,
    cards: o.cards || null,
  }));

  // label → id, with 'hero' passing through untouched.
  const actorId = new Map(opponents.map(o => [o.label, o.id]));
  const toActor = (actor) => {
    if (actor === 'hero') return 'hero';
    const id = actorId.get(actor);
    // An unmatched label would produce an action belonging to nobody, which the
    // wizard renders as a ghost player. Fall back to the first opponent so the
    // action stays visible and editable rather than vanishing.
    return id !== undefined ? id : (opponents[0]?.id ?? 'hero');
  };

  const streets = {};
  for (const st of ['preflop', 'flop', 'turn', 'river']) {
    const src = hd.streets?.[st] || {};
    streets[st] = {
      board: st === 'preflop' ? undefined : (src.board || []),
      actions: (src.actions || []).map(a => ({ ...a, actor: toActor(a.actor) })),
      pot: 0,
    };
    if (st === 'preflop') delete streets[st].board;
  }

  const handData = {
    opponents,
    streets,
    showdown: hd.showdown || { reached: false, opponent_cards: [] },
  };

  const isTournament = s.game_type === 'tournament' || s.game_type === 'tournament_online';
  const blindLabel = s.blind_sb && s.blind_bb ? `${s.blind_sb}/${s.blind_bb}` : '';
  const stakes = s.cash_stakes || '';

  // The wizard keeps preset and custom values in separate fields and shows
  // whichever is set; match a preset when we can so the UI highlights it.
  const draft = {
    step: SUMMARY_STEP,
    gameType: s.game_type || null,
    tournamentStage: s.tournament_stage || '',
    blindPreset: BLIND_PRESETS.includes(blindLabel) ? blindLabel : '',
    customSb: isTournament && s.blind_sb ? String(s.blind_sb) : '',
    customBb: isTournament && s.blind_bb ? String(s.blind_bb) : '',
    ante: s.ante ?? 0,
    stakesPreset: STAKES_PRESETS.includes(stakes) ? stakes : '',
    customStakes: stakes && !STAKES_PRESETS.includes(stakes) ? stakes : '',
    playersCount: s.players_count || (opponents.length + 1),
    opponents,
    heroPosition: s.hero_position || '',
    heroStack: String(s.hero_stack ?? ''),
    heroCards: s.hero_cards || [],
    handData,
    result: s.result || 'unknown',
    heroProfit: s.hero_profit != null ? String(s.hero_profit) : '',
    splitDist: {},
    notes: s.notes || '',
    showShowdown: !!handData.showdown.reached,
    oppRevealedCards: [],
    // The wizard normally generates this on the way into the summary step; we
    // land there directly, so it has to be ready or the summary opens blank.
    narrative: safeNarrative(s),
    autoDecided: false,
    autoReason: '',
    revealedAtLock: false,
    potWinners: null,
  };

  return draft;
}

// A narrative failure must not cost the player the whole parse — the summary
// step can regenerate, and every other field is still good.
function safeNarrative(state) {
  try {
    return generateNarrative(state);
  } catch (e) {
    console.warn('[Narration] narrative generation failed:', e?.message);
    return '';
  }
}

/** Writes the draft where HandLoggerWizard will pick it up on mount. */
export function stageNarrationDraft(wizardState) {
  const draft = narrationToDraft(wizardState);
  localStorage.setItem(HAND_LOGGER_DRAFT_KEY, JSON.stringify(draft));
  return draft;
}
