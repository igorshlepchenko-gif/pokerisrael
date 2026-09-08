/**
 * Microphone capture for the Hand Logger's voice narration.
 *
 * Kept out of the component because the fiddly part is not the UI, it is that
 * browsers disagree about what they will record into: Chrome and Android give
 * webm/opus, iOS Safari gives mp4/aac and rejects a webm mimeType outright.
 * This app is used mostly on a phone at the table, so the Safari path is not an
 * edge case here — it is half the users.
 */

// Ordered by preference. Opus is far smaller for speech; mp4 is what Safari
// will actually produce. Whisper accepts every one of these containers.
const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg;codecs=opus',
];

/** The first container this browser admits to supporting, or '' to let it choose. */
export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of CANDIDATE_TYPES) {
    // Older Safari lacks isTypeSupported entirely.
    if (typeof MediaRecorder.isTypeSupported !== 'function') break;
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export function isRecordingSupported() {
  return typeof MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
}

const extensionFor = (mimeType) =>
  /mp4/.test(mimeType) ? 'mp4'
  : /mpeg/.test(mimeType) ? 'mp3'
  : /ogg/.test(mimeType) ? 'ogg'
  : 'webm';

/**
 * Starts recording and resolves with a controller.
 *
 * `stop()` resolves with the finished File, or null if nothing was captured.
 * The microphone track is stopped in every exit path — leaving it live keeps
 * the browser's recording indicator on, which reads as the site spying.
 */
export async function startRecording() {
  if (!isRecordingSupported()) {
    throw new Error('unsupported');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // A poker room is loud and the phone sits on the table, not at the mouth.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

  const releaseMic = () => stream.getTracks().forEach(t => t.stop());
  recorder.start();

  return {
    mimeType: recorder.mimeType || mimeType || 'audio/webm',
    cancel() {
      try { if (recorder.state !== 'inactive') recorder.stop(); } finally { releaseMic(); }
    },
    stop() {
      return new Promise((resolve) => {
        if (recorder.state === 'inactive') { releaseMic(); return resolve(null); }
        recorder.onstop = () => {
          releaseMic();
          if (!chunks.length) return resolve(null);
          const type = recorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type });
          resolve(new File([blob], `hand.${extensionFor(type)}`, { type }));
        };
        recorder.stop();
      });
    },
  };
}
