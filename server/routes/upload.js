const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = file.fieldname === 'logo'
      ? path.join(__dirname, '../uploads/logos')
      : path.join(__dirname, '../uploads/videos');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'logo') {
    cb(null, /^image\/(jpeg|jpg|png|gif|webp|svg)/.test(file.mimetype));
  } else {
    cb(null, /^video\/(mp4|mpeg|mov|avi|webm)/.test(file.mimetype));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
});

// העלאת לוגו
router.post('/logo', authenticate, requireRole('venue_owner', 'admin'), upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'קובץ לוגו לא תקין' });
  res.json({ url: `/uploads/logos/${req.file.filename}` });
});

// העלאת סרטון לוואנו
router.post('/venue/:venueId/video', authenticate, requireRole('venue_owner', 'admin'), upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'קובץ וידאו לא תקין' });

  const { venueId } = req.params;
  const { title } = req.body;

  try {
    const check = await pool.query('SELECT id FROM venues WHERE id=$1 AND owner_id=$2', [venueId, req.user.id]);
    if (!check.rows[0] && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'אין הרשאה' });
    }

    const result = await pool.query(
      'INSERT INTO venue_videos (venue_id, video_url, title) VALUES ($1,$2,$3) RETURNING *',
      [venueId, `/uploads/videos/${req.file.filename}`, title || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// קבלת סרטוני מקום
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

// מחיקת סרטון
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
    const fs = require('fs');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: 'הסרטון נמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
