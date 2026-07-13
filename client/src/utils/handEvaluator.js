// Texas Hold'em hand evaluation — best 5-card hand ranking + comparison

const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const RANK_LABEL_HE = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
const RANK_WORD_EN = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two' };

function combinations(arr, k) {
  const results = [];
  const combo = [];
  function backtrack(start) {
    if (combo.length === k) { results.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return results;
}

// Evaluate exactly 5 cards → { category: 0-8, tiebreak: [...] } (higher = stronger)
function evaluate5(cards) {
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  const counts = {};
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const groups = Object.entries(counts)
    .map(([v, c]) => [parseInt(v, 10), c])
    .sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]));

  const uniqueVals = [...new Set(values)];
  let straightHigh = null;
  if (uniqueVals.length === 5) {
    if (uniqueVals[0] - uniqueVals[4] === 4) straightHigh = uniqueVals[0];
    else if (uniqueVals.join(',') === '14,5,4,3,2') straightHigh = 5; // wheel (A-2-3-4-5)
  }
  const isStraight = straightHigh !== null;

  if (isStraight && isFlush) return { category: 8, tiebreak: [straightHigh] };
  if (groups[0][1] === 4) return { category: 7, tiebreak: [groups[0][0], groups[1][0]] };
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return { category: 6, tiebreak: [groups[0][0], groups[1][0]] };
  if (isFlush) return { category: 5, tiebreak: values };
  if (isStraight) return { category: 4, tiebreak: [straightHigh] };
  if (groups[0][1] === 3) return { category: 3, tiebreak: [groups[0][0], ...groups.slice(1).map(g => g[0])] };
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const [hi, lo] = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return { category: 2, tiebreak: [hi, lo, groups[2][0]] };
  }
  if (groups[0][1] === 2) return { category: 1, tiebreak: [groups[0][0], ...groups.slice(1).map(g => g[0])] };
  return { category: 0, tiebreak: values };
}

// Best 5-card hand out of 5–7 cards (hole + board). Returns null if fewer than 5 known cards.
export function bestHandEval(holeCards, boardCards) {
  const all = [...(holeCards || []), ...(boardCards || [])].filter(c => c?.rank && c?.suit);
  if (all.length < 5) return null;
  const combos = all.length === 5 ? [all] : combinations(all, 5);
  let best = null;
  combos.forEach(combo => {
    const ev = evaluate5(combo);
    if (!best || compareEvals(ev, best) > 0) best = ev;
  });
  return best;
}

// > 0 if a beats b, < 0 if b beats a, 0 if tie
export function compareEvals(a, b) {
  if (!a || !b) return 0;
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreak[i] ?? 0;
    const bv = b.tiebreak[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function describeHandHe(ev) {
  if (!ev) return '';
  const [t0, t1] = ev.tiebreak;
  switch (ev.category) {
    case 8: return t0 === 14 ? 'רויאל פלאש' : `סטרייט פלאש עד ${RANK_LABEL_HE[t0]}`;
    case 7: return `רביעיית ${RANK_LABEL_HE[t0]}`;
    case 6: return `פול האוס, ${RANK_LABEL_HE[t0]} מלא ב-${RANK_LABEL_HE[t1]}`;
    case 5: return `פלאש עד ${RANK_LABEL_HE[t0]}`;
    case 4: return `סטרייט עד ${RANK_LABEL_HE[t0]}`;
    case 3: return `שלישיית ${RANK_LABEL_HE[t0]}`;
    case 2: return `שני זוגות, ${RANK_LABEL_HE[t0]} ו-${RANK_LABEL_HE[t1]}`;
    case 1: return `זוג ${RANK_LABEL_HE[t0]}`;
    default: return `קלף גבוה ${RANK_LABEL_HE[t0]}`;
  }
}

export function describeHandEn(ev) {
  if (!ev) return '';
  const [t0, t1] = ev.tiebreak;
  switch (ev.category) {
    case 8: return t0 === 14 ? 'a royal flush' : `a straight flush, ${RANK_WORD_EN[t0]} high`;
    case 7: return `four of a kind, ${RANK_WORD_EN[t0]}s`;
    case 6: return `a full house, ${RANK_WORD_EN[t0]}s full of ${RANK_WORD_EN[t1]}s`;
    case 5: return `a flush, ${RANK_WORD_EN[t0]} high`;
    case 4: return `a straight, ${RANK_WORD_EN[t0]} high`;
    case 3: return `three of a kind, ${RANK_WORD_EN[t0]}s`;
    case 2: return `two pair, ${RANK_WORD_EN[t0]}s and ${RANK_WORD_EN[t1]}s`;
    case 1: return `a pair of ${RANK_WORD_EN[t0]}s`;
    default: return `${RANK_WORD_EN[t0]} high`;
  }
}
