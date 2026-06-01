const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, logout, verifyEmail, resendVerification } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

// ── Google OAuth ───────────────────────────────────────────────────
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

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
    passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google` })(req, res, next);
  },
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.cookie('pli_token', token, COOKIE_OPTS);
    res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  }
);

router.post('/register', [
  body('name').trim().notEmpty().withMessage('שם הוא שדה חובה'),
  body('email').isEmail().withMessage('כתובת מייל לא תקינה'),
  body('password')
    .isLength({ min: 8 }).withMessage('סיסמה חייבת להיות לפחות 8 תווים')
    .matches(/[A-Z]/).withMessage('סיסמה חייבת להכיל לפחות אות גדולה')
    .matches(/[0-9]/).withMessage('סיסמה חייבת להכיל לפחות ספרה')
    .matches(/[!@#$%^&*]/).withMessage('סיסמה חייבת להכיל לפחות תו מיוחד'),
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
router.post('/logout', logout);

module.exports = router;
