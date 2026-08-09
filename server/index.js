// Web Crypto polyfill — required by @whiskeysockets/baileys on Node 18
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;

// אזור זמן קבוע — כל הזמנים במערכת הם שעון ישראל (גם אם השרת רץ ב-UTC, כמו Railway)
process.env.TZ = process.env.TZ || 'Asia/Jerusalem';
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
const inquiryRoutes        = require('./routes/inquiries');
const blindTemplateRoutes  = require('./routes/blindTemplates');
const eventTemplateRoutes  = require('./routes/eventTemplates');
const handHistoryRoutes    = require('./routes/handHistories');
const importRoutes         = require('./routes/imports');
const agentRoutes          = require('./routes/agent');

const app = express();

// ── Trust proxy (Railway / Heroku / nginx) ────────────────────────
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // מאפשר הגשת תמונות/לוגואים
  contentSecurityPolicy: false, // SPA מנהל CSP בצד לקוח
}));

// ── CORS ──────────────────────────────────────────────────────────
// The Hand Logger mobile app (Capacitor) requests from a fixed local-scheme origin
// rather than the web CLIENT_URL — capacitor://localhost on iOS, https://localhost
// on Android — so the web app's single allowed origin needs to become an allowlist.
const corsAllowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'capacitor://localhost',
  'https://localhost',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsAllowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  // Custom response headers are invisible to client JS on cross-origin requests unless
  // explicitly exposed — without this the mobile app's token-refresh header (see
  // middleware/auth.js) would be silently dropped by the browser/WebView.
  exposedHeaders: ['X-Refreshed-Token'],
}));

// ── Rate limiting כלל-מערכתי ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 דקות
  max: 2000,                 // הועלה — כלי אדמין עם polling; login עדיין מוגן ע"י authLimiter
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי בקשות — נסה שוב בעוד כמה דקות' },
  // נתיבי אדמין ו-agent מוגנים בעצמם ע"י requireRole — לא נספרים כנגד המכסה הגלובלית
  skip: (req) => req.path.startsWith('/agent/') || req.path.startsWith('/admin') || req.path.startsWith('/imports'),
});
app.use('/api', globalLimiter);

// ── Rate limiting מחמיר על Auth ──────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40, // 40 ניסיונות login/register בחלון 15 דק׳
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'יותר מדי ניסיונות התחברות — נסה שוב בעוד 15 דקות' },
});

app.use(express.json({ limit: '20mb' })); // 20mb for WhatsApp image forwarding
app.use(cookieParser());
app.use(passport.initialize());

// שרות קבצים סטטיים (לוגואים וסרטונים)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/blind-templates', blindTemplateRoutes); // rate limit רק על POST — מוגדר בתוך הנתיב
app.use('/api/event-templates', eventTemplateRoutes);
app.use('/api/hand-histories', handHistoryRoutes);
app.use('/api/imports',       importRoutes);
app.use('/api/agent',         agentRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Poker Live Israel API' }));

// ── סטטיסטיקות ציבוריות ────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tournaments t
           JOIN venues v ON t.venue_id = v.id
           WHERE t.status = 'approved' AND t.is_active = true AND v.is_approved = true
           AND (t.is_recurring = true OR COALESCE(t.estimated_end_time, t.start_time) > NOW())) AS tournaments,
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

  const server = app.listen(PORT, () => {
    console.log(`🂡 שרת פוקר לייב ישראל פועל על פורט ${PORT}`);
    // Start the import agent (Telegram bot + daily cron)
    const { startAgent } = require('./services/importAgent');
    startAgent();
    // Start WhatsApp listener (only if WHATSAPP_ENABLED=true)
    const { startWhatsApp } = require('./services/whatsappListener');
    startWhatsApp();
    // Daily feed sync (08:00 Israel time) — מסנכרן פידים חיצוניים
    const cron = require('node-cron');
    const { syncAllFeeds } = require('./services/feedSync');
    cron.schedule(process.env.FEED_SYNC_CRON || '0 8 * * *', () => {
      console.log('[feedSync] running daily sync…');
      syncAllFeeds().catch(e => console.error('[feedSync] daily run failed:', e.message));
    }, { timezone: 'Asia/Jerusalem' });

    // EVPlus LetsPoker sync — כל 5 שעות החל מחצות (הועבר מקצב יומי 08:05: הדף שלהם מתעדכן
    // לעיתים רחוקות אך בלי התראה מוקדמת, וקצב יומי השאיר טורנירים שנוספו "היום ליום מחר"
    // בלי זמן הכנה עד ריצת המחרת)
    const { syncLetsPoker } = require('./services/letsPokerSync');
    cron.schedule(process.env.LETSPOKER_SYNC_CRON || '0 0,5,10,15,20 * * *', () => {
      console.log('[letsPokerSync] running evplus sync…');
      syncLetsPoker('evplus').catch(e => console.error('[letsPokerSync:evplus] run failed:', e.message));
    }, { timezone: 'Asia/Jerusalem' });

    // HOUSE LetsPoker sync — כל 5 שעות החל מחצות (00:00/05:00/10:00/15:00/20:00, שעון ישראל)
    cron.schedule(process.env.HOUSE_LETSPOKER_SYNC_CRON || '0 0,5,10,15,20 * * *', () => {
      console.log('[letsPokerSync] running house sync…');
      syncLetsPoker('house').catch(e => console.error('[letsPokerSync:house] run failed:', e.message));
    }, { timezone: 'Asia/Jerusalem' });

    // ShowDown LetsPoker sync — כל 5 שעות החל מחצות, אותו קצב כמו HOUSE
    cron.schedule(process.env.SHOWDOWN_LETSPOKER_SYNC_CRON || '0 0,5,10,15,20 * * *', () => {
      console.log('[letsPokerSync] running showdown sync…');
      syncLetsPoker('showdown').catch(e => console.error('[letsPokerSync:showdown] run failed:', e.message));
    }, { timezone: 'Asia/Jerusalem' });

    // Suits LetsPoker sync — כל 5 שעות החל מחצות, מחליף את יבוא התמונות מוואטסאפ
    cron.schedule(process.env.SUITS_LETSPOKER_SYNC_CRON || '0 0,5,10,15,20 * * *', () => {
      console.log('[letsPokerSync] running suits sync…');
      syncLetsPoker('suits').catch(e => console.error('[letsPokerSync:suits] run failed:', e.message));
    }, { timezone: 'Asia/Jerusalem' });
  });

  // ── טיימאאוטים ברמת ה-socket — ללא זה חיבור תקוע נשאר פתוח לנצח ──
  server.keepAliveTimeout = 65_000; // מעל טיימאאוט טיפוסי של 60s בפרוקסי/load balancer
  server.headersTimeout = 66_000;   // חייב להיות גדול מ-keepAliveTimeout (דרישת Node)
  server.timeout = 120_000;         // מנתק socket לא פעיל לגמרי אחרי 2 דקות

  // ── כיבוי מסודר — סוגר את השרת ואת ה-pool במקום לנטוש חיבורים ──
  function shutdown(signal) {
    console.log(`${signal} התקבל — מכבה בצורה מסודרת...`);
    server.close(() => {
      pool.end(() => {
        console.log('השרת וה-pool נסגרו בהצלחה');
        process.exit(0);
      });
    });
    // כפיית יציאה אם הסגירה נתקעת (למשל חיבורים פעילים שלא משתחררים)
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
