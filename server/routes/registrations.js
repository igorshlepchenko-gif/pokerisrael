const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/registrationController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Rate limit רק על ה-POST הציבורי — מונע spam של הרשמות.
// max גבוה יחסית בכוונה: המפתח הוא כתובת IP, וכמה נרשמים על אותו WiFi
// של מועדון יכולים בקלות לחצות סף נמוך תוך דקה אחת — כפי שקרה בפועל (הרשמה
// אמיתית של חן דאהן נדחתה בשקט ב-10/min; sendBeacon לא מדווח כשל ללקוח).
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // דקה אחת
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי הרשמות — נסה שוב בעוד דקה' },
});

// רישום הרשמה — ציבורי (גם לא מחוברים)
router.post('/', postLimiter, ctrl.logRegistration);

// צפייה + ייצוא — אדמין בלבד
router.get('/', authenticate, requireRole('admin'), ctrl.getRegistrations);
router.get('/export', authenticate, requireRole('admin'), ctrl.exportRegistrations);

module.exports = router;
