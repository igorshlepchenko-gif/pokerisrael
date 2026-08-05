const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateToken, setAuthCookie } = require('../controllers/authController');

const authenticate = async (req, res, next) => {
  try {
    // קודם cookie (httpOnly, מאובטח), אחרי כן Authorization header (backwards compat)
    const token = req.cookies?.pli_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'נדרשת הזדהות' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, name, email, phone, role, is_active, hand_logger_access, token_version FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'משתמש לא קיים או מושבת' });
    }

    // טוקן שהונפק לפני logout נחשב מבוטל — גם אם עדיין "תקף" מבחינת jwt.verify
    if (decoded.tokenVersion !== user.token_version) {
      return res.status(401).json({ message: 'ההתחברות פגה — יש להתחבר מחדש' });
    }

    // רענון גולש (sliding session): כל בקשה מאומתת מאריכה את החלון ל-30 דקות נוספות,
    // כך שרק חוסר-פעילות אמיתי (לא שימוש רציף) מנתק את המשתמש.
    // לקוחות עוגייה (אתר) מקבלים עוגייה מחודשת; לקוחות Authorization header בלבד
    // (אפליקציית המובייל, שאין לה עוגייה cross-site) מקבלים טוקן מחודש בהדר תגובה —
    // בלעדיו הם היו מתנתקים בכפייה כל 30 דקות ללא קשר לפעילות בפועל
    if (req.cookies?.pli_token) {
      setAuthCookie(res, generateToken(user));
    } else {
      res.set('X-Refreshed-Token', generateToken(user));
    }

    const { token_version, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    console.error('[AUTH] שגיאה ב-middleware:', err.message);
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
