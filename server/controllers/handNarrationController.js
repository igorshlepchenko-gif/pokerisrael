const { parseHandNarration, readHandImage } = require('../services/handNarrationAgent');
const { analyze, toWizardState, applyContradictionFix } = require('../services/narrationGaps');
const { transcribeHandAudio } = require('../services/handAudioTranscriber');
const { logNarration } = require('../services/narrationLog');

/**
 * Turns a service failure into a message that says what to go and fix. These
 * endpoints are admin-only, so the real reason can be shown — a generic
 * "unavailable" reads the same whether a key is missing, a key is wrong, or the
 * provider is down, and those need three different responses.
 */
function sendFailure(res, result, what) {
  if (result?.error === 'not_configured') {
    return res.status(503).json({
      message: `${what} לא מוגדר בשרת — חסר משתנה הסביבה ${result.detail}`,
    });
  }
  return res.status(502).json({
    message: `${what} נכשל: ${result?.detail || 'סיבה לא ידועה'}`,
  });
}

const failureText = (result) => (result?.error ? `${result.error}${result.detail ? `: ${result.detail}` : ''}` : 'no result');
const fileInfo = (file) => (file ? `${file.originalname || '(no name)'} · ${file.mimetype} · ${file.size} bytes` : null);

// ADMIN ONLY for now, by the owner's decision on first production deploy
// (2026-09-08). The `hand_narration_pilot_access` column and its admin-panel
// toggle stay in place unused — widening this to pilot users later is a matter
// of restoring `hand_narration_pilot_access ||` to these checks and the one in
// HandLoggerSection.jsx, with no migration.
exports.parse = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'אין לך גישה לפיילוט הזה' });
  }

  const { message, priorState, history, answers } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'חסר טקסט לפירוש' });
  }
  if (priorState !== undefined && priorState !== null && typeof priorState !== 'object') {
    return res.status(400).json({ message: 'priorState לא תקין' });
  }
  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ message: 'history לא תקין' });
  }
  if (answers !== undefined && answers !== null && typeof answers !== 'object') {
    return res.status(400).json({ message: 'answers לא תקין' });
  }

  const startedAt = Date.now();
  try {
    const parsed = await parseHandNarration(message.trim(), priorState || null, history || []);
    if (!parsed || parsed.error) {
      logNarration(req, { kind: 'parse', input: message.trim(), error: failureText(parsed),
        details: { answers: answers || null, had_prior_state: !!priorState }, startedAt });
      return sendFailure(res, parsed, 'שירות הפירוש');
    }

    // The model only extracts. What is missing, what gets a default, and
    // whether the hand can be saved are all decided here, deterministically —
    // see the rationale at the top of services/narrationGaps.js.
    // `answers` carries gap choices that are arithmetic rather than language —
    // the chip-size scale, for one — and are applied without re-asking the model.
    const { state, gaps, contradictions, dropped, ready } = analyze(parsed.extracted || {}, answers || {});

    // Two sources, deliberately: the model catches semantic problems (a seat
    // that can't exist at that table size, a mis-heard card), the rule checks
    // catch structural ones it misses even when its extraction is perfect.
    const allContradictions = [
      ...(parsed.contradiction ? [parsed.contradiction] : []),
      ...contradictions,
    ];

    logNarration(req, {
      kind: 'parse', input: message.trim(), startedAt,
      details: {
        answers: answers || null, had_prior_state: !!priorState,
        extracted: parsed.extracted || null, state, gaps,
        contradictions: allContradictions, dropped, ready,
      },
    });

    res.json({
      // Feed straight back as `priorState` on the next turn.
      state,
      gaps,
      ready,
      // Shown for confirmation on the review card; never blocks saving.
      contradictions: allContradictions,
      // Anything the model produced that the app cannot represent. Surfaced
      // rather than swallowed, since createHand would not catch it either.
      dropped,
      // Only meaningful once ready — the exact shape buildState() produces.
      wizardState: ready ? toWizardState(state) : null,
    });
  } catch (err) {
    console.error('[HandNarration] parse endpoint error:', err);
    logNarration(req, { kind: 'parse', input: message.trim(), error: err.message, startedAt });
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// Reads a hand out of an uploaded image and hands back TEXT, not a parsed hand.
// The player sees what was read, fixes anything the image got wrong, and only
// then runs it through /parse — same pipeline as anything they typed.
exports.readImage = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'אין לך גישה לפיילוט הזה' });
  }
  if (!req.file) return res.status(400).json({ message: 'לא נשלחה תמונה' });

  const startedAt = Date.now();
  try {
    const result = await readHandImage(req.file.buffer, req.file.mimetype);
    if (!result || (result.error && result.error !== 'no_hand')) {
      logNarration(req, { kind: 'read_image', input: fileInfo(req.file), error: failureText(result), startedAt });
      return sendFailure(res, result, 'שירות קריאת התמונות');
    }
    if (result.error === 'no_hand') {
      logNarration(req, { kind: 'read_image', input: fileInfo(req.file), error: 'no_hand', startedAt });
      return res.status(422).json({ message: 'לא זיהינו יד פוקר בתמונה. אפשר לכתוב אותה ידנית.' });
    }
    logNarration(req, { kind: 'read_image', input: fileInfo(req.file), output: result.text, startedAt });
    res.json({ text: result.text });
  } catch (err) {
    console.error('[HandNarration] readImage error:', err);
    logNarration(req, { kind: 'read_image', input: fileInfo(req.file), error: err.message, startedAt });
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

/**
 * Re-validates a hand the player has edited on the review card. No model call —
 * this is the same deterministic analysis the parse endpoint runs, so an edit
 * gets its warnings back instantly instead of after a round trip. Optionally
 * applies one suggested repair first.
 */
exports.recheck = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'אין לך גישה לפיילוט הזה' });
  }

  const { state, fix } = req.body;
  if (!state || typeof state !== 'object') {
    return res.status(400).json({ message: 'חסר מצב יד לבדיקה' });
  }

  const startedAt = Date.now();
  try {
    const source = fix ? applyContradictionFix(state, fix) : state;
    const { state: next, gaps, contradictions, dropped, ready } = analyze(source);
    logNarration(req, { kind: 'recheck', startedAt,
      details: { fix: fix || null, submitted: state, state: next, gaps, contradictions, dropped, ready } });
    res.json({
      state: next,
      gaps,
      ready,
      contradictions,
      dropped,
      wizardState: ready ? toWizardState(next) : null,
    });
  } catch (err) {
    console.error('[HandNarration] recheck error:', err);
    logNarration(req, { kind: 'recheck', error: err.message, details: { fix: fix || null }, startedAt });
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

/**
 * Voice narration: audio in, TEXT out — never a parsed hand. Same contract as
 * the image reader, for the same reason: the player has to see what was heard
 * before it becomes their saved hand.
 */
exports.transcribe = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'אין לך גישה לפיילוט הזה' });
  }
  if (!req.file) return res.status(400).json({ message: 'לא נשלחה הקלטה' });

  const startedAt = Date.now();
  try {
    const result = await transcribeHandAudio(req.file.buffer, req.file.originalname);
    if (!result || (result.error && result.error !== 'no_speech')) {
      logNarration(req, { kind: 'transcribe', input: fileInfo(req.file), error: failureText(result), startedAt });
      return sendFailure(res, result, 'שירות התמלול');
    }
    if (result.error === 'no_speech') {
      logNarration(req, { kind: 'transcribe', input: fileInfo(req.file), error: 'no_speech', startedAt });
      return res.status(422).json({ message: 'לא שמענו כלום בהקלטה. נסה שוב, קרוב יותר למיקרופון.' });
    }
    logNarration(req, { kind: 'transcribe', input: fileInfo(req.file), output: result.text, startedAt });
    res.json({ text: result.text });
  } catch (err) {
    console.error('[HandNarration] transcribe error:', err);
    logNarration(req, { kind: 'transcribe', input: fileInfo(req.file), error: err.message, startedAt });
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

/**
 * Client-side moments the server never sees on its own — currently the handoff
 * to the wizard, with the corrections the player made on the review card.
 * Answers immediately; the log write happens in the background.
 */
const CLIENT_EVENTS = ['handoff'];
exports.logEvent = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'אין לך גישה לפיילוט הזה' });
  }
  const { kind, details } = req.body || {};
  if (!CLIENT_EVENTS.includes(kind)) return res.status(400).json({ message: 'סוג אירוע לא תקין' });
  logNarration(req, { kind, details: details && typeof details === 'object' ? details : {} });
  res.status(204).end();
};
