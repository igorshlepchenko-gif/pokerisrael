const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, logout, verifyEmail, resendVerification, generateToken, setAuthCookie } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const passport = require('../config/passport');

const router = express.Router();

// ── Google OAuth ───────────────────────────────────────────────────
const googleEnabled = () =>
  process.env.GOOGLE_CLIENT_ID &&
  !process.env.GOOGLE_CLIENT_ID.includes('your-google');

router.get('/google', (req, res, next) => {
  if (!googleEnabled()) {
    return res.status(503).json({ message: 'כניסה עם Google אינה מוגדרת עדיין' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback',
  (req, res, next) => {
    if (!googleEnabled()) {
      return res.status(503).json({ message: 'כניסה עם Google אינה מוגדרת עדיין' });
    }
    // callback ידני במקום failureRedirect — כך ש-info.message (הסיבה האמיתית שpassport.js
    // מעביר ל-done(), למשל "החשבון מושבת") מגיע בפועל למשתמש, ולא נבלע בהפניה גנרית
    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err || !user) {
        const reason = info?.message || 'ההתחברות עם Google נכשלה';
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=${encodeURIComponent(reason)}`);
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  (req, res) => {
    // generateToken/setAuthCookie משותפים עם authController.js כדי שכל טוקן —
    // כולל התחברות דרך Google — יכלול tokenVersion ויקבל אותו חלון 30 דקות גולש
    const token = generateToken(req.user);
    setAuthCookie(res, token);
    res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  }
);

router.post('/register', [
  body('name').trim().notEmpty().withMessage('שם הוא שדה חובה'),
  body('email').isEmail().withMessage('כתובת מייל לא תקינה'),
  body('password')
    .isLength({ min: 6 }).withMessage('סיסמה חייבת להיות לפחות 6 תווים'),
  body('phone').trim().notEmpty().withMessage('מספר טלפון הוא שדה חובה'),
  body('role').isIn(['player', 'venue_owner']).withMessage('סוג משתמש לא תקין'),
], register);

router.post('/login', [
  body('email').isEmail().withMessage('כתובת מייל לא תקינה'),
  body('password').notEmpty().withMessage('סיסמה היא שדה חובה'),
], login);

router.get('/verify/:token', verifyEmail);
router.post('/resend-verification', [
  body('email').isEmail().withMessage('כתובת מייל לא תקינה'),
], resendVerification);

router.get('/me', authenticate, getMe);
// authenticate כאן כדי ש-logout ידע איזה משתמש לבטל (מעלה token_version) —
// אם הטוקן כבר לא תקף, ה-middleware עצמו יחזיר 401 והלקוח פשוט ינקה את המצב מקומית
router.post('/logout', authenticate, logout);

module.exports = router;
