import { useState, useEffect } from 'react';
import CardPicker from './CardPicker';
import PositionSelector from './PositionSelector';
import ActionSelector from './ActionSelector';
import OpponentManager from './OpponentManager';
import HandSummary from './HandSummary';
import { generateNarrative } from '../../utils/handNarrative';
import { bestHandEval, compareEvals, describeHandHe } from '../../utils/handEvaluator';

const PREFLOP_ORDER  = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN'];

function sortedPlayers(heroPos, opponents, street) {
  const order = street === 'preflop' ? PREFLOP_ORDER : POSTFLOP_ORDER;
  const all = [
    { actor: 'hero', position: heroPos, label: '🦸 הירו' },
    ...opponents.map(o => ({ actor: o.id, position: o.position, label: `😈 ${o.label || 'יריב'}` })),
  ];
  return all.sort((a, b) => {
    const ai = order.indexOf(a.position);
    const bi = order.indexOf(b.position);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

const BLIND_PRESETS = ['25/50', '50/100', '100/200', '200/400', '400/800', '1000/2000'];
const STAKES_PRESETS = ['1/2', '2/5', '5/10', '10/20', '25/50'];
const STAGES = [
  { key: 'early',       label: 'שלב ראשוני', icon: '🌱' },
  { key: 'middle',      label: 'אמצע',        icon: '⚔️' },
  { key: 'final_table', label: 'שולחן גמר',   icon: '🏆' },
  { key: 'bubble',      label: 'בועה',         icon: '💥' },
  { key: 'heads_up',    label: 'ראש בראש',    icon: '🤜' },
];

const STEPS_TOURNAMENT = ['סוג', 'הגדרות', 'שחקנים', 'עמדה', 'קלפים', 'בקופה פרה-פלופ', 'פלופ', 'טרן', 'ריבר', 'קלפי יריב', 'תוצאה', 'סיכום'];
const STEPS_CASH        = ['סוג', 'הגדרות', 'שחקנים', 'עמדה', 'קלפים', 'בקופה פרה-פלופ', 'פלופ', 'טרן', 'ריבר', 'קלפי יריב', 'תוצאה', 'סיכום'];

function initHandData() {
  return {
    opponents: [],
    streets: {
      preflop: { actions: [], pot: 0 },
      flop:    { board: [], actions: [], pot: 0 },
      turn:    { board: [], actions: [], pot: 0 },
      river:   { board: [], actions: [], pot: 0 },
    },
    showdown: { reached: false, opponent_cards: [] },
  };
}

function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-0.5 flex-shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
            ${i < current ? 'bg-blue-600 text-white' : i === current ? 'bg-blue-500 text-white ring-2 ring-blue-400/40' : 'bg-slate-700 text-slate-500'}`}>
            {i < current ? '✓' : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-3 transition-all ${i < current ? 'bg-blue-600' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const DRAFT_KEY = 'handlogger_draft_v1';
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch { return null; }
}
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

export default function HandLoggerWizard({ onClose, onSaved }) {
  const _d = loadDraft();

  const [step, setStep] = useState(_d?.step ?? 0);
  const [gameType, setGameType] = useState(_d?.gameType ?? null);

  // Game context
  const [tournamentStage, setTournamentStage] = useState(_d?.tournamentStage ?? '');
  const [blindPreset, setBlindPreset] = useState(_d?.blindPreset ?? '');
  const [customSb, setCustomSb] = useState(_d?.customSb ?? '');
  const [customBb, setCustomBb] = useState(_d?.customBb ?? '');
  const [ante, setAnte] = useState(_d?.ante ?? 0);
  const [stakesPreset, setStakesPreset] = useState(_d?.stakesPreset ?? '');
  const [customStakes, setCustomStakes] = useState(_d?.customStakes ?? '');

  // Players
  const [playersCount, setPlayersCount] = useState(_d?.playersCount ?? 6);
  const [opponents, setOpponents] = useState(_d?.opponents ?? []);

  // Hero
  const [heroPosition, setHeroPosition] = useState(_d?.heroPosition ?? '');
  const [heroStack, setHeroStack] = useState(_d?.heroStack ?? '');
  const [heroCards, setHeroCards] = useState(_d?.heroCards ?? []);

  // Streets actions
  const [handData, setHandData] = useState(_d?.handData ?? initHandData);

  // Result
  const [result, setResult] = useState(_d?.result ?? '');
  const [heroProfit, setHeroProfit] = useState(_d?.heroProfit ?? '');
  const [splitDist, setSplitDist] = useState(_d?.splitDist ?? {});
  const [notes, setNotes] = useState(_d?.notes ?? '');
  const [showShowdown, setShowShowdown] = useState(_d?.showShowdown ?? false);
  const [oppRevealedCards, setOppRevealedCards] = useState(_d?.oppRevealedCards ?? []);
  const [autoDecided, setAutoDecided] = useState(_d?.autoDecided ?? false);
  const [autoReason, setAutoReason] = useState(_d?.autoReason ?? '');

  // Narrative (generated at result step)
  const [narrative, setNarrative] = useState(_d?.narrative ?? '');

  // Auto-save draft on every state change
  useEffect(() => {
    if (!gameType && step === 0) return; // don't save empty state
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step, gameType, tournamentStage, blindPreset, customSb, customBb, ante,
      stakesPreset, customStakes, playersCount, opponents, heroPosition, heroStack,
      heroCards, handData, result, heroProfit, splitDist, notes, showShowdown, oppRevealedCards, narrative,
      autoDecided, autoReason,
    }));
  }, [step, gameType, tournamentStage, blindPreset, customSb, customBb, ante,
      stakesPreset, customStakes, playersCount, opponents, heroPosition, heroStack,
      heroCards, handData, result, heroProfit, splitDist, notes, showShowdown, oppRevealedCards, narrative,
      autoDecided, autoReason]);

  // ── Auto-decide the winner at showdown ──────────────────────
  // A player who folds can never win, so a fold alone can settle the hand.
  // Otherwise, once every remaining player's cards are known, compare best 5-card hands.
  const getFoldedAll = () => new Set([
    ...getFoldedBefore('flop'),
    ...(handData.streets.flop?.actions  || []).filter(a => a.action === 'fold').map(a => a.actor),
    ...(handData.streets.turn?.actions  || []).filter(a => a.action === 'fold').map(a => a.actor),
    ...(handData.streets.river?.actions || []).filter(a => a.action === 'fold').map(a => a.actor),
  ]);

  const getShowdownPlayers = () => {
    const folded = getFoldedAll();
    return sortedPlayers(heroPosition, opponents, 'preflop').filter(p => !folded.has(p.actor));
  };

  const getRevealedCards = (actor) => {
    if (actor === 'hero') return heroCards;
    const idx = opponents.findIndex(o => String(o.id) === String(actor));
    if (idx < 0) return [];
    const cards = idx === 0 ? oppRevealedCards : (handData.showdown?.opponent_cards?.[idx] || []);
    return cards?.length === 2 ? cards : [];
  };

  const computeAutoResult = () => {
    const sdPlayers = getShowdownPlayers();
    const heroIn = sdPlayers.some(p => p.actor === 'hero');

    if (!heroIn) {
      const reason = sdPlayers.length === 1
        ? `קיפלת מול ${sdPlayers[0].label} — ${sdPlayers[0].label} מנצח בקופה`
        : 'קיפלת — הפסדת את הקופה';
      return { result: 'lost', winners: sdPlayers.map(p => p.actor), reason };
    }
    if (sdPlayers.length === 1) {
      return { result: 'won', winners: ['hero'], reason: 'כל היריבים קיפלו — ניצחת בקופה ללא קרב קלפים' };
    }

    // 2+ players remain — need everyone's cards to compare hand strength
    const withCards = sdPlayers.map(p => ({ ...p, cards: getRevealedCards(p.actor) }));
    if (withCards.some(p => p.cards.length !== 2)) return null;

    const evals = withCards.map(p => ({ ...p, ev: bestHandEval(p.cards, allBoardCards) }));
    if (evals.some(e => !e.ev)) return null;

    let best = evals[0].ev;
    evals.forEach(e => { if (compareEvals(e.ev, best) > 0) best = e.ev; });
    const winners = evals.filter(e => compareEvals(e.ev, best) === 0);

    if (winners.length > 1) {
      return {
        result: 'split', winners: winners.map(w => w.actor),
        reason: `חלוקה — ${winners.map(w => w.label).join(' + ')} עם ${describeHandHe(best)}`,
      };
    }
    const winner = winners[0];
    if (winner.actor === 'hero') {
      const others = evals.filter(e => e.actor !== 'hero').map(e => `${e.label} (${describeHandHe(e.ev)})`).join(', ');
      return { result: 'won', winners: ['hero'], reason: `${describeHandHe(best)} מנצח את ${others}` };
    }
    const heroEval = evals.find(e => e.actor === 'hero');
    return {
      result: 'lost', winners: [winner.actor],
      reason: `${winner.label} מנצח עם ${describeHandHe(best)} מול ${describeHandHe(heroEval.ev)} שלך`,
    };
  };

  const splitAmong = (pot, winnerActors, allPlayers) => {
    const dist = {};
    allPlayers.forEach(p => { dist[p.actor] = 0; });
    const n = Math.max(winnerActors.length, 1);
    const eq = Math.floor(pot / n);
    winnerActors.forEach((actor, i) => {
      dist[actor] = i === winnerActors.length - 1 ? pot - eq * (n - 1) : eq;
    });
    return dist;
  };

  const applyAutoResult = (auto) => {
    const finalPot = calculatePot('river');
    if (result !== auto.result) setResult(auto.result);
    if (auto.result === 'won') {
      if (heroProfit !== String(finalPot)) setHeroProfit(String(finalPot));
      if (Object.keys(splitDist).length) setSplitDist({});
    } else if (auto.result === 'lost') {
      if (heroProfit !== String(-finalPot)) setHeroProfit(String(-finalPot));
      if (Object.keys(splitDist).length) setSplitDist({});
    } else if (auto.result === 'split') {
      const dist = splitAmong(finalPot, auto.winners, getShowdownPlayers());
      if (JSON.stringify(dist) !== JSON.stringify(splitDist)) setSplitDist(dist);
      const heroAmt = String(dist['hero'] ?? 0);
      if (heroProfit !== heroAmt) setHeroProfit(heroAmt);
    }
    if (auto.reason !== autoReason) setAutoReason(auto.reason);
    if (!autoDecided) setAutoDecided(true);
  };

  useEffect(() => {
    if (step !== 10) return;
    const auto = computeAutoResult();
    if (!auto) return;
    if (result === '' || autoDecided) applyAutoResult(auto);
  }, [step, handData, oppRevealedCards, opponents, heroCards, heroPosition]);

  const isTournament = gameType === 'tournament' || gameType === 'tournament_online';
  const unit = isTournament ? 'BB' : '₪';

  // כמה שחקן כבר שילם כ-blind לפני האקשן (רלוונטי רק בפרה-פלופ)
  const getActorPosted = (actorId, street) => {
    if (street !== 'preflop') return 0;
    const { sb, bb } = getBlindSbBb();
    const pos = actorId === 'hero'
      ? heroPosition
      : opponents.find(o => o.id === actorId || o.id === parseInt(actorId))?.position;
    if (pos === 'BB') return bb || 0;
    if (pos === 'SB') return sb || 0;
    return 0;
  };
  const steps = gameType === 'cash' ? STEPS_CASH : STEPS_TOURNAMENT;
  const usedCards = heroCards;
  const allBoardCards = [
    ...handData.streets.flop.board,
    ...handData.streets.turn.board,
    ...handData.streets.river.board,
  ];

  const getBlindSbBb = () => ({
    sb: parseInt(customSb) || null,
    bb: parseInt(customBb) || null,
  });

  const buildState = () => {
    const { sb, bb } = getBlindSbBb();
    return {
      game_type: gameType,
      tournament_stage: tournamentStage,
      blind_sb: sb,
      blind_bb: bb,
      ante,
      cash_stakes: customStakes || stakesPreset,
      players_count: playersCount,
      hero_position: heroPosition,
      hero_stack: parseInt(heroStack) || 0,
      hero_cards: heroCards,
      hand_data: { ...handData, opponents },
      result,
      hero_profit: parseInt(heroProfit) || null,
      notes,
    };
  };

  const addAction = (street, action) => {
    setHandData(prev => ({
      ...prev,
      streets: {
        ...prev.streets,
        [street]: {
          ...prev.streets[street],
          actions: [...prev.streets[street].actions, action],
        },
      },
    }));
  };

  const removeAction = (street, index) => {
    setHandData(prev => ({
      ...prev,
      streets: {
        ...prev.streets,
        [street]: {
          ...prev.streets[street],
          actions: prev.streets[street].actions.filter((_, i) => i !== index),
        },
      },
    }));
  };

  const setBoard = (street, cards) => {
    setHandData(prev => ({
      ...prev,
      streets: { ...prev.streets, [street]: { ...prev.streets[street], board: cards } },
    }));
  };

  const setShowdownCards = (cards) => {
    setHandData(prev => ({
      ...prev,
      showdown: { reached: true, opponent_cards: [cards] },
    }));
    setOppRevealedCards(cards);
  };

  // מחזיר את רשימת השחקנים שעדיין צריכים לפעול בשלב הנוכחי
  const playersWhoNeedToAct = (actions, allPlayers) => {
    const foldedSet  = new Set(actions.filter(a => a.action === 'fold').map(a => a.actor));
    const allinSet   = new Set(actions.filter(a => a.action === 'allin').map(a => a.actor));

    // שחקנים שיכולים עדיין לפעול: לא קיפלו ולא אול-אין
    const canAct = allPlayers.filter(p => !foldedSet.has(p.actor) && !allinSet.has(p.actor));

    // מצא את הפעולה האגרסיבית האחרונה — כולל אול-אין
    let lastAggrIdx = -1, lastAggressor = null;
    for (let i = actions.length - 1; i >= 0; i--) {
      if (['bet', 'raise', 'three-bet', 'four-bet', 'allin'].includes(actions[i].action)) {
        lastAggrIdx = i; lastAggressor = actions[i].actor; break;
      }
    }

    if (lastAggrIdx === -1) {
      // אין הימור — שחקנים שעדיין לא פעלו כלל
      const actedSet = new Set(actions.map(a => a.actor));
      return canAct.filter(p => !actedSet.has(p.actor));
    }

    // יש הימור / אול-אין — כל שחקן שלא הגיב אחריו (חוץ מהמהמר עצמו)
    const actedAfter = new Set(actions.slice(lastAggrIdx + 1).map(a => a.actor));
    return canAct.filter(p => p.actor !== lastAggressor && !actedAfter.has(p.actor));
  };

  // ערימה נוכחית של שחקן — ראשוני מינוס כל מה שהכניס עד כה (כולל שלב נוכחי)
  const getPlayerCurrentStack = (actor, street) => {
    const initial = actor === 'hero'
      ? (parseInt(heroStack) || 0)
      : (opponents.find(o => String(o.id) === String(actor))?.stack || 0);
    return Math.max(0, initial - playerContribution(actor, street));
  };

  // האם היד נגמרה בשלב זה בגלל פולד (לא בגלל אול-אין)
  // מחזיר true רק כשנשאר פחות מ-2 שחקנים שלא קיפלו (ללא קשר לאול-אין)
  const handEndedByFold = (street) => {
    const allFolded = new Set([
      ...getFoldedBefore(street),
      ...(handData.streets[street]?.actions || [])
        .filter(a => a.action === 'fold').map(a => a.actor),
    ]);
    return sortedPlayers(heroPosition, opponents, street)
      .filter(p => !allFolded.has(p.actor)).length < 2;
  };

  // האם סיבוב ההימורים בשלב נגמר (אין שחקנים שצריכים לפעול)
  const streetRoundComplete = (street) => {
    const actions = handData.streets[street]?.actions || [];
    if (!actions.length) return false;
    const prevFolded = getFoldedBefore(street);
    const allPlayers = sortedPlayers(heroPosition, opponents, street)
      .filter(p => !prevFolded.has(p.actor));
    return playersWhoNeedToAct(actions, allPlayers).length === 0;
  };

  const canNext = () => {
    if (step === 0) return !!gameType;
    if (step === 1) {
      if (isTournament) return !!customBb;
      return !!stakesPreset || !!customStakes;
    }
    if (step === 3) return !!heroPosition;
    if (step === 4) return heroCards.length === 2;
    if (step === 5) {
      const actions = handData.streets.preflop.actions || [];
      if (!actions.length) return false;
      return playersWhoNeedToAct(actions, sortedPlayers(heroPosition, opponents, 'preflop')).length === 0;
    }
    if (step === 10) return !!result;
    return true;
  };

  const goNext = () => {
    if (step === 10) {
      const state = buildState();
      setNarrative(generateNarrative(state));
    }
    setStep(s => Math.min(s + 1, steps.length - 1));
  };
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  // אם היד כבר הוכרעה בפולד (פחות מ-2 שחקנים נותרו) — קפוץ ישר לתוצאה
  // במקום להעביר את המשתמש דרך שלבי פלופ/טרן/ריבר/קלפי-יריב ריקים
  const skipStreet = (street) => {
    if (handEndedByFold(street)) setStep(10);
    else goNext();
  };

  const stepLabel = steps[step] || '';

  const getFoldedBefore = (street) => {
    const order = ['preflop', 'flop', 'turn', 'river'];
    const folded = new Set();
    for (let i = 0; i < order.indexOf(street); i++) {
      (handData.streets[order[i]]?.actions || []).forEach(a => {
        if (a.action === 'fold') folded.add(a.actor);
      });
    }
    return folded;
  };

  const SUIT_COLORS = { s: '#1e293b', h: '#dc2626', d: '#1d4ed8', c: '#15803d' };

  const BoardDisplay = ({ cards, label }) => {
    if (!cards?.length) return null;
    return (
      <div className="flex items-center gap-2" dir="ltr">
        {label && <span className="text-[10px] text-slate-500 flex-shrink-0">{label}</span>}
        <div className="flex gap-1.5">
          {cards.map((c, i) => {
            const col = SUIT_COLORS[c.suit] || '#64748b';
            return (
              <div key={i}
                className="flex flex-col items-center justify-center w-9 h-12 rounded-lg border shadow-md"
                style={{ background: col, borderColor: '#fff2', boxShadow: `0 2px 8px ${col}60` }}>
                <span className="text-white font-black text-sm leading-none">{c.rank}</span>
                <span className="text-white text-sm leading-none">
                  {{ s: '♠', h: '♥', d: '♦', c: '♣' }[c.suit]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // סכום שהשחקן הכניס לקופה עד סוף השלב הנתון
  // הערה: סכומי BET/raise הם TOTAL (כולל ה-blind שלהם),
  // לכן אם שחקן הימר בפרה-פלופ אל תוסיף את ה-blind בנפרד — הוא כבר בפנים
  const playerContribution = (actor, upToStreet) => {
    const streetOrder = ['preflop', 'flop', 'turn', 'river'];
    let total = 0;
    for (const street of streetOrder) {
      const actions = handData.streets[street]?.actions || [];
      let streetTotal = 0;
      let hasBetThisStreet = false;
      actions.forEach(a => {
        if (String(a.actor) === String(actor)) {
          if (['bet', 'raise', 'three-bet', 'four-bet'].includes(a.action) && a.amount) {
            hasBetThisStreet = true;
          }
          if (a.amount) {
            const raw = String(a.amount);
            if (!raw.endsWith('%')) {
              const num = parseFloat(raw);
              if (!isNaN(num)) streetTotal += num;
            }
          }
        }
      });
      // blind רלוונטי רק בפרה-פלופ, ורק אם השחקן לא הימר
      // (אם הימר — סכום ה-BET כבר כולל את ה-blind)
      if (street === 'preflop' && !hasBetThisStreet) {
        total += getActorPosted(actor, 'preflop');
      }
      total += streetTotal;
      if (street === upToStreet) break;
    }
    return total;
  };

  // גובה הקופה = סכום תרומות כל השחקנים (כולל אנטה)
  const calculatePot = (upToStreet) => {
    const allActors = ['hero', ...opponents.map(o => String(o.id))];
    const pot = allActors.reduce((sum, actor) => sum + playerContribution(actor, upToStreet), 0);
    return pot + (isTournament ? (ante || 0) : 0);
  };

  const StackDisplay = ({ street }) => {
    const { bb } = getBlindSbBb();
    const allPlayers = [
      { actor: 'hero', label: '🦸 הירו', isHero: true,
        initial: parseInt(heroStack) || 0 },
      ...opponents.map(o => ({
        actor: String(o.id), label: o.label || `יריב`, isHero: false,
        initial: o.stack || 0,
      })),
    ].filter(p => !getFoldedBefore(street).has(p.actor));

    return (
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 px-3 py-2" dir="rtl">
        <div className="text-[10px] text-slate-500 font-bold mb-1.5 tracking-wide">ערימות שחקנים:</div>
        <div className="flex flex-col gap-1">
          {allPlayers.map(p => {
            const spent = playerContribution(p.actor, street);
            const remaining = Math.max(0, p.initial - spent);
            const bbs = bb && bb > 0 ? Number((remaining / bb).toFixed(1)) : null;
            return (
              <div key={p.actor} className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-mono tabular-nums">
                  {remaining.toLocaleString('he-IL')}
                  {bbs !== null && (
                    <span className="text-slate-500 ml-1">({bbs}BB)</span>
                  )}
                </span>
                <span className={`font-bold ${p.isHero ? 'text-blue-300' : 'text-orange-300'}`}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const PotDisplay = ({ street }) => {
    const pot = calculatePot(street);
    const { bb } = getBlindSbBb();
    const bbVal = bb || 1;
    const bbs = Number((pot / bbVal).toFixed(1));
    const label = isTournament
      ? `${pot.toLocaleString('he-IL')} צ'יפים (${bbs}BB)`
      : `₪${pot.toLocaleString('he-IL')} (${bbs}BB)`;

    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20" dir="rtl">
        <span className="text-amber-300 font-black text-sm">{label}</span>
        <span className="text-amber-400/70 text-xs font-bold">💰 גובה הקופה</span>
      </div>
    );
  };

  const actorName = (actor) => {
    if (actor === 'hero') return '🦸 הירו';
    const opp = opponents.find(o => o.id === actor || o.id === parseInt(actor));
    return `😈 ${opp?.label || 'יריב'}`;
  };

  const ACTION_DISPLAY = {
    fold: 'פולד', check: "צ'ק", limp: 'לימפ', call: 'קול',
    bet: 'BET', raise: 'BET', 'three-bet': '3BET', 'four-bet': '4BET', allin: 'אול-אין',
  };

  const ActionLog = ({ street }) => {
    const actions = handData.streets[street]?.actions || [];
    if (!actions.length) return null;
    return (
      <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-2 space-y-1 max-h-36 overflow-y-auto">
        {actions.map((a, i) => (
          <div key={i} className="flex items-center justify-between text-xs gap-2">
            <button onClick={() => removeAction(street, i)}
              className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-red-500/10">
              ✕
            </button>
            <span className={`flex-1 text-right ${a.actor === 'hero' ? 'text-blue-300' : 'text-orange-300'}`}>
              {actorName(a.actor)} — {ACTION_DISPLAY[a.action] || a.action}
              {a.amount && (() => {
                const bb = getBlindSbBb().bb;
                const raw = a.amount;
                const num = parseFloat(raw);
                if (raw.toString().endsWith('%') || isNaN(num)) {
                  return <span className="text-slate-300 font-mono mr-1"> {raw}</span>;
                }
                let displayNum = num;
                if (a.action === 'call') {
                  const lastRaise = actions.slice(0, i).reverse()
                    .find(pa => ['bet', 'raise', 'three-bet', 'four-bet', 'allin'].includes(pa.action) && pa.amount);
                  if (lastRaise) displayNum = parseFloat(lastRaise.amount) || num;
                }
                const bbs = bb && bb > 0 ? Number((displayNum / bb).toFixed(1)) : null;
                if (unit === 'BB') {
                  return (
                    <span className="text-slate-300 font-mono mr-1">
                      {' '}{displayNum.toLocaleString('he-IL')}{bbs ? ` (${bbs}BB)` : ''}
                    </span>
                  );
                } else {
                  return (
                    <span className="text-slate-300 font-mono mr-1">
                      {' '}₪{displayNum.toLocaleString('he-IL')}{bbs ? ` (${bbs}BB)` : ''}
                    </span>
                  );
                }
              })()}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // ── Render steps ──────────────────────────────────
  const renderStep = () => {
    // 0: Game type
    if (step === 0) return (
      <div className="grid grid-cols-2 gap-3 py-4">
        {[
          { key: 'tournament',        icon: '🏆', label: 'טורניר לייב' },
          { key: 'cash',              icon: '💰', label: 'קאש לייב'    },
          { key: 'tournament_online', icon: '💻', label: 'טורניר אונליין' },
          { key: 'cash_online',       icon: '🖥️', label: 'קאש אונליין'   },
        ].map(g => (
          <button key={g.key} onClick={() => { setGameType(g.key); setStep(1); }}
            className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95
              ${gameType === g.key ? 'border-blue-400 bg-blue-600/20 shadow-lg shadow-blue-500/20' : 'border-slate-600 bg-slate-800/40 hover:border-blue-500/50'}`}>
            <span className="text-4xl">{g.icon}</span>
            <span className="font-bold text-slate-200 text-sm">{g.label}</span>
          </button>
        ))}
      </div>
    );

    // 1: Game context
    if (step === 1) {
      if (isTournament) return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 text-right">שלב הטורניר</label>
            <div className="flex flex-wrap gap-2 justify-end">
              {STAGES.map(s => (
                <button key={s.key} onClick={() => setTournamentStage(s.key)}
                  className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all flex items-center gap-1.5
                    ${tournamentStage === s.key ? 'border-blue-400 bg-blue-600/20 text-white' : 'border-slate-600 bg-slate-800/40 text-slate-300 hover:border-blue-500/50'}`}>
                  <span>{s.icon}</span>{s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 text-right">בליינדים</label>
            {/* Presets */}
            <div className="flex flex-wrap gap-2 justify-end mb-3">
              {BLIND_PRESETS.map(b => (
                <button key={b}
                  onClick={() => {
                    const [sb, bb] = b.split('/');
                    setBlindPreset(b);
                    setCustomSb(sb);
                    setCustomBb(bb);
                    setAnte(parseInt(bb) || 0);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-all
                    ${blindPreset === b ? 'border-blue-400 bg-blue-600/20 text-white' : 'border-slate-600 text-slate-300 hover:border-blue-500/50'}`}>
                  {b}
                </button>
              ))}
            </div>
            {/* SB / BB split inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 text-right">Big Blind</label>
                <input
                  type="number" min="1" placeholder="200"
                  value={customBb}
                  onChange={e => {
                    const bb = e.target.value;
                    setCustomBb(bb);
                    setBlindPreset('');
                    const bbNum = parseInt(bb);
                    if (bbNum > 0) {
                      setCustomSb(String(bbNum / 2));
                      setAnte(bbNum);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 text-right">Small Blind</label>
                <input
                  type="number" min="1" placeholder="100"
                  value={customSb}
                  onChange={e => { setCustomSb(e.target.value); setBlindPreset(''); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 text-right">אנטה (צ'יפים)</label>
            <input
              type="number" min="0" placeholder="200"
              value={ante}
              onChange={e => setAnte(parseInt(e.target.value) || 0)}
              className="w-28 px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      );
      // Cash context
      return (
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-300 mb-2 text-right">סטייקס</label>
          <div className="flex flex-wrap gap-2 justify-end">
            {STAKES_PRESETS.map(s => (
              <button key={s} onClick={() => { setStakesPreset(s); setCustomStakes(''); }}
                className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all
                  ${stakesPreset === s && !customStakes ? 'border-blue-400 bg-blue-600/20 text-white' : 'border-slate-600 text-slate-300 hover:border-blue-500/50'}`}>
                {s}₪
              </button>
            ))}
          </div>
          <input type="text" placeholder="מותאם: 50/100"
            value={customStakes} onChange={e => { setCustomStakes(e.target.value); setStakesPreset(''); }}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none"
          />
        </div>
      );
    }

    // 2: Players
    if (step === 2) return (
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-3 text-right">כמה שחקנים בשולחן?</label>
          <div className="flex items-center gap-4 justify-center">
            <button onClick={() => setPlayersCount(c => Math.max(2, c - 1))}
              className="w-10 h-10 rounded-full border border-slate-600 text-slate-300 text-xl font-bold hover:border-blue-500 hover:text-white transition-all">
              −
            </button>
            <div className="text-3xl font-black text-white w-12 text-center">{playersCount}</div>
            <button onClick={() => setPlayersCount(c => Math.min(9, c + 1))}
              className="w-10 h-10 rounded-full border border-slate-600 text-slate-300 text-xl font-bold hover:border-blue-500 hover:text-white transition-all">
              +
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 text-right">הערימה שלך — Hero</label>
          <input type="number" min="1" placeholder={unit === 'BB' ? '50' : '200'}
            value={heroStack}
            onChange={e => {
              const val = e.target.value;
              setHeroStack(val);
              const num = parseInt(val) || 0;
              if (num > 0) {
                setOpponents(prev => prev.map(o => ({ ...o, stack: num })));
              }
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm text-right focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 text-right">יריב\ים</label>
          <OpponentManager opponents={opponents} onChange={setOpponents} heroPosition={heroPosition} unit={unit} heroStack={heroStack} />
        </div>
      </div>
    );

    // 3: Position
    if (step === 3) return (
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3 text-center">בחר את עמדתך בשולחן</label>
        <PositionSelector selected={heroPosition} onChange={setHeroPosition} playersCount={playersCount} />
      </div>
    );

    // 4: Hero cards
    if (step === 4) return (
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3 text-right">בחר את הקלפים שלך (2 קלפים)</label>
        <CardPicker selected={heroCards} onChange={setHeroCards} max={2} />
      </div>
    );

    // 5: Preflop
    if (step === 5) return (
      <div className="space-y-3">
        <PotDisplay street="preflop" />
        <div className="text-xs text-slate-300 text-right">פעל לפי סדר הפעולות של השחקנים שהשתתפו ביד</div>
        {/* Actions log */}
        <ActionLog street="preflop" />
        <PotDisplay street="preflop" />
        <StackDisplay street="preflop" />
        {playersWhoNeedToAct(
          handData.streets.preflop.actions,
          sortedPlayers(heroPosition, opponents, 'preflop')
        ).map(p => (
          <ActionSelector key={`preflop-${p.actor}-${handData.streets.preflop.actions.length}`}
            actor={p.actor} label={p.label} unit={unit} street="preflop"
            priorActions={handData.streets.preflop.actions}
            blindBb={getBlindSbBb().bb} blindSb={getBlindSbBb().sb}
            actorPosted={getActorPosted(p.actor, 'preflop')}
            playerStack={getPlayerCurrentStack(p.actor, 'preflop')}
            onAction={a => addAction('preflop', { ...a, actor: p.actor })} />
        ))}
        <button onClick={() => skipStreet('preflop')}
          className="w-full py-2 rounded-xl text-xs text-slate-500 border border-dashed border-slate-700 hover:border-slate-600 hover:text-slate-400 transition-all">
          ⏭ דלג לפלופ (קיפלנו / ניצחנו)
        </button>
      </div>
    );

    // 6: Flop
    if (step === 6) return (
      <div className="space-y-3">
        <PotDisplay street="flop" />
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 text-right">3 קלפי הפלופ</label>
          <CardPicker selected={handData.streets.flop.board} onChange={c => setBoard('flop', c)}
            max={3} disabled={[...usedCards]} />
        </div>
        {handData.streets.flop.board.length === 3 && (
          <div className="space-y-2">
            <div className="text-xs text-slate-300 font-bold text-right">פעולות פוסט-פלופ:</div>
            <ActionLog street="flop" />
            <PotDisplay street="flop" />
            <StackDisplay street="flop" />
            {playersWhoNeedToAct(
              handData.streets.flop.actions,
              sortedPlayers(heroPosition, opponents, 'flop').filter(p => !getFoldedBefore('flop').has(p.actor))
            ).map(p => (
              <ActionSelector key={`flop-${p.actor}-${handData.streets.flop.actions.length}`}
                actor={p.actor} label={p.label} unit={unit} street="flop"
                priorActions={handData.streets.flop.actions}
                blindBb={getBlindSbBb().bb} blindSb={getBlindSbBb().sb}
                playerStack={getPlayerCurrentStack(p.actor, 'flop')}
                onAction={a => addAction('flop', { ...a, actor: p.actor })} />
            ))}
          </div>
        )}
        {handEndedByFold('flop') && (
          <button onClick={() => skipStreet('flop')}
            className="w-full py-2 rounded-xl text-xs text-slate-500 border border-dashed border-slate-700 hover:border-slate-600 hover:text-slate-400 transition-all">
            ⏭ דלג — היד הסתיימה בפלופ
          </button>
        )}
      </div>
    );

    // 7: Turn
    if (step === 7) return (
      <div className="space-y-3">
        <BoardDisplay cards={handData.streets.flop.board} label="פלופ:" />
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 text-right">קלף הטרן</label>
          <CardPicker selected={handData.streets.turn.board} onChange={c => setBoard('turn', c)}
            max={1} disabled={[...usedCards, ...handData.streets.flop.board]} />
        </div>
        {handData.streets.turn.board.length === 1 && (
          <div className="space-y-2">
            <div className="text-xs text-slate-300 font-bold text-right">פעולות טרן:</div>
            <ActionLog street="turn" />
            <PotDisplay street="turn" />
            <StackDisplay street="turn" />
            {playersWhoNeedToAct(
              handData.streets.turn.actions,
              sortedPlayers(heroPosition, opponents, 'turn').filter(p => !getFoldedBefore('turn').has(p.actor))
            ).map(p => (
              <ActionSelector key={`turn-${p.actor}-${handData.streets.turn.actions.length}`}
                actor={p.actor} label={p.label} unit={unit} street="turn"
                priorActions={handData.streets.turn.actions}
                blindBb={getBlindSbBb().bb} blindSb={getBlindSbBb().sb}
                playerStack={getPlayerCurrentStack(p.actor, 'turn')}
                onAction={a => addAction('turn', { ...a, actor: p.actor })} />
            ))}
          </div>
        )}
        {handEndedByFold('turn') && (
          <button onClick={() => skipStreet('turn')}
            className="w-full py-2 rounded-xl text-xs text-slate-500 border border-dashed border-slate-700 hover:border-slate-600 hover:text-slate-400 transition-all">
            ⏭ דלג — היד הסתיימה בטרן
          </button>
        )}
      </div>
    );

    // 8: River
    if (step === 8) return (
      <div className="space-y-3">
        <div className="flex flex-col gap-2">
          <BoardDisplay cards={handData.streets.flop.board} label="פלופ:" />
          <BoardDisplay cards={handData.streets.turn.board} label="טרן:" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2 text-right">קלף הריבר</label>
          <CardPicker
            selected={handData.streets.river.board}
            onChange={c => setBoard('river', c)}
            max={1}
            disabled={[...usedCards, ...handData.streets.flop.board, ...handData.streets.turn.board]}
          />
        </div>
        {handData.streets.river.board.length === 1 && (
          <div className="space-y-2">
            <div className="text-xs text-slate-300 font-bold text-right">פעולות ריבר:</div>
            <ActionLog street="river" />
            <PotDisplay street="river" />
            <StackDisplay street="river" />
            {playersWhoNeedToAct(
              handData.streets.river.actions,
              sortedPlayers(heroPosition, opponents, 'river').filter(p => !getFoldedBefore('river').has(p.actor))
            ).map(p => (
              <ActionSelector key={`river-${p.actor}-${handData.streets.river.actions.length}`}
                actor={p.actor} label={p.label} unit={unit} street="river"
                priorActions={handData.streets.river.actions}
                blindBb={getBlindSbBb().bb} blindSb={getBlindSbBb().sb}
                playerStack={getPlayerCurrentStack(p.actor, 'river')}
                onAction={a => addAction('river', { ...a, actor: p.actor })} />
            ))}
          </div>
        )}
        {!streetRoundComplete('river') && (
          <button onClick={() => skipStreet('river')}
            className="w-full py-2 rounded-xl text-xs text-slate-500 border border-dashed border-slate-700 hover:border-slate-600 hover:text-slate-400 transition-all">
            ⏭ המשך לתוצאה
          </button>
        )}
      </div>
    );

    // 10: Result
    if (step === 10) {
      const finalPot = calculatePot('river');
      const { bb } = getBlindSbBb();
      const potBbs = bb ? Number((finalPot / bb).toFixed(1)) : null;
      const potLabel = isTournament
        ? `${finalPot.toLocaleString('he-IL')} צ'יפים${potBbs ? ` (${potBbs}BB)` : ''}`
        : `₪${finalPot.toLocaleString('he-IL')}${potBbs ? ` (${potBbs}BB)` : ''}`;

      // שחקנים שלא קיפלו — נמצאים בשואודאון
      const sdPlayers = getShowdownPlayers();

      const PLAYER_COLORS = ['#3b82f6','#f97316','#22c55e','#a855f7','#ef4444','#06b6d4'];

      const initEqualSplit = (pot, players) => {
        const n = Math.max(players.length, 1);
        const eq = Math.round(pot / n);
        const dist = {};
        players.forEach((p, i) => {
          dist[p.actor] = i === n - 1 ? pot - eq * (n - 1) : eq;
        });
        return dist;
      };

      const handleSplitChange = (actor, val) => {
        const num = parseInt(val) || 0;
        const next = { ...splitDist, [actor]: num };
        setSplitDist(next);
        if (actor === 'hero') setHeroProfit(String(num));
      };

      const totalSplit = Object.values(splitDist).reduce((s, v) => s + (parseInt(v) || 0), 0);
      const splitValid = totalSplit === finalPot;

      return (
      <div className="space-y-4">
        {/* Pot display */}
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30" dir="rtl">
          <span className="text-amber-300 font-black text-lg">{potLabel}</span>
          <span className="text-amber-400/70 text-sm font-bold">💰 קופה סופית</span>
        </div>

        {autoDecided && autoReason && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30" dir="rtl">
            <span className="text-lg flex-shrink-0">🤖</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-blue-300">התוצאה זוהתה אוטומטית</div>
              <div className="text-xs text-slate-400 mt-0.5">{autoReason}</div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-3 text-right">
            מי ניצח את הקופה?
            {autoDecided && <span className="text-slate-500 font-normal"> (ניתן לשנות ידנית)</span>}
          </label>
          <div className="flex gap-2 justify-center">
            {[
              { key: 'won',   icon: '🏆', label: 'ניצחתי',  color: 'border-emerald-400 bg-emerald-600/20' },
              { key: 'lost',  icon: '💀', label: 'הפסדתי',  color: 'border-red-400    bg-red-600/20'     },
              { key: 'split', icon: '🤝', label: 'חלוקה',   color: 'border-amber-400  bg-amber-600/20'   },
            ].map(r => (
              <button key={r.key}
                onClick={() => {
                  setAutoDecided(false);
                  setResult(r.key);
                  if (r.key === 'won')  { setHeroProfit(String(finalPot));  setSplitDist({}); }
                  if (r.key === 'lost') { setHeroProfit(String(-finalPot)); setSplitDist({}); }
                  if (r.key === 'split') {
                    const dist = initEqualSplit(finalPot, sdPlayers);
                    setSplitDist(dist);
                    setHeroProfit(String(dist['hero'] ?? 0));
                  }
                }}
                className={`flex-1 max-w-[110px] flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all hover:scale-105
                  ${result === r.key ? r.color + ' scale-105 shadow-lg' : 'border-slate-600 bg-slate-800/40'}`}>
                <span className="text-3xl">{r.icon}</span>
                <span className="text-sm font-bold text-slate-200">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Split editor ── */}
        {result === 'split' && sdPlayers.length > 0 && (
          <div className="space-y-3 p-3 rounded-xl bg-slate-800/60 border border-amber-500/30" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const dist = initEqualSplit(finalPot, sdPlayers);
                  setSplitDist(dist);
                  setHeroProfit(String(dist['hero'] ?? 0));
                }}
                className="text-xs text-amber-400/80 hover:text-amber-300 font-bold border border-amber-500/30 rounded-lg px-2 py-1 hover:border-amber-400/50 transition-all">
                ⚖️ חלוקה שווה
              </button>
              <span className="text-xs font-bold text-slate-400">חלוקת הקופה:</span>
            </div>

            {/* Proportional bar */}
            {finalPot > 0 && (
              <div className="flex h-6 rounded-xl overflow-hidden" dir="ltr">
                {sdPlayers.map((p, i) => {
                  const amt = parseInt(splitDist[p.actor]) || 0;
                  const pct = Math.max(0, (amt / finalPot) * 100);
                  return (
                    <div key={p.actor}
                      className="transition-all duration-300 relative flex items-center justify-center overflow-hidden"
                      style={{ width: `${pct}%`, backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length], minWidth: pct > 3 ? undefined : 0 }}>
                      {pct > 8 && (
                        <span className="text-[10px] font-black text-white/90 truncate px-1">
                          {Math.round(pct)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Player rows */}
            {sdPlayers.map((p, i) => {
              const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
              const amt = parseInt(splitDist[p.actor]) || 0;
              const pct = finalPot > 0 ? Math.round(amt / finalPot * 100) : 0;
              const bbs = bb && bb > 0 ? Number((amt / bb).toFixed(1)) : null;
              return (
                <div key={p.actor} className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{pct}%</span>
                    <input
                      type="number" min="0" max={finalPot}
                      value={splitDist[p.actor] ?? ''}
                      onChange={e => handleSplitChange(p.actor, e.target.value)}
                      className="w-28 px-2 py-1 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm text-right focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {bbs !== null && (
                      <span className="text-[10px] font-mono text-slate-500">{bbs}BB</span>
                    )}
                    <span className="text-sm font-bold" style={{ color }}>{p.label}</span>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  </div>
                </div>
              );
            })}

            {/* Validation */}
            <div className={`text-xs text-right font-bold ${splitValid ? 'text-emerald-400' : 'text-red-400'}`}>
              {splitValid
                ? '✓ חלוקה תקינה'
                : `⚠️ סה"כ: ${totalSplit.toLocaleString('he-IL')} ≠ ${finalPot.toLocaleString('he-IL')}`}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1 text-right">הערות אישיות (אופציונלי)</label>
          <textarea rows={2} placeholder="מה חשבתי? מה אפשר לעשות אחרת?"
            value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm text-right resize-none focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
      );
    }

    // 9: Opponent cards (optional)
    if (step === 9) return (
      <div className="space-y-3" dir="rtl">
        {/* Board cards */}
        {(() => {
          const f = handData.streets.flop?.board  || [];
          const t = handData.streets.turn?.board  || [];
          const r = handData.streets.river?.board || [];
          return f.length > 0 ? (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700">
              <BoardDisplay cards={f} label="פלופ:" />
              {t.length > 0 && <BoardDisplay cards={t} label="טרן:" />}
              {r.length > 0 && <BoardDisplay cards={r} label="ריבר:" />}
            </div>
          ) : null;
        })()}
        <PotDisplay street="river" />
        <p className="text-sm text-slate-400 text-right">
          במידה וגילינו את קלפי היריב — הזן אותם כאן. ניתן לדלג.
        </p>
        {opponents.length === 0 && (
          <p className="text-xs text-slate-500 text-right">לא הוזנו יריבים בשלב 3.</p>
        )}
        {opponents.map((opp, i) => (
          <div key={opp.id}>
            <label className="block text-sm font-bold text-slate-300 mb-2 text-right">
              קלפי {opp.label || `יריב ${i + 1}`}
            </label>
            <CardPicker
              selected={i === 0 ? oppRevealedCards : (handData.showdown?.opponent_cards?.[i] || [])}
              onChange={c => {
                if (i === 0) { setOppRevealedCards(c); setShowdownCards(c); }
                else {
                  setHandData(prev => ({
                    ...prev,
                    showdown: {
                      reached: true,
                      opponent_cards: prev.showdown.opponent_cards.map((oc, j) => j === i ? c : oc),
                    },
                  }));
                }
              }}
              max={2}
              disabled={[...heroCards, ...allBoardCards]}
            />
          </div>
        ))}
        <button onClick={goNext}
          className="w-full py-2 rounded-xl text-xs text-slate-500 border border-dashed border-slate-700 hover:border-slate-600 hover:text-slate-400 transition-all">
          ⏭ דלג — קלפי היריב לא נגלו
        </button>
      </div>
    );

    // 11: Summary
    if (step === 11) return (
      <HandSummary
        handState={buildState()}
        narrative={narrative}
        onSaveSuccess={() => { clearDraft(); onSaved?.(); }}
        onReset={() => { clearDraft(); setStep(0); setGameType(null); setHandData(initHandData()); setHeroCards([]); setOpponents([]); setResult(''); setNarrative(''); setOppRevealedCards([]); setHeroProfit(''); setSplitDist({}); setNotes(''); setAutoDecided(false); setAutoReason(''); }}
      />
    );

    return null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="always-dark w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0d1526', border: '1px solid rgba(29,78,216,0.25)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(29,78,216,0.15)' }}>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-lg">
            ✕
          </button>
          <h2 className="text-base font-black text-white">🃏 רישום יד פוקר</h2>
          <span className="text-xs text-slate-500">{step + 1}/{steps.length}</span>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <StepIndicator steps={steps} current={step} />
          <div className="text-xs font-bold text-blue-400 text-right mt-1">{stepLabel}</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4" dir="rtl">
          {renderStep()}
        </div>

        {/* Footer nav */}
        {step < 12 && (
          <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0"
            style={{ borderColor: 'rgba(29,78,216,0.15)' }}>
            {step > 0 && (
              <button onClick={goBack}
                className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm font-bold hover:border-slate-500 hover:text-slate-200 transition-all">
                ← חזור
              </button>
            )}
            <button onClick={goNext} disabled={!canNext()}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: canNext() ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : undefined,
                backgroundColor: canNext() ? undefined : '#1e293b',
                color: canNext() ? '#fff' : '#64748b',
                boxShadow: canNext() ? '0 0 16px rgba(29,78,216,0.3)' : 'none',
              }}>
              {step === 10 ? '✅ צור סיכום' : 'הבא →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
