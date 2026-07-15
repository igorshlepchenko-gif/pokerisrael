const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const pool = require('../config/db');
const { sendVerificationEmail } = require('../utils/emailService');

// חלון הפעלה גולש (idle timeout) — קבוע בקוד ולא ב-env בכוונה: זו החלטת אבטחה,
// לא הגדרת סביבה, וזה מבטיח שה-exp האמיתי בתוך ה-JWT תמיד יתאים בדיוק ל-Max-Age
// של העוגייה. (JWT_EXPIRES_IN הישן ב-.env נשאר על 7d ולא משפיע יותר על טוקן זה.)
const SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60; // 30 דקות

// tokenVersion נכלל בכל טוקן — logout מעלה את המונה ב-DB וכך מבטל מיידית טוקנים ישנים,
// גם אם הם עדיין "תקפים" מבחינת jwt.verify (ראה middleware/auth.js)
const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, tokenVersion: user.token_version ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: SESSION_IDLE_TIMEOUT_SECONDS,
  });

// לא זמן קבוע: middleware/auth.js מרענן את העוגייה (ואת ה-JWT) בכל בקשה מאומתת,
// כך שמשתמש פעיל לא ינותק, ורק חוסר-פעילות אמיתית של 30 דקות תגרום לניתוק
const COOKIE_OPTS = {
  httpOnly: true,                                          // אינו נגיש מ-JS
  secure: process.env.NODE_ENV === 'production',           // HTTPS בפרודקשן
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: SESSION_IDLE_TIMEOUT_SECONDS * 1000,             // אותו חלון בדיוק, במילישניות
};

const setAuthCookie = (res, token) => res.cookie('pli_token', token, COOKIE_OPTS);
const clearAuthCookie = (res) => res.clearCookie('pli_token', { ...COOKIE_OPTS, maxAge: 0 });

// משותפים עם routes/auth.js (Google OAuth callback) ו-middleware/auth.js (רענון עוגייה)
// כדי שכל נתיבי ההנפקה/רענון של הטוקן ישתמשו באותה לוגיקה בדיוק
exports.generateToken = generateToken;
exports.setAuthCookie = setAuthCookie;
exports.COOKIE_OPTS = COOKIE_OPTS;

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email: rawEmail, password, phone, role } = req.body;
  const email = rawEmail.toLowerCase();

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'כתובת המייל כבר רשומה במערכת' });
    }

    const hash = await bcrypt.hash(password, 12);

    // יצירת טוקן אימות — תקף 24 שעות
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const emailEnabled = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD &&
      !process.env.GMAIL_USER.includes('your-gmail'));

    if (emailEnabled) {
      // מצב מייל מופעל — משתמש ממתין לאימות
      await pool.query(
        `INSERT INTO users
           (name, email, password, phone, role, is_active, email_verified, verification_token, verification_expires)
         VALUES ($1,$2,$3,$4,$5, false, false, $6,$7)`,
        [name, email, hash, phone, role, verificationToken, verificationExpires]
      );

      try {
        await sendVerificationEmail({ to: email, name, token: verificationToken });
      } catch (mailErr) {
        console.error('[EMAIL] שגיאה בשליחת מייל אימות:', mailErr.message);
      }

      return res.status(201).json({ message: 'נשלח מייל אימות לכתובת שלך. לחץ על הקישור כדי להפעיל את החשבון.' });
    }

    // מצב ביפאס — Gmail לא מוגדר, כניסה מיידית
    const result = await pool.query(
      `INSERT INTO users
         (name, email, password, phone, role, is_active, email_verified)
       VALUES ($1,$2,$3,$4,$5, true, true)
       RETURNING id, name, email, phone, role, token_version`,
      [name, email, hash, phone, role]
    );

    const user = result.rows[0];

    // רישום ביומן שינויים
    pool.query(
      `INSERT INTO change_logs (entity_type, entity_id, entity_name, action, changed_by, changed_by_name, new_data)
       VALUES ('user',$1,$2,'create',$1,$2,$3)`,
      [user.id, user.name, JSON.stringify({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role })]
    ).catch(() => {});

    const token = generateToken(user);
    setAuthCookie(res, token);
    const { token_version: _tv, ...userData } = user;
    res.status(201).json({ token, user: userData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ message: 'טוקן חסר' });

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, verification_expires, token_version
       FROM users
       WHERE verification_token = $1 AND email_verified = false`,
      [token]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ message: 'הקישור אינו תקין או כבר שומש' });
    }

    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ message: 'הקישור פג תוקף — יש לבקש קישור חדש', expired: true });
    }

    await pool.query(
      `UPDATE users
       SET email_verified = true, is_active = true,
           verification_token = NULL, verification_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    // רישום ביומן שינויים
    pool.query(
      `INSERT INTO change_logs (entity_type, entity_id, entity_name, action, changed_by, changed_by_name, new_data)
       VALUES ('user',$1,$2,'create',$1,$2,$3)`,
      [user.id, user.name, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role })]
    ).catch(() => {});

    // מחזיר JWT כדי שהמשתמש יכנס מיד
    const jwt_token = generateToken({ id: user.id, role: user.role, token_version: user.token_version });
    setAuthCookie(res, jwt_token);
    res.json({
      message: 'המייל אומת בהצלחה! החשבון פעיל.',
      token: jwt_token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.resendVerification = async (req, res) => {
  const { email: rawEmail } = req.body;
  if (!rawEmail) return res.status(400).json({ message: 'כתובת מייל חסרה' });
  const email = rawEmail.toLowerCase();

  try {
    const result = await pool.query(
      'SELECT id, name, email_verified FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    // תגובה זהה גם אם המייל לא קיים — למנוע גילוי כתובות
    if (!user || user.email_verified) {
      return res.json({ message: 'אם הכתובת קיימת ולא מאומתת, נשלח מייל חדש.' });
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      await sendVerificationEmail({ to: email, name: user.name, token: newToken });
    } catch (mailErr) {
      // השליחה נכשלה — לא מעדכנים את הטוקן ב-DB, כדי לא לבטל טוקן קודם שעדיין תקף
      // ולהשאיר את המשתמש בלי שום קישור שמיש
      console.error('[EMAIL] שגיאה בשליחת מייל אימות מחדש:', mailErr.message);
      return res.json({ message: 'אם הכתובת קיימת ולא מאומתת, נשלח מייל חדש.' });
    }

    await pool.query(
      'UPDATE users SET verification_token=$1, verification_expires=$2 WHERE id=$3',
      [newToken, newExpires, user.id]
    );

    res.json({ message: 'אם הכתובת קיימת ולא מאומתת, נשלח מייל חדש.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email: rawEmail, password } = req.body;
  const email = rawEmail.toLowerCase();

  try {
    const result = await pool.query(
      `SELECT id, name, email, password, phone, role, is_active,
              email_verified, is_locked, failed_login_attempts, locked_at,
              hand_logger_access, token_version
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    // מייל לא קיים — אותה הודעה גנרית (לא לחשוף אם המייל קיים)
    if (!user) return res.status(401).json({ message: 'מייל או סיסמה שגויים' });

    // מייל לא אומת — חוסמים רק אם Gmail מוגדר
    const emailEnabled = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD &&
      !process.env.GMAIL_USER.includes('your-gmail'));

    if (emailEnabled && !user.email_verified) {
      return res.status(403).json({
        message: 'יש לאמת את כתובת המייל לפני ההתחברות. בדוק את תיבת הדואר שלך.',
        unverified: true,
        email: user.email,
      });
    }

    if (!user.is_active) return res.status(401).json({ message: 'החשבון מושבת. אנא פנה למנהל המערכת.' });

    // חשבון ננעל
    if (user.is_locked) {
      return res.status(403).json({
        message: 'החשבון ננעל עקב ניסיונות התחברות כושלים מרובים. אנא פנה למנהל המערכת.',
        locked: true,
      });
    }

    // משתמש שנרשם דרך Google אין לו סיסמה
    if (!user.password) {
      return res.status(401).json({ message: 'חשבון זה משתמש בכניסה עם Google. אנא לחץ על "כניסה עם Google".' });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      // עדכון אטומי בשורה אחת — לא read-then-write: אם זה נעשה בשתי שאילתות (קרוא
      // failed_login_attempts, חשב ב-JS, כתוב בחזרה), בקשות מקבילות עם סיסמה שגויה
      // יכולות כולן לקרוא את אותו ערך ישן לפני שמישהי כותבת בחזרה, כך שהמונה נתקע
      // נמוך ונעילת 10-הנסיונות אף פעם לא מופעלת מול ניסיון מבוזר/מקבילי
      const result = await pool.query(
        `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             is_locked  = (failed_login_attempts + 1 >= 10),
             locked_at  = CASE WHEN (failed_login_attempts + 1 >= 10) THEN NOW() ELSE locked_at END
         WHERE id = $1
         RETURNING failed_login_attempts, is_locked`,
        [user.id]
      );
      const attempts = result.rows[0].failed_login_attempts;
      const shouldLock = result.rows[0].is_locked;

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

    const token = generateToken(user);
    const { password: _, failed_login_attempts: __, locked_at: ___, token_version: ____, ...userData } = user;
    setAuthCookie(res, token);
    res.json({ token, user: userData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

exports.logout = async (req, res) => {
  try {
    // מעלה את מונה הגרסה — כל טוקן שהונפק לפני הרגע הזה נחשב מבוטל,
    // גם אם הוא עדיין "תקף" מבחינת jwt.verify (נבדק ב-middleware/auth.js)
    if (req.user?.id) {
      await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
    }
  } catch (err) {
    console.error('[LOGOUT] שגיאה בעדכון token_version:', err.message);
    // ממשיכים לנקות את העוגייה גם אם העדכון נכשל — לא חוסמים את המשתמש מלהתנתק בצד הלקוח
  }
  clearAuthCookie(res);
  res.json({ message: 'התנתקת בהצלחה' });
};
