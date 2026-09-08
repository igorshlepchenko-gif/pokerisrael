const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/handNarrationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Same shape as the tournaments image import: memory only, nothing hits disk.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Matches what the vision model accepts; anything else is rejected here
    // rather than failing later with an opaque API error.
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('פורמט תמונה לא נתמך'));
  },
});

// Voice recordings are short; opus in a webm/mp4 container runs well under this.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Two ways in, because neither is reliable alone. Browsers differ on the
    // container they record (Chrome webm/opus, Safari mp4), and a file picked
    // off disk often arrives with an empty or wrong MIME type — Windows hands
    // over voice memos as application/octet-stream. So trust the extension too,
    // and let Whisper be the one to say it cannot read something.
    const byMime = /^audio\//.test(file.mimetype)
      || ['video/webm', 'video/mp4', 'application/octet-stream'].includes(file.mimetype);
    const byExt = /\.(mp3|m4a|mp4|wav|ogg|oga|opus|webm|aac|amr|flac|mpga|mpeg)$/i
      .test(file.originalname || '');
    if (byMime || byExt) cb(null, true);
    else cb(new Error('פורמט אודיו לא נתמך'));
  },
});

router.post('/parse', authenticate, ctrl.parse);
router.post('/transcribe', authenticate, audioUpload.single('audio'), ctrl.transcribe);
router.post('/read-image', authenticate, imageUpload.single('image'), ctrl.readImage);
// Deterministic re-validation after an edit — no model, so it stays instant.
router.post('/recheck', authenticate, ctrl.recheck);

module.exports = router;
