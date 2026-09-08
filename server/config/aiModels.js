/**
 * Central Groq model registry.
 *
 * Every Groq model id in the server lives here — do not hard-code model strings
 * at call sites. Groq retires models without warning and the previous five
 * scattered literals meant a retirement silently broke features one at a time
 * (llama-3.3-70b-versatile and meta-llama/llama-4-scout-17b-16e-instruct both
 * started returning 404 model_not_found; the admin "ייבוא מתמונה עם AI" screen
 * was failing in production until 2026-09-03).
 *
 * Verified against GET https://api.groq.com/openai/v1/models on 2026-09-03.
 * Account has 14 models; the general-purpose ones are:
 *   openai/gpt-oss-120b, openai/gpt-oss-20b  — text, support response_format json_object
 *   qwen/qwen3.8-27b, qwen/qwen3.6-27b       — text AND vision (verified with a real image)
 *   groq/compound, groq/compound-mini        — text only, reject array/image content (400)
 *
 * When a model 404s: change it HERE (or set the env var) — nowhere else.
 */

// ── Text ──────────────────────────────────────────────────────────────────────
// gpt-oss-120b is the fixture-tested choice (scripts/testHandNarration.js, 2026-09-02).
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b';

// gpt-oss are REASONING models — unlike the llama-3.3 they replaced, they spend
// completion tokens thinking before the first character of JSON appears. At default
// effort a short tournament announcement burned 808 completion tokens, which blew
// straight through the old max_tokens:800 and came back as a 400
// json_validate_failed "max completion tokens reached". Low effort does the same
// extraction in ~286 tokens and about half the latency, which also matters against
// the free tier's 8000 TPM ceiling. Any new json_object call on TEXT_MODEL should
// pass this and leave itself at least ~2000 max_tokens of headroom.
const TEXT_REASONING_EFFORT = process.env.GROQ_TEXT_REASONING_EFFORT || 'low';

// ── Vision ────────────────────────────────────────────────────────────────────
// Tried in order; a 404/model-unavailable or unparseable reply falls through to
// the next. qwen3.8 is primary: on a real schedule image it answered with clean
// JSON and no reasoning preamble, while qwen3.6 wraps its answer in <think>.
// NOTE: gpt-oss-* and groq/compound* are NOT vision models — they reject
// array-shaped message content with 400 "content must be a string". Do not add
// them here as fallbacks.
const VISION_MODELS = (process.env.GROQ_VISION_MODELS || 'qwen/qwen3.8-27b,qwen/qwen3.6-27b')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── Hand Logger narration ─────────────────────────────────────────────────────
const HAND_NARRATION_MODEL = process.env.HAND_NARRATION_MODEL || TEXT_MODEL;

/**
 * Strip a model's non-JSON wrapper so JSON.parse can take the result.
 *
 * Handles two things the current models actually do:
 *  1. Thinking models (qwen3.x) prefix the real answer with a <think>...</think>
 *     block that can itself contain draft ```json fences — so the whole block
 *     must go before any fence handling, not just the outer fences.
 *  2. Markdown fences around the answer. The fence regex intentionally does NOT
 *     also consume adjacent newlines in the same pattern: matching "```json\n?"
 *     as one alternative let a separate "\n?```" alternative win at an earlier
 *     position when the model left blank lines before the fence, stranding the
 *     literal word "json" in front of the JSON (hit for real testing qwen3.6).
 */
function stripToJson(raw) {
  return String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
}

module.exports = {
  TEXT_MODEL, TEXT_REASONING_EFFORT, VISION_MODELS, HAND_NARRATION_MODEL, stripToJson,
};
