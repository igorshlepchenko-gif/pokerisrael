const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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

router.get('/me', authenticate, getMe);

module.exports = router;
