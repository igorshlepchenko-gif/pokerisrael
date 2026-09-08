/**
 * Hand Logger — natural-language narration parser (pilot).
 *
 * Takes a player's free-text description of a poker hand (Hebrew, English,
 * slang, shorthand, any mix) and extracts it into the exact same hand_data
 * shape the step-by-step wizard (HandLoggerWizard.jsx buildState()) produces,
 * so the existing narrative/video/save pipeline needs no changes at all.
 *
 * SCOPE: this module EXTRACTS ONLY. It deliberately does not decide what is
 * missing or what to ask next — that lives in services/narrationGaps.js as
 * plain deterministic JS. Fixture runs showed the model was both inconsistent
 * at judging completeness and prone to demanding optional details (stack
 * sizes, suits of a pocket pair), which is the opposite of the "skip whatever
 * can be skipped" product decision. Keeping the model's output narrow also
 * makes it shorter, faster, and far less likely to fail JSON validation.
 *
 * Runs on Claude. Structured outputs were tried first and rejected by the API:
 * this schema hits three separate limits (>16 union params, >24 optional params,
 * and finally a flat "Schema is too complex" from the grammar compiler) and only
 * fits by gutting the validation that made it worth having. Since
 * narrationGaps.sanitize() already rejects every off-schema value — bad ranks,
 * suits, positions, actions — the only gap structured outputs would have closed
 * is unparseable JSON, which the single retry below handles directly.
 */

const Anthropic = require('@anthropic-ai/sdk');

// Chosen on fixture evidence, 2026-09-03 (scripts/testHandNarration.js).
// Groq's free tier caps at 200,000 tokens/day — about 55 hand parses for the
// whole site — so it could not host this feature at any quality level. Haiku
// scored 83/84 fields at a steady ~3s, against Groq's 1.6-37s swing under
// throttling. Re-run the fixtures before changing this.
const DEFAULT_MODEL = process.env.HAND_NARRATION_MODEL || 'claude-haiku-4-5';

// Reading a hand out of a screenshot is a much harder task than reading one out
// of text, and it is measurably beyond Haiku: on a real 7XL hand-history image
// (2026-09-04) Haiku could not tell which seat was the hero — the layout marks
// opponent actions with an avatar and leaves the hero's bare — so it attributed
// every action, and the win, to the opponent. Sonnet read the same image
// correctly: right hero, right three-card flop, right winner. Images are
// occasional and small, so the extra cost is a few tenths of a cent per upload.
const VISION_MODEL = process.env.HAND_VISION_MODEL || 'claude-sonnet-5';

let _client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) {
    // An identity-linked key is scoped to a workspace and the API rejects it
    // with a 400 unless the request names that workspace.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
    });
  }
  return _client;
}

// ── Schema + rules the model must follow exactly ──────────────────────────────
// Field names/encodings here are load-bearing: they must match
// HandLoggerWizard.jsx's buildState() / ActionSelector.jsx / CardPicker.jsx
// exactly, since the output feeds the same save/video pipeline unchanged.
const HAND_SCHEMA_SYSTEM = `You are a No-Limit Hold'em hand extractor for a Hebrew-language poker app.

A player describes a hand they played, in free text: Hebrew, English, slang, shorthand,
transcribed speech, any mix. Your ONLY job is to convert what they said into the app's
structured schema. Each call also gives you the state confirmed in earlier turns plus a new
message (often the player's answer to a question we asked) — merge the new information into
the prior state. Never discard previously confirmed values unless the new message clearly
corrects them.

You do NOT decide what is missing, you do NOT ask questions, and you do NOT judge whether the
hand is complete. Separate code handles that. Extract what is there; leave out what is not.

Return ONLY valid JSON, no markdown, no commentary — exactly this shape:
{
  "extracted": { ...merged hand state, see SCHEMA... },
  "contradiction": null | { "field": "field_id", "description": "short Hebrew description of the inconsistency" }
}

═══ SCHEMA — "extracted" (use exactly these field names; omit a field entirely if the player
gave nothing about it) ═══
- game_type: "tournament" | "cash" | "tournament_online" | "cash_online"
  ⚠ Set this ONLY when the player actually indicated the format (said tournament/טורניר,
  cash/קאש, online/אונליין, or gave blind levels vs. stakes). Do NOT infer it from vibes.
  ⚠ A club or venue name is NOT evidence of the format. "האוס", "EVPlus", "ShowDown",
  "WSOP" and the like tell you where the game was, nothing about whether it was cash or a
  tournament — those venues run both. Ignore venue names entirely; do not put them in
  game_type, and do not let them tip a guess either way.
  Omitting it is correct and costs nothing: separate code treats an unstated format as a
  TOURNAMENT, which is what almost every hand logged here is, and the player can change it
  in one tap afterwards.
  ⚠ The one signal that reliably means CASH is money: stakes quoted in real currency —
  "1/2$", "5/10 ש״ח", "€2/5", "שקל", "דולר", "יורו", ₪ / $ / € — as opposed to tournament
  chips. If you see currency on the stakes, set a cash game_type. Without currency and
  without the word קאש/cash, leave game_type out and let it default.
- players_count: how many were at the table, ONLY when the text says so ("9 בשולחן",
  "שיחקנו 6-handed", "הד-אפ" = 2). Do not count the players you happened to see mentioned —
  code does that. This is here so a stated size can be checked against the stated seats.
- tournament_stage: "early"|"middle"|"final_table"|"bubble"|"heads_up"
- blind_sb, blind_bb: the blind numbers, WHENEVER the player states them — tournament or
  cash, it does not matter. Written many ways, all the same pair: "500/1000", "500-1000",
  "בליינדים 500 1000", and the very common misspelling "בלינדים". A lone number
  ("בליינד 1000") is the BIG blind — set blind_bb and leave blind_sb out. Look in a note's
  title line too, not only the body.
  ⚠ Never rescale them. "500-1000" is blind_sb 500, blind_bb 1000 — NOT 0.5 and 1. Israeli
  live club games run blinds denominated in chips (500/1000 with a 200k stack is normal),
  and the chip scale is what later code uses to make sense of bet sizes.
- cash_stakes: the stakes exactly as the player wrote them, e.g. "1/2" or "500-1000" (cash
  only). This is a display string — when the numbers are there, ALSO fill blind_sb/blind_bb.
- ante: number
- hero_stack: number
- hero_cards: array of exactly 2 card objects
- hero_cards_suited: true | false  (only when suits are unknown but suitedness was stated)
- opponents: array of {"label": string, "position": one of the 8 positions, "stack": number,
    "cards": [2 cards] — ONLY when that opponent showed their hand at showdown}
  ⚠ Capture EVERY position the text actually states. "MikeBillions מ-UTG קיפל" fixes that
  player at UTG; "Charles מהבאטן קרא" fixes Charles at BTN. Missing one is not harmless —
  code downstream hands out the remaining seats in a fixed order to fill the holes, so a
  position you drop comes back as a different, wrong seat that the player never said.
- hero_position: set it ONLY when the text says where the hero sat. Do NOT derive it from
  the order people acted in — that needs the exact table size and full seat order, and
  getting it wrong plants a seat the player never claimed. Leave it out and it gets asked.
- actions: ONE flat list of every action in the hand, in the order they happened,
    each tagged with its street: {"street": "preflop"|"flop"|"turn"|"river", "actor": ...,
    "action": ..., "amount": ...}. Do not nest by street — one sequential list.
- board: ONE flat list of the community cards, each tagged with the street it came on:
    {"street": "flop"|"turn"|"river", "rank": ..., "suit": ...}. The flop contributes three
    entries with street "flop", the turn one entry, the river one entry.
- result: "won" | "lost" | "split" | "unknown"
- notes: string

═══ CARDS — the single most important encoding rule ═══
READ THIS FIRST: מלכה is the QUEEN (Q). מלך is the KING (K). They differ only by the final ה,
and confusing them silently records the wrong hand. Before emitting any card from a Hebrew
word, check the last letter: ends in ה → Q, ends in ך → K.
  "מלכה עלה"  → {"rank":"Q","suit":"s"}
  "מלך עלה"   → {"rank":"K","suit":"s"}
  "אס עלה ומלכה עלה" → [{"rank":"A","suit":"s"},{"rank":"Q","suit":"s"}]

A card is {"rank": ..., "suit": ...}.
- rank: one of A,K,Q,J,T,9,8,7,6,5,4,3,2. TEN IS ALWAYS "T", NEVER "10" and never 10.
- suit: one of s (spades/עלה/פיק), h (hearts/לב), d (diamonds/יהלום), c (clubs/תלתן).
- **If the player named a rank but not its suit, emit the card with "suit": null.**
  NEVER drop the card, never null the whole hero_cards array, and never invent a suit.
  "היה לי QQ" → [{"rank":"Q","suit":null},{"rank":"Q","suit":null}] — this is a COMPLETE,
  correct answer. Suits are optional in this app; the player is not required to remember them.
- Two ranks written together followed by ONE suit word means BOTH cards are that suit:
  "46פיק" → [{"rank":"4","suit":"s"},{"rank":"6","suit":"s"}], "AK עלה" → both spades,
  "T9 לב" → both hearts. Do not give the suit to only the second card.
- "AKs" means ace+king of the SAME suit but does not say which: emit both with suit null,
  and set "hero_cards_suited": true. "AKo"/"AK offsuit"/"בשני צבעים" → suits null,
  "hero_cards_suited": false. Omit hero_cards_suited when the player didn't indicate either
  way. (When both suits are stated explicitly this field is unnecessary — omit it.)
- Hebrew ranks: אס=A, מלך=K, מלכה/גברת/קווין=Q, ג'ק/נסיך=J, עשר/עשרייה=T, תשע=9, שמונה=8,
  שבע=7, שש=6, חמש=5, ארבע=4, שלוש=3, שתיים/דויס=2.
- Normalize obvious speech-transcription corruption when the intent is clear — e.g. "ילד יהלום"
  is a mis-hearing of "ג'ק יהלום" = {"rank":"J","suit":"d"}. If genuinely ambiguous, set a
  contradiction instead of guessing.
- Board cards use the exact same object shape, and carry suits WHENEVER the player gave them.
  Shorthand board notation is rank+suit with no space — read the second character as the suit:
  "flop Ks 7h 2d" → [{"rank":"K","suit":"s"},{"rank":"7","suit":"h"},{"rank":"2","suit":"d"}].
  Only when the player really named no suit does the board card get "suit": null —
  "פלופ A 7 2" → three cards with suit null.

═══ ACTIONS ═══
Each action: {"actor": "hero" or the opponent's label, "action": ..., "amount": string | null}
- amount is a STRING: chips as digits ("1500"), or a pot fraction ("75%"). null if unstated.
The ONLY legal .action values: fold, check, limp, call, bet, three-bet, four-bet, allin.

FIRST decide WHICH action the player described, using this table. Only the last row is
subject to the aggression-counting rule below — never apply that rule to any other row:
  fold  ← קיפל, זרק, ויתר, פרש, folded, mucked
  check ← צ׳ק, צ׳קתי, העביר, דפק על השולחן, checked
  call  ← קרא, שילם, השווה, קולל, called
  limp  ← לימפ, נכנס בזול, limped   (preflop only, no prior aggression)
  allin ← אול אין, דחף, הלך על הכל, שם הכל, jammed, shoved, all-in
  AGGRESSION ← פתח, העלה, רייז, ריז, הימר, בט, 3בט, 4בט, רי-רייז, opened, raised, bet, c-bet
- A street's last action is very often a fold. Do not let the aggression counter run past the
  end of the actual betting: if the player says someone folded, that action is "fold", full stop.

- The AGGRESSION row is NEVER stored literally. Resolve it by counting the aggressive
  actions (bet/three-bet/four-bet/allin) that already happened THIS STREET before it:
  1st aggressive action of the street = "bet", 2nd = "three-bet", 3rd = "four-bet",
  4th and beyond = "four-bet" as well (the app has no five-bet value).
  So preflop "UTG פתח ל-500, אני 3בטתי ל-1500" → bet 500, then three-bet 1500.
- Use the player's own label for opponents when they named one ("יוסי"), otherwise their
  position ("UTG"), otherwise "יריב 1", "יריב 2" — and stay consistent for the whole hand.
- "limp" only preflop, only with no prior aggression that street.
- allin: amount = the chips pushed in THAT action only, not the player's total commitment.
- pot-fraction wording maps to a percent string: "חצי קופה" → "50%",
  "75 אחוז מהקופה" → "75%", "פוט" / "הימר קופה" → "100%".
- If the player describes an action without a size, use "amount": null. That is fine.
- Write the number EXACTLY as the player wrote it. Live players use thousands shorthand
  ("אני 5" at 500/1000 blinds means 5,000) — do NOT expand it yourself and do not convert
  units. Separate code rescales against the blind level, and it can only do that correctly
  if you pass the number through untouched.

═══ POSITIONS ═══
Ten seat names exist: SB, BB, UTG, UTG+1, MP, MP+1, LJ, HJ, CO, BTN.
Hebrew/slang: באטן/כפתור/דילר/D=BTN, קאט אוף/קו=CO, הייג'ק=HJ, לוג'ק=LJ, סמול=SB, ביג=BB,
אנדר דה גאן=UTG. 7XL and GGPoker write "MP1" for what this app calls LJ, and "D" for BTN.

WHICH SEATS EXIST DEPENDS ON THE TABLE SIZE. A short table drops seats from the MIDDLE of
the field; the blinds and the button are always there:
   6 players:  SB BB UTG HJ CO BTN
   7 players:  SB BB UTG LJ HJ CO BTN
   8 players:  SB BB UTG MP LJ HJ CO BTN
   9 players:  SB BB UTG UTG+1 MP LJ HJ CO BTN
  10 players:  SB BB UTG UTG+1 MP MP+1 LJ HJ CO BTN
So "UTG+1" at a six-handed table is a contradiction — that seat only exists nine-handed or
bigger, and LJ only from seven. If the stated table size and a stated seat cannot both be
true, flag it rather than silently moving anyone.
- Preflop acting order runs from UTG round to the button and the blinds act LAST:
  UTG→UTG+1→MP→MP+1→LJ→HJ→CO→BTN→SB→BB, skipping whichever seats the table size omits.
- WHO CAN OPEN PREFLOP: the blinds act LAST preflop, so "פתחתי" / "הימרתי ראשון" /
  "I opened" almost always means a seat between UTG and BTN. Never place the opener in SB
  or BB just because a seat was free. The only two ways a blind is the first raiser:
    (a) everyone folded around to the SB, which can then open against the BB — the BB can
        never open this way, because if it folds to the big blind the hand is already over;
    (b) someone limped or called first, and then a blind raises over them.
  If the player says they opened and gives no position, leave hero_position out rather than
  guessing a blind — separate code will ask them.
- Postflop acting order starts at the small blind and ends at the button:
  SB→BB→UTG→UTG+1→MP→MP+1→LJ→HJ→CO→BTN, again skipping the seats that do not exist.

═══ RESULT — extract it whenever the player says how it ended ═══
- Hero won the pot ("לקחתי", "גרפתי", "ניצחתי", "הוא קיפל" when hero was last aggressor,
  "הקופה שלי") → "won"
- Hero lost ("הפסדתי", "הוא הראה X ולקח", "קיפלתי" as hero's own last action) → "lost"
- Chopped ("חצי חצי", "צ'ופ", "split") → "split"
- The narration deliberately stops at a decision point and asks the reader what to do
  ("מה הייתם עושים?", "לא מספר מה עשיתי") → "unknown". This is a complete valid answer.
- Only omit result if the player genuinely never indicated an ending.
- Slang for a busted hand: "אויר", "בלוף", "מיס", "לא פגע", "ריק" all mean the opponent had
  NOTHING. If the hand went to showdown and the opponent is described that way, hero won.
- ⚠ If deciding the winner would require you to actually compare two poker hands against the
  board, DO NOT guess — omit result entirely. The app treats a missing result as a decision
  point and asks; a confidently wrong "lost" on a hand the player won is far worse.
- In particular: hero CALLING a bet at showdown tells you nothing about who won. Neither does
  simply being told what the opponent held. Unless the narration says outright who took the
  pot, or describes the opponent's hand as busted (אויר / בלוף / מיס), leave result out.

═══ CONTRADICTIONS — flag, never silently "fix" ═══
Set "contradiction" (and still return everything you did extract) when the narration violates
NLH or itself. Real examples:
- A position that cannot exist at the stated table size ("הד-אפ" + a CO seat).
- A fold with no bet outstanding to face — preflop everyone faces the BB, so this means
  postflop: a player folding on a street where nobody has bet yet.
- Preflop check by anyone other than the BB, when there was no raise.
- The same player acting twice in a row with nobody acting in between.
- A raise smaller than the legal minimum (min-raise = the size of the previous raise this round).
Do NOT flag merely incomplete information — a missing blind level, unknown suits, unnamed
opponents and unstated stacks are all normal and expected, never contradictions.

A contradiction means two things the player SAID cannot both be true. Your own uncertainty is
not a contradiction. If you cannot tell what a field should be, leave that field out and say
nothing — separate code notices the hole and asks the player directly, which is both faster
and more reliable than reasoning about it here. Never write a contradiction whose text amounts
to "the player didn't say" or "it cannot be determined from the information given".`;

/**
 * Assembles the user-turn payload. Exported so scripts/testHandNarration.js can
 * exercise the exact same prompt against different providers.
 */
function buildUserContent(message, priorState = null, history = []) {
  const historyText = history.length
    ? history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join('\n')
    : '(none yet)';

  return [
    `Already-confirmed state so far (JSON, empty object if nothing yet):`,
    JSON.stringify(priorState || {}),
    ``,
    `Conversation so far:`,
    historyText,
    ``,
    `New message from the player:`,
    message,
  ].join('\n');
}

/**
 * @param {string} message - the player's latest free text (initial narration, or an answer)
 * @param {object|null} priorState - the "extracted" object from the previous call, or null
 * @param {Array<{question:string, answer:string}>} history - prior Q&A turns, for context
 * @returns {Promise<object|null>} {extracted, contradiction}, or null if unavailable/unparseable
 */
/** Strips markdown fences a model sometimes adds despite being told not to. */
function extractJson(text) {
  const t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : t;
}

async function callModel(client, userContent, nudge) {
  const r = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    temperature: 0.1,
    system: HAND_SCHEMA_SYSTEM,
    messages: [
      { role: 'user', content: nudge ? `${userContent}

${nudge}` : userContent },
      // Prefill commits the model to bare JSON with no preamble. Supported on
      // Haiku 4.5; it is rejected on Sonnet 5 / Opus 5 / the 4.6+ family, so a
      // model change here needs this revisited.
      { role: 'assistant', content: '{' },
    ],
  });
  return '{' + extractJson(r.content.find(b => b.type === 'text')?.text || '');
}

/**
 * @param {string} message - the player's latest free text (initial narration, or an answer)
 * @param {object|null} priorState - the "extracted" object from the previous call, or null
 * @param {Array<{question:string, answer:string}>} history - prior Q&A turns, for context
 * @returns {Promise<object|null>} {extracted, contradiction}, or null if unavailable/unparseable
 */
async function parseHandNarration(message, priorState = null, history = []) {
  const client = getClient();
  if (!client) return null;

  const userContent = buildUserContent(message, priorState, history);

  try {
    const raw = await callModel(client, userContent);
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      // Observed once in 15 fixtures: an array closed with "}" instead of "]".
      // Reproducible on that input, so a plain retry would repeat it — the
      // nudge is what makes the second attempt different.
      console.warn('[HandNarration] invalid JSON, retrying once:', parseErr.message);
      const retry = await callModel(client, userContent,
        'CRITICAL: your previous reply was not valid JSON. Check every bracket — ' +
        'arrays close with "]" and objects close with "}". Return only the JSON object.');
      return JSON.parse(retry);
    }
  } catch (e) {
    console.error('[HandNarration] parse error:', e?.message);
    return null;
  }
}

// ── Image → text ─────────────────────────────────────────────────────────────

// Kept separate from extraction on purpose: the image becomes TEXT the player
// can see and correct, and only then goes through the normal parser. A misread
// screenshot is common (blurry phone photo, cropped hand history, handwriting)
// and it must not turn into a saved hand nobody checked.
const IMAGE_READ_SYSTEM = `You read poker hands out of images for a Hebrew-language poker app.

FIRST decide which kind of image this is, because they need opposite treatment:

(A) THE IMAGE IS ALREADY TEXT — a note, a chat screenshot, a typed hand history.
    → TRANSCRIBE IT VERBATIM. Copy the words exactly as written, including shorthand,
      slang, abbreviations and odd punctuation. Do NOT rephrase, do NOT expand shorthand,
      do NOT reorder, do NOT "improve" the grammar, do NOT drop a clause because it looks
      redundant. A downstream parser is built for exactly this kind of raw player shorthand,
      and every word you rewrite is a detail it can no longer recover. If a word is genuinely
      illegible, write it as best you can read it rather than guessing a different word.
      Include EVERY line of text in the image — titles, headings and anything above the main
      body included. A note's title is very often where the stakes live ("האוס 200k בלינדים
      500-1000"), and dropping it costs the blind level. Skip only UI chrome that is clearly
      not part of what the person wrote (app menus, battery and clock, button labels).

(B) THE IMAGE IS A VISUAL TABLE — a poker client, a broadcast, a photo of live play, or a
    hand-history diagram with seats and action bubbles.
    → Write out what the hand was, in natural language, the way a player would tell it.
      Include every detail you can actually see: game type, blinds or stakes, positions,
      hole cards, each betting action with its size, the board cards per street, the outcome.

    WHO IS THE HERO — get this right before anything else, because attributing the hand to
    the wrong player corrupts every line that follows:
      · The hero is the seat at the BOTTOM CENTRE, and/or the one whose hole cards are shown
        face-up while others are face-down, and/or the highlighted seat.
      · In 7XL / GGPoker / PokerStars hand-history layouts the action list shows a small
        avatar and a position tag beside each OPPONENT action, while the HERO's own actions
        appear as bare bubbles with no avatar and no name. Those unlabelled bubbles are the
        hero's — never attach them to whichever name happens to sit nearest.
      · Actions in a betting round alternate between players. If you find yourself giving one
        player two aggressive actions in a row with nobody in between, you have merged two
        people into one — re-read and split them.
      · Say who won using the badge or the chips-awarded line, not by assuming it was the
        player you happened to name most often.
      · State the hero's POSITION only if the layout actually labels their seat. These
        layouts usually tag every opponent and leave the hero's own seat untagged — that is
        not an invitation to work it out. Naming a seat another player already holds puts two
        people in one chair; just say "הירו" and let the app ask.

    ALWAYS say how many players were at the table ("8 players", "9 בשולחן"). Count the
    seats, including the hero and anyone who folded. This is the single most useful fact
    for placing everyone correctly, because these clients do not use this app's seat names
    and the seats are worked out from the table size plus the order people acted.

    Report positions using whatever labels the client itself shows, and list the preflop
    actions in the exact order they appear — that order is what the seats are derived from,
    so it matters more than the labels do.

    BOARD: at most five community cards, always in this shape — flop exactly 3, turn exactly
    1, river exactly 1. If you think you see six, you have misread one; look again rather
    than listing them all. Name each street's cards separately.

Rules for both:
- Write in Hebrew unless the image is clearly all-English, in which case keep English.
- Transcribe, do not analyse. No advice, no evaluation of how the hand was played.
- If a detail is unreadable or absent, simply leave it out. Never invent a card, a size or a
  position to fill a gap — a shorter description is fine, and separate code asks the player
  about anything essential that is missing.
- If the image contains no poker hand at all, reply with exactly: NO_HAND

Return only the description itself — no preamble and no internal or system XML tags.`;

/**
 * @param {Buffer} buffer - raw image bytes
 * @param {string} mimeType - image/jpeg | image/png | image/webp | image/gif
 * @returns {Promise<{text: string} | {error: string} | null>}
 */
async function readHandImage(buffer, mimeType) {
  const client = getClient();
  if (!client) return null;

  try {
    const r = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 4000,
      // Transcription needs no deliberation, and Sonnet's adaptive thinking is
      // on by default — left alone it spends the whole budget thinking and
      // returns an empty response. Note `temperature` is rejected outright on
      // this model, so it is deliberately absent.
      thinking: { type: 'disabled' },
      system: IMAGE_READ_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') } },
          { type: 'text', text: 'תאר את היד שבתמונה.' },
        ],
      }],
    });
    const text = (r.content.find(b => b.type === 'text')?.text || '').trim();
    if (!text || text === 'NO_HAND') return { error: 'no_hand' };
    return { text };
  } catch (e) {
    console.error('[HandNarration] image read error:', e?.message);
    return null;
  }
}

module.exports = {
  parseHandNarration, readHandImage, getClient, buildUserContent,
  HAND_SCHEMA_SYSTEM, IMAGE_READ_SYSTEM, DEFAULT_MODEL, VISION_MODEL,
};
