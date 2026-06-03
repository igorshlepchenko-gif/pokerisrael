const express = require('express');
const multer = require('multer');
const { MulterError } = multer;
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID(); // במקום חבילת uuid (ESM-only)
const fileType = require('file-type');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── ודא שתיקיות ההעלאה קיימות (חשוב בפרודקשן — הן ב-gitignore) ────
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const LOGOS_DIR  = path.join(UPLOADS_DIR, 'logos');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
for (const dir of [UPLOADS_DIR, LOGOS_DIR, VIDEOS_DIR]) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
}

// ── Magic bytes maps ──────────────────────────────────────────────
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

// ── לוגו: memory → validate → כתיבה לדיסק ────────────────────────
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB לתמונה
  fileFilter: (req, file, cb) => {
    // בדיקה ראשונה לפי MIME header (מהיר)
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('פורמט לא נתמך — השתמש ב-JPG, PNG, GIF או WEBP'));
  },
});

// ── סרטון: disk → validate magic bytes → מחיקה אם שגוי ───────────
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/videos')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_VIDEO_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('פורמט לא נתמך — השתמש ב-MP4, WEBM או MOV'));
  },
});

// ── middleware: בדיקת magic bytes לאחר שמירה לדיסק ───────────────
const validateVideoMagicBytes = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const type = await fileType.fromFile(req.file.path);
    if (!type || !ALLOWED_VIDEO_MIMES.has(type.mime)) {
      fs.unlinkSync(req.file.path); // מחיקת הקובץ המזויף
      return res.status(400).json({ message: 'קובץ לא תקין — תוכן הקובץ אינו תואם לסיומת' });
    }
    next();
  } catch {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'שגיאה באימות הקובץ' });
  }
};

// ── העלאת לוגו ────────────────────────────────────────────────────
router.post('/logo', authenticate, requireRole('venue_owner', 'admin'),
  logoUpload.single('logo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'קובץ לוגו לא תקין' });

    // בדיקת magic bytes מה-buffer שבזיכרון
    const type = await fileType.fromBuffer(req.file.buffer);
    if (!type || !ALLOWED_IMAGE_MIMES.has(type.mime)) {
      return res.status(400).json({ message: 'קובץ לא תקין — תוכן הקובץ אינו תואם לסיומת' });
    }

    // כתיבה לדיסק רק אחרי ולידציה
    const ext = type.ext === 'jpg' ? 'jpg' : type.ext;
    const filename = `${uuidv4()}.${ext}`;
    const destPath = path.join(__dirname, '../uploads/logos', filename);
    fs.writeFileSync(destPath, req.file.buffer);

    res.json({ url: `/uploads/logos/${filename}` });
  }
);

// ── middleware: תפיסת שגיאות Multer ─────────────────────────────
const handleVideoUpload = (req, res, next) => {
  videoUpload.single('video')(req, res, (err) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'הקובץ גדול מדי — מקסימום 200MB' });
      }
      return res.status(400).json({ message: `שגיאת העלאה: ${err.message}` });
    }
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
};

// ── העלאת סרטון ───────────────────────────────────────────────────
router.post('/venue/:venueId/video',
  authenticate, requireRole('venue_owner', 'admin'),
  handleVideoUpload,
  validateVideoMagicBytes,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'קובץ וידאו לא תקין' });

    const { venueId } = req.params;
    const { title } = req.body;

    try {
      const check = await pool.query('SELECT id FROM venues WHERE id=$1 AND owner_id=$2', [venueId, req.user.id]);
      if (!check.rows[0] && req.user.role !== 'admin') {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'אין הרשאה' });
      }

      const result = await pool.query(
        'INSERT INTO venue_videos (venue_id, video_url, title) VALUES ($1,$2,$3) RETURNING *',
        [venueId, `/uploads/videos/${req.file.filename}`, title || '']
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      if (req.file?.path) fs.unlinkSync(req.file.path);
      res.status(500).json({ message: 'שגיאת שרת' });
    }
  }
);

// ── קבלת סרטוני מקום ──────────────────────────────────────────────
router.get('/venue/:venueId/videos', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM venue_videos WHERE venue_id=$1 ORDER BY created_at DESC',
      [req.params.venueId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// ── מחיקת סרטון ───────────────────────────────────────────────────
router.delete('/video/:id', authenticate, requireRole('venue_owner', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM venue_videos vv
       USING venues v
       WHERE vv.id=$1 AND vv.venue_id=v.id AND (v.owner_id=$2 OR $3='admin')
       RETURNING vv.video_url`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'סרטון לא נמצא' });

    const filePath = path.join(__dirname, '..', result.rows[0].video_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: 'הסרטון נמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
