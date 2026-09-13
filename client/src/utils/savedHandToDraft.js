/**
 * Opens a hand that was already saved back in HandLoggerWizard, for editing.
 *
 * Same handoff as narrationToDraft: the wizard hydrates everything from its
 * localStorage draft on mount, so editing is a matter of writing the saved row
 * in the draft's shape. `editingHandId` is what makes the summary step UPDATE
 * that row instead of saving a second copy of the hand.
 *
 * Unlike narrationToDraft, opponents keep their saved ids: every action in
 * hand_data already points at them, and renumbering would orphan the actions.
 */

import { HAND_LOGGER_DRAFT_KEY } from './handLoggerDraft';

const BLIND_PRESETS = ['25/50', '50/100', '100/200', '200/400', '400/800', '1000/2000'];
const STAKES_PRESETS = ['1/2', '2/5', '5/10', '10/20', '25/50'];

// The summary: the whole hand is visible there, and the step indicator jumps
// straight back to whichever step needs fixing.
const SUMMARY_STEP = 11;

export function savedHandToDraft(hand) {
  const hd = hand.hand_data || {};
  const opponents = (hd.opponents || []).map(o => ({ ...o }));

  const street = (st) => ({
    ...(st === 'preflop' ? {} : { board: hd.streets?.[st]?.board || [] }),
    actions: hd.streets?.[st]?.actions || [],
    pot: 0,
  });
  const showdown = hd.showdown || { reached: false, opponent_cards: [] };

  const isTournament = hand.game_type === 'tournament' || hand.game_type === 'tournament_online';
  const blindLabel = hand.blind_sb && hand.blind_bb ? `${hand.blind_sb}/${hand.blind_bb}` : '';
  const stakes = hand.cash_stakes || '';

  return {
    step: SUMMARY_STEP,
    editingHandId: hand.id,
    gameType: hand.game_type || null,
    tournamentStage: hand.tournament_stage || '',
    blindPreset: BLIND_PRESETS.includes(blindLabel) ? blindLabel : '',
    customSb: isTournament && hand.blind_sb ? String(hand.blind_sb) : '',
    customBb: isTournament && hand.blind_bb ? String(hand.blind_bb) : '',
    ante: hand.ante ?? 0,
    stakesPreset: STAKES_PRESETS.includes(stakes) ? stakes : '',
    customStakes: stakes && !STAKES_PRESETS.includes(stakes) ? stakes : '',
    playersCount: hand.players_count || (opponents.length + 1),
    opponents,
    heroPosition: hand.hero_position || '',
    heroStack: String(hand.hero_stack ?? ''),
    heroCards: hand.hero_cards || [],
    handData: {
      opponents,
      streets: { preflop: street('preflop'), flop: street('flop'), turn: street('turn'), river: street('river') },
      showdown,
    },
    result: hand.result || '',
    heroProfit: hand.hero_profit != null ? String(hand.hero_profit) : '',
    splitDist: {},
    notes: hand.notes || '',
    showShowdown: !!showdown.reached,
    oppRevealedCards: showdown.opponent_cards?.[0] || [],
    narrative: hand.narrative || '',
    autoDecided: false,
    autoReason: '',
    // Cards were already revealed when the hand was saved — don't ask again.
    revealedAtLock: !!showdown.reached,
    // buildState() saves pots[i].winners = potWinners[i]; this is the inverse.
    potWinners: Array.isArray(hd.pots) ? hd.pots.map(p => p.winners || []) : null,
  };
}

/** Writes the draft where HandLoggerWizard will pick it up on mount. */
export function stageSavedHandDraft(hand) {
  const draft = savedHandToDraft(hand);
  localStorage.setItem(HAND_LOGGER_DRAFT_KEY, JSON.stringify(draft));
  return draft;
}
