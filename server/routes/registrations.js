const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/registrationController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Rate limit רק על ה-POST הציבורי — מונע spam של הרשמות
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // דקה אחת
  max: 10,
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
