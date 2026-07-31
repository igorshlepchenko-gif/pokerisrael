const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/inquiryController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Rate limit רק על ה-POST הציבורי — מונע spam של פניות. max גבוה יחסית בכוונה
// (ראה registrations.js) — מפתח לפי IP, וכמה פניות מאותו WiFi יכולות לחצות סף נמוך בקלות.
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // דקה אחת
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי פניות — נסה שוב בעוד דקה' },
});

// רישום פנייה — ציבורי (גם לא מחוברים)
router.post('/', postLimiter, ctrl.logInquiry);

// צפייה + ייצוא — אדמין בלבד
router.get('/', authenticate, requireRole('admin'), ctrl.getInquiries);
router.get('/export', authenticate, requireRole('admin'), ctrl.exportInquiries);

module.exports = router;
