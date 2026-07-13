// PokerStars-style hand history generator for PokerIsrael
import { bestHandEval, describeHandEn } from './handEvaluator';

const POSITION_ORDER = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function psCard(c) {
  if (!c || !c.rank || !c.suit) return '??';
  return `${c.rank}${c.suit}`;
}

function psCards(arr) {
  if (!arr || !arr.length) return '';
  return `[${arr.map(psCard).join(' ')}]`;
}

// Convert stored action amount to display string
function fmtAmount(raw, isCash, bbSize, street) {
  if (raw === null || raw === undefined || raw === '') return '';
  const str = String(raw).trim();
  if (str.endsWith('%')) return str; // percentage — keep as-is
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  if (isCash) {
    return `$${num % 1 === 0 ? num : num.toFixed(2)}`;
  }
  // Tournament: preflop amounts are stored as BB multiples (e.g. "3" = 3BB = 2400 chips)
  if (street === 'preflop' && bbSize && num <= 200) {
    return String(Math.round(num * bbSize));
  }
  return String(Math.round(num));
}

function actorLabel(actor, opponents) {
  if (actor === 'hero') return 'Hero';
  const opp = opponents.find(o => o.id === actor || o.id === parseInt(actor));
  return opp?.label || 'Villain';
}

function buildActionLine(a, opponents, isCash, bbSize, sbSize, street, hadAggression) {
  const name = actorLabel(a.actor, opponents);
  const cur = isCash ? '$' : '';

  switch (a.action) {
    case 'fold':
      return `${name}: folds`;
    case 'check':
      return `${name}: checks`;
    case 'limp':
      return `${name}: calls ${cur}${isCash ? (bbSize || 2) : (bbSize || 100)}`;
    case 'call': {
      const amt = a.amount ? fmtAmount(a.amount, isCash, bbSize, street) : '';
      return `${name}: calls ${amt}`;
    }
    case 'raise':
    case 'three-bet':
    case 'four-bet': {
      const amt = a.amount ? fmtAmount(a.amount, isCash, bbSize, street) : '';
      // Postflop: first aggression is a "bet", subsequent are "raise"
      if (street !== 'preflop' && !hadAggression) {
        return `${name}: bets ${amt}`;
      }
      return `${name}: raises to ${amt}`;
    }
    case 'allin':
      return `${name}: raises and is all-in`;
    default:
      return `${name}: ${a.action}${a.amount ? ' ' + fmtAmount(a.amount, isCash, bbSize, street) : ''}`;
  }
}

function isAggressive(action) {
  return ['raise', 'three-bet', 'four-bet', 'allin'].includes(action);
}

// Best 5-card hand strength from hole cards + board (shared evaluator)
function handStrength(holeCards, boardCards) {
  if (!holeCards || holeCards.length < 2) return 'best hand';
  const ev = bestHandEval(holeCards, boardCards);
  return ev ? describeHandEn(ev) : 'best hand';
}

export function generateNarrative(state) {
  if (!state) return '';

  const {
    game_type,
    tournament_stage,
    blind_sb,
    blind_bb,
    ante,
    cash_stakes,
    players_count = 6,
    hero_position,
    hero_stack,
    hero_cards = [],
    hand_data = {},
    result,
    hero_profit,
  } = state;

  const { opponents = [], streets = {}, showdown } = hand_data;
  const isCash = game_type === 'cash' || game_type === 'cash_online';
  const isOnline = game_type === 'tournament_online' || game_type === 'cash_online';

  // Parse blinds
  let sbSize = blind_sb;
  let bbSize = blind_bb;
  if (isCash && cash_stakes && !sbSize) {
    const parts = cash_stakes.replace(/[^0-9./]/g, '').split('/');
    sbSize = parseFloat(parts[0]) || 1;
    bbSize = parseFloat(parts[1]) || 2;
  }

  const handId = Math.floor(Date.now() % 10_000_000_000);
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').split('.')[0] + ' EET';

  const lines = [];

  // ── Header ────────────────────────────────────────────────
  if (isCash) {
    const stakesFmt = cash_stakes
      ? cash_stakes.replace(/([0-9.]+)\/([0-9.]+)/, '$$$1/$$$2') + ' USD'
      : '$1/$2 USD';
    const cashType = isOnline ? 'Online ' : '';
    lines.push(`PokerIsrael Hand #${handId}: ${cashType}Hold'em No Limit (${stakesFmt}) - ${dateStr}`);
  } else {
    const stageLvl = { early: 'I', middle: 'V', final_table: 'X', bubble: 'XII', heads_up: 'XV' };
    const level = stageLvl[tournament_stage] || 'I';
    const blindStr = sbSize && bbSize ? `${sbSize}/${bbSize}` : '100/200';
    const anteStr = ante > 0 ? ` ante ${ante}` : '';
    const tournType = isOnline ? 'Online Tournament - ' : '';
    lines.push(`PokerIsrael Hand #${handId}: ${tournType}Hold'em No Limit - Level ${level} (${blindStr}${anteStr}) - ${dateStr}`);
  }

  // ── Table line ─────────────────────────────────────────────
  lines.push(`Table 'PokerIsrael' ${players_count}-max Seat #1 is the button`);

  // ── Build ordered player list ──────────────────────────────
  const heroEntry = { name: 'Hero', position: hero_position, stack: hero_stack || 200 };
  const allPlayers = [
    heroEntry,
    ...opponents.map(o => ({ name: o.label || 'Villain', position: o.position, stack: o.stack || 100 })),
  ].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.position);
    const bi = POSITION_ORDER.indexOf(b.position);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  // ── Seat listing ───────────────────────────────────────────
  allPlayers.forEach((p, i) => {
    const stackFmt = isCash ? `$${p.stack}` : `${p.stack}`;
    lines.push(`Seat ${i + 1}: ${p.name} (${stackFmt} in chips)`);
  });

  // ── Antes (tournament) ─────────────────────────────────────
  if (!isCash && ante > 0) {
    allPlayers.forEach(p => lines.push(`${p.name}: posts the ante ${ante}`));
  }

  // ── Blinds ─────────────────────────────────────────────────
  const sbPlayer = allPlayers.find(p => p.position === 'SB');
  const bbPlayer = allPlayers.find(p => p.position === 'BB');
  if (sbPlayer && sbSize) {
    lines.push(`${sbPlayer.name}: posts small blind ${isCash ? '$' : ''}${sbSize}`);
  }
  if (bbPlayer && bbSize) {
    lines.push(`${bbPlayer.name}: posts big blind ${isCash ? '$' : ''}${bbSize}`);
  }

  // ── Hole cards ─────────────────────────────────────────────
  lines.push('*** HOLE CARDS ***');
  if (hero_cards.length === 2) {
    lines.push(`Dealt to Hero ${psCards(hero_cards)}`);
  }

  // ── Preflop actions ────────────────────────────────────────
  const preActions = streets.preflop?.actions || [];
  if (preActions.length) {
    let hadAgg = false;
    preActions.forEach(a => {
      lines.push(buildActionLine(a, opponents, isCash, bbSize, sbSize, 'preflop', hadAgg));
      if (isAggressive(a.action)) hadAgg = true;
    });
  }

  // Collected board cards
  const flop  = streets.flop  || {};
  const turn  = streets.turn  || {};
  const river = streets.river || {};
  const allBoard = [...(flop.board || []), ...(turn.board || []), ...(river.board || [])];

  // ── Flop ───────────────────────────────────────────────────
  if (flop.board?.length >= 3) {
    lines.push(`*** FLOP *** ${psCards(flop.board)}`);
    let hadAgg = false;
    (flop.actions || []).forEach(a => {
      lines.push(buildActionLine(a, opponents, isCash, null, null, 'flop', hadAgg));
      if (isAggressive(a.action)) hadAgg = true;
    });
  }

  // ── Turn ───────────────────────────────────────────────────
  if (turn.board?.length >= 1) {
    lines.push(`*** TURN *** ${psCards(flop.board || [])} ${psCards(turn.board)}`);
    let hadAgg = false;
    (turn.actions || []).forEach(a => {
      lines.push(buildActionLine(a, opponents, isCash, null, null, 'turn', hadAgg));
      if (isAggressive(a.action)) hadAgg = true;
    });
  }

  // ── River ──────────────────────────────────────────────────
  if (river.board?.length >= 1) {
    lines.push(`*** RIVER *** ${psCards([...(flop.board || []), ...(turn.board || [])])} ${psCards(river.board)}`);
    let hadAgg = false;
    (river.actions || []).forEach(a => {
      lines.push(buildActionLine(a, opponents, isCash, null, null, 'river', hadAgg));
      if (isAggressive(a.action)) hadAgg = true;
    });
  }

  // ── Showdown ───────────────────────────────────────────────
  const atShowdown = showdown?.reached || (result && allBoard.length > 0);
  if (atShowdown) {
    lines.push('*** SHOW DOWN ***');

    if (result === 'won') {
      const strength = handStrength(hero_cards, allBoard);
      lines.push(`Hero: shows ${psCards(hero_cards)} (${strength})`);
      // Opponents: show their cards if we have them, else muck
      (showdown?.opponent_cards || []).forEach((oc, i) => {
        const opp = opponents[i];
        const oppName = opp?.label || `Villain${i + 1}`;
        if (oc?.length) {
          const oppStrength = handStrength(oc, allBoard);
          lines.push(`${oppName}: shows ${psCards(oc)} (${oppStrength})`);
        } else {
          lines.push(`${oppName}: mucks hand`);
        }
      });
      const potFmt = hero_profit ? `${isCash ? '$' : ''}${Math.abs(hero_profit)}` : 'the pot';
      lines.push(`Hero collected ${potFmt} from pot`);

    } else if (result === 'lost') {
      lines.push(`Hero: mucks hand`);
      (showdown?.opponent_cards || []).forEach((oc, i) => {
        const opp = opponents[i];
        const oppName = opp?.label || `Villain${i + 1}`;
        if (oc?.length) {
          const strength = handStrength(oc, allBoard);
          lines.push(`${oppName}: shows ${psCards(oc)} (${strength})`);
          const potFmt = hero_profit ? `${isCash ? '$' : ''}${Math.abs(hero_profit)}` : 'the pot';
          lines.push(`${oppName} collected ${potFmt} from pot`);
        }
      });

    } else if (result === 'split') {
      const strength = handStrength(hero_cards, allBoard);
      lines.push(`Hero: shows ${psCards(hero_cards)} (${strength})`);
      (showdown?.opponent_cards || []).forEach((oc, i) => {
        const opp = opponents[i];
        const oppName = opp?.label || `Villain${i + 1}`;
        if (oc?.length) {
          const s = handStrength(oc, allBoard);
          lines.push(`${oppName}: shows ${psCards(oc)} (${s})`);
        }
      });
      const halfFmt = hero_profit ? `${isCash ? '$' : ''}${Math.abs(hero_profit)}` : 'half the pot';
      lines.push(`Hero collected ${halfFmt} from pot`);
      if (opponents[0]) {
        lines.push(`${opponents[0].label || 'Villain'} collected ${halfFmt} from pot`);
      }
    }
  } else if (result) {
    // No showdown — hand ended without going to river/showdown
    if (result === 'won') {
      const potFmt = hero_profit ? `${isCash ? '$' : ''}${Math.abs(hero_profit)}` : 'the pot';
      lines.push(`Hero collected ${potFmt} from pot`);
    }
  }

  // ── Summary ────────────────────────────────────────────────
  lines.push('*** SUMMARY ***');
  const rakeAmt = isCash ? '$0' : '0';
  if (hero_profit) {
    const potEst = result === 'won'
      ? `${isCash ? '$' : ''}${Math.abs(hero_profit)}`
      : result === 'lost'
        ? `${isCash ? '$' : ''}${Math.abs(hero_profit) * 2}`
        : `${isCash ? '$' : ''}${Math.abs(hero_profit) * 2}`;
    lines.push(`Total pot ${potEst} | Rake ${rakeAmt}`);
  } else {
    lines.push(`Total pot unknown | Rake ${rakeAmt}`);
  }
  if (allBoard.length > 0) {
    lines.push(`Board ${psCards(allBoard)}`);
  }

  // Seat results in summary
  allPlayers.forEach((p, i) => {
    let suffix = '';
    if (p.name === 'Hero') {
      if (result === 'won') {
        const won = hero_profit ? `${isCash ? '$' : ''}${Math.abs(hero_profit)}` : '';
        suffix = ` (${hero_position}) won ${won}`;
      } else if (result === 'lost') {
        suffix = ` (${hero_position}) lost`;
      } else if (result === 'split') {
        suffix = ` (${hero_position}) split pot`;
      } else {
        suffix = ` (${hero_position})`;
      }
    } else {
      suffix = ` (${p.position || '?'})`;
    }
    lines.push(`Seat ${i + 1}: ${p.name}${suffix}`);
  });

  return lines.join('\n');
}
