const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/db');

const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, phone, role } = req.body;

  const allowedRoles = ['player', 'venue_owner'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'סוג משתמש לא חוקי' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'כתובת המייל כבר רשומה במערכת' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, role',
      [name, email, hash, phone, role]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT id, name, email, password, phone, role, is_active,
              is_locked, failed_login_attempts, locked_at
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    // מייל לא קיים — אותה הודעה גנרית (לא לחשוף אם המייל קיים)
    if (!user) return res.status(401).json({ message: 'מייל או סיסמה שגויים' });
    if (!user.is_active) return res.status(401).json({ message: 'החשבון מושבת' });

    // חשבון ננעל
    if (user.is_locked) {
      return res.status(403).json({
        message: 'החשבון ננעל עקב ניסיונות התחברות כושלים מרובים. אנא פנה למנהל המערכת.',
        locked: true,
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const shouldLock = attempts >= 10;

      await pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             is_locked  = $2,
             locked_at  = $3
         WHERE id = $4`,
        [attempts, shouldLock, shouldLock ? new Date() : user.locked_at, user.id]
      );

      if (shouldLock) {
        console.warn(`[AUTH] חשבון ננעל: ${email} — ${attempts} ניסיונות כושלים`);
        return res.status(403).json({
          message: 'החשבון ננעל עקב ניסיונות התחברות כושלים מרובים. אנא פנה למנהל המערכת.',
          locked: true,
        });
      }

      // אזהרה לפני נעילה — מוצגת ב-3 הניסיונות האחרונים
      const remaining = 10 - attempts;
      const msg = remaining <= 3
        ? `מייל או סיסמה שגויים — נותרו ${remaining} ניסיונות לפני נעילת החשבון`
        : 'מייל או סיסמה שגויים';

      return res.status(401).json({ message: msg });
    }

    // הצלחה — איפוס מונה
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, is_locked = false, locked_at = NULL WHERE id = $1',
      [user.id]
    );

    const { password: _, failed_login_attempts: __, locked_at: ___, ...userData } = user;
    const token = generateToken(userData);
    res.json({ token, user: userData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};
