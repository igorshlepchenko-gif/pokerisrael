/**
 * Hand Logger — voice narration: audio in, text out.
 *
 * The recording never becomes a hand directly. It becomes TEXT the player sees
 * and can correct, and only then goes through the same parser as anything they
 * typed. Speech is the least reliable input of the three (typing, image, voice)
 * and the one most likely to be recorded in a noisy room, so showing the
 * transcript before parsing matters more here than anywhere else.
 *
 * Runs on Groq Whisper rather than Claude: Claude has no audio transcription,
 * the Groq key is already configured, whisper-large-v3 handles Hebrew, and it
 * came back in ~300ms on a probe.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const Groq = require('groq-sdk');

const MODEL = process.env.HAND_AUDIO_MODEL || 'whisper-large-v3';

let _groq = null;
function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

/**
 * Whisper invents speech when given silence or noise — a one-second pure tone
 * came back as "תודה". Left alone that becomes a phantom hand narration the
 * player never spoke, so the best-known filler phrases are treated as nothing
 * heard. Deliberately a short, conservative list: over-filtering would eat a
 * genuine short answer like "כן" to a follow-up question.
 */
const HALLUCINATIONS = [
  'תודה', 'תודה רבה', 'תודה שצפיתם', 'כתוביות', 'הכתוביות',
  'thank you', 'thanks for watching', 'you', 'bye',
];

function looksEmpty(text) {
  const t = (text || '').trim().replace(/[.!?,\s]+$/g, '').toLowerCase();
  if (t.length < 2) return true;
  return HALLUCINATIONS.includes(t);
}

/**
 * Steering text. Whisper accepts a prompt that biases its vocabulary, which is
 * what keeps poker terms from being transcribed as ordinary Hebrew words —
 * "פלופ" rather than "פלוף", "פיק" rather than "פיקה".
 */
const VOCAB_PROMPT =
  'רישום יד פוקר. מונחים: פלופ, טרן, ריבר, בליינדים, אנטה, פרה-פלופ, ' +
  'צ׳ק, קול, רייז, פולד, לימפ, אול אין, 3בט, באטן, קאט אוף, הייג׳ק, לוג׳ק, ' +
  'סמול בליינד, ביג בליינד, אס, מלך, מלכה, ג׳ק, עלה, לב, יהלום, תלתן, פיק.';

/**
 * @param {Buffer} buffer - raw audio bytes
 * @param {string} filename - original name; the extension tells Whisper the container
 * @returns {Promise<{text:string} | {error:string} | null>}
 */
async function transcribeHandAudio(buffer, filename) {
  const groq = getGroq();
  if (!groq) return null;

  // The SDK uploads a stream, so the bytes need a real file for the moment of
  // the call. Written to the OS temp dir and removed straight afterwards —
  // voice recordings are not something to leave lying around on disk.
  const ext = (path.extname(filename || '') || '.webm').slice(0, 6);
  const tmp = path.join(os.tmpdir(), `handaudio_${Date.now()}_${process.pid}${ext}`);

  try {
    fs.writeFileSync(tmp, buffer);
    const r = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmp),
      model: MODEL,
      language: 'he',
      prompt: VOCAB_PROMPT,
      response_format: 'json',
      temperature: 0,
    });
    const text = (r.text || '').trim();
    if (looksEmpty(text)) return { error: 'no_speech' };
    return { text };
  } catch (e) {
    console.error('[HandAudio] transcription error:', e?.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* already gone */ }
  }
}

module.exports = { transcribeHandAudio, looksEmpty, MODEL, VOCAB_PROMPT };
