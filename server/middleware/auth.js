const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'נדרשת הזדהות' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, phone, role, is_active FROM users WHERE id = $1', [decoded.id]);

    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ message: 'משתמש לא קיים או מושבת' });
    }

    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ message: 'טוקן לא תקין' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'אין הרשאה לפעולה זו' });
  }
  next();
};

module.exports = { authenticate, requireRole };
