const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// רשימה סגורה — כל ערב אחר נדחה, כדי שהטבלה לא תתמלא בזבל
const ACTIONS = new Set([
  'copy_club', 'copy_agent', 'whatsapp', 'store_ios', 'store_android', 'store_7xl',
  'promo', 'video_play', 'report',
]);

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי בקשות — נסה שוב בעוד דקה' },
});

// ציבורי — יורה-ושכח מהלקוח (sendBeacon)
router.post('/', postLimiter, async (req, res) => {
  const { action, club_id, source } = req.body || {};
  if (!ACTIONS.has(action)) return res.status(400).json({ message: 'פעולה לא מוכרת' });
  if ((club_id && String(club_id).length > 100) || (source && String(source).length > 50)) {
    return res.status(400).json({ message: 'ערכים ארוכים מדי' });
  }
  try {
    await pool.query(
      'INSERT INTO online_click_logs (action, club_id, source) VALUES ($1,$2,$3)',
      [action, club_id || null, source || null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('online click log error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// סיכום לאדמין — ספירה לפי קלאב/פעולה/מקור בטווח ימים (ברירת מחדל 30)
router.get('/summary', authenticate, requireRole('admin'), async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
  try {
    const { rows } = await pool.query(
      `SELECT club_id, action, source, COUNT(*)::int AS count
         FROM online_click_logs
        WHERE created_at > NOW() - make_interval(days => $1)
        GROUP BY club_id, action, source
        ORDER BY count DESC`,
      [days]
    );
    res.json({ days, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
