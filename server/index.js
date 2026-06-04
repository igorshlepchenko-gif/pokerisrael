require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const registrationRoutes   = require('./routes/registrations');
const blindTemplateRoutes  = require('./routes/blindTemplates');
const eventTemplateRoutes  = require('./routes/eventTemplates');
const handHistoryRoutes    = require('./routes/handHistories');

const app = express();

// ── Security headers ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // מאפשר הגשת תמונות/לוגואים
  contentSecurityPolicy: false, // SPA מנהל CSP בצד לקוח
}));

// ── CORS ──────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Rate limiting כלל-מערכתי ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 דקות
  max: 300,                  // 300 בקשות לחלון
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי בקשות — נסה שוב בעוד כמה דקות' },
});
app.use('/api', globalLimiter);

// ── Rate limiting מחמיר על Auth ──────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 ניסיונות login/register בחלון 15 דק׳
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי ניסיונות התחברות — נסה שוב בעוד 15 דקות' },
});

// ── Rate limiting על הרשמות (ציבורי) ─────────────────────────────
const registrationLimiter = rateLimit({
  windowMs: 60 * 1000, // חלון של דקה
  max: 10,             // 10 הרשמות בדקה מאותה IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי הרשמות — נסה שוב בעוד דקה' },
});

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// שרות קבצים סטטיים (לוגואים וסרטונים)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/blind-templates', blindTemplateRoutes); // rate limit רק על POST — מוגדר בתוך הנתיב
app.use('/api/event-templates', eventTemplateRoutes);
app.use('/api/hand-histories', handHistoryRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Poker Live Israel API' }));

// ── סטטיסטיקות ציבוריות ────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tournaments)                     AS tournaments,
        (SELECT COUNT(*) FROM venues WHERE is_approved = true) AS venues,
        (SELECT COUNT(*) FROM users)                           AS users
    `);
    const r = result.rows[0];
    res.json({
      tournaments: parseInt(r.tournaments),
      venues:      parseInt(r.venues),
      users:       parseInt(r.users),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// ── הגשת הלקוח הבנוי בפרודקשן (SPA) ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  // כל נתיב שאינו /api או /uploads → index.html (React Router)
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'שגיאת שרת פנימית' });
});

// ── ניקוי יומי — מחיקת רשומות יומן שינויים מעל חודש ────────────
const pool = require('./config/db');
const cleanOldLogs = async () => {
  try {
    const result = await pool.query(
      `DELETE FROM change_logs WHERE created_at < NOW() - INTERVAL '1 month'`
    );
    if (result.rowCount > 0) {
      console.log(`[CLEANUP] נמחקו ${result.rowCount} רשומות ישנות מיומן השינויים`);
    }
  } catch (err) {
    console.error('[CLEANUP] שגיאה במחיקת רשומות ישנות:', err.message);
  }
};
const PORT = process.env.PORT || 5000;

// יצירת טבלאות אוטומטית בהפעלה הראשונה, ואז הפעלת השרת
const ensureSchema = require('./database/ensureSchema');
ensureSchema().then(() => {
  cleanOldLogs();
  setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`🂡 שרת פוקר לייב ישראל פועל על פורט ${PORT}`);
  });
});
