// Web Crypto polyfill — required by @whiskeysockets/baileys on Node 18
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;

// File polyfill — groq-sdk (voice transcription) uploads through the global File,
// which only exists from Node 20. Railway pins no Node version, so production ran
// Node 18 and every recording failed with "File is not defined as a global".
// node:buffer has had File since 18.13, so exposing it keeps transcription working
// whatever Node the platform picks. Same pattern as the crypto polyfill above.
if (!globalThis.File) globalThis.File = require('node:buffer').File;

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
const onlineClickRoutes    = require('./routes/onlineClicks');
const blindTemplateRoutes  = require('./routes/blindTemplates');
const eventTemplateRoutes  = require('./routes/eventTemplates');
const handHistoryRoutes    = require('./routes/handHistories');
const handNarrationRoutes    = require('./routes/handNarration');
const importRoutes         = require('./routes/imports');
const agentRoutes          = require('./routes/agent');
const abRoutes = require('./routes/ab');
const analyticsRoutes = require('./routes/analytics');
const pushRoutes = require('./routes/push');
const { seedSiteAssets } = require('./utils/seedSiteAssets');

const app = express();

// ── Trust proxy (Railway / Heroku / nginx) ────────────────────────
// Railway: X-Forwarded-For מגיע בצורה "<IP של הגולש>, <שרת ה-edge של Railway>", והחיבור עצמו
// מגיע מפרוקסי פנימי (100.64.x.x). לכן 2 קפיצות — אחרת req.ip הוא שרת ה-edge, וכל הגולשים
// שעוברים דרכו נספרים כ-IP אחד (הגבלות קצב, חסימות, מונה הכניסות). Railway דורס כל
// X-Forwarded-For שהגולש שולח בעצמו (נבדק 2026-10-15), כך שאי אפשר לזייף.
app.set('trust proxy', 2);

// ── Security headers ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // מאפשר הגשת תמונות/לוגואים
  // CSP: סקריפטים רק מהאתר עצמו — אם אי פעם תיפתח פרצת XSS (קישור/תוכן מוזרק),
  // הדפדפן לא יריץ קוד מבחוץ ולא ישלח נתונים לשרת זר. הרשימות תואמות את מה שהאתר
  // באמת טוען: Google Fonts, הטמעות YouTube/Spotify, תמונות חיצוניות (לוגואים/תמונות
  // ממוזערות), וקבצי blob של סרטוני Hand Logger.
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'blob:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ['https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://open.spotify.com'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
}));

// ── הגנה מפני גריפת נתונים (scraping) — הגדרות ב-config/antiScraping.js ──
const antiScraping = require('./middleware/antiScraping');
const antiScrapingConfig = require('./config/antiScraping');
app.use(antiScraping.resolveClientIp);
app.use(antiScraping.guard);
app.get('/robots.txt', (req, res) => res.type('text/plain').send(antiScraping.robotsTxt()));
app.get(`${antiScrapingConfig.trap.path}*`, (req, res, next) => antiScraping.trap(req, res).catch(next));

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
  // רק ניסיונות התחברות/הרשמה נספרים. GET /me ("מי מחובר") נקרא בכל טעינת דף — כשהוא נספר,
  // גולש פעיל הגיע ל-40 טעינות ב-15 דקות, קיבל 429, והאתר התנהג כאילו הוא לא מחובר
  skip: (req) => req.method === 'GET',
});

app.use(express.json({ limit: '20mb' })); // 20mb for WhatsApp image forwarding
app.use(cookieParser());
app.use(passport.initialize());

// מגבלת קצב + טוקן דף על נקודות הקצה הציבוריות של הנתונים (אחרי cookieParser —
// משתמש מחובר מזוהה לפי העוגייה ופטור)
app.use(antiScraping.dataGuard);

// בפיתוח (Vite מגיש את index.html, לא השרת) — הדפדפן מבקש טוקן כאן במקום מה-<meta>
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/page-token', async (req, res) => {
    const html = antiScraping.renderIndexHtml('<head></head>', {
      canaryIds: await antiScraping.getCanaryIds(), ip: req.clientIp, ua: req.get('user-agent'),
    });
    res.json({ token: html.match(/content="([^"]+)"/)[1] });
  });
}

// שרות קבצים סטטיים (לוגואים וסרטונים)
// רק סוגי מדיה מוכרים מוגשים — כל קובץ אחר (למשל .html/.svg שהגיע איכשהו לתיקייה)
// מחזיר 404, כדי שלא יוגש כדף מהדומיין שלנו. CSP sandbox כשכבת הגנה נוספת.
const UPLOAD_SERVED_EXT = /\.(jpe?g|png|gif|webp|mp4|webm|mov)$/i;
app.use('/uploads',
  (req, res, next) => (UPLOAD_SERVED_EXT.test(req.path) ? next() : res.status(404).end()),
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'"),
  }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/online-clicks', onlineClickRoutes);
app.use('/api/blind-templates', blindTemplateRoutes); // rate limit רק על POST — מוגדר בתוך הנתיב
app.use('/api/event-templates', eventTemplateRoutes);
app.use('/api/hand-histories', handHistoryRoutes);
app.use('/api/hand-narration', handNarrationRoutes);
app.use('/api/imports',       importRoutes);
app.use('/api/agent',         agentRoutes);
app.use('/api/ab',            abRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/push',          pushRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Poker Live Israel API' }));

// ── סטטיסטיקות ציבוריות ────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tournaments t
           JOIN venues v ON t.venue_id = v.id
           WHERE t.status = 'approved' AND t.is_active = true AND v.is_approved = true AND t.is_canary = false
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
  // index: false — גם "/" עובר דרך ה-handler למטה, כדי שיקבל טוקן דף
  app.use(express.static(clientDist, { index: false }));
  // כל נתיב שאינו /api או /uploads → index.html (React Router), עם טוקן דף וקישור מלכודת.
  // no-store: הטוקן תקף דקות ספורות, אסור שדפדפן/פרוקסי יגיש עותק ישן.
  const fs = require('fs');
  const indexHtml = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
  app.get(/^(?!\/api|\/uploads).*/, antiScraping.pageLimiter, async (req, res, next) => {
    try {
      const html = antiScraping.renderIndexHtml(indexHtml, {
        canaryIds: await antiScraping.getCanaryIds(), ip: req.clientIp, ua: req.get('user-agent'),
        promos: require('./services/drivePromos').currentDrivePromos(),
      });
      res.set('Cache-Control', 'no-store').type('html').send(html);
    } catch (err) { next(err); }
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
    // יומן האבטחה (scraping) — נשמר רק לתקופה שב-config/antiScraping.js
    const sec = await pool.query(
      `DELETE FROM security_events WHERE created_at < NOW() - make_interval(days => $1)`,
      [antiScrapingConfig.log.retentionDays]
    );
    if (sec.rowCount > 0) console.log(`[CLEANUP] נמחקו ${sec.rowCount} רשומות ישנות מיומן האבטחה`);
    // קודי סימן מים (IP) — 30 יום; חסימות ידניות שפג תוקפן
    await pool.query(`DELETE FROM watermark_codes WHERE day < CURRENT_DATE - $1::int`, [antiScrapingConfig.watermark.retentionDays]);
    await pool.query(`DELETE FROM blocked_ips WHERE expires_at IS NOT NULL AND expires_at < NOW()`);
    // מונה כניסות — שומרים קצת יותר משנה לצורך השוואה שנתית
    await pool.query(
      `DELETE FROM page_views WHERE day < CURRENT_DATE - $1::int`,
      [antiScrapingConfig.analytics.retentionDays]
    );
  } catch (err) {
    console.error('[CLEANUP] שגיאה במחיקת רשומות ישנות:', err.message);
  }
};
const PORT = process.env.PORT || 5000;

// יצירת טבלאות אוטומטית בהפעלה הראשונה, ואז הפעלת השרת
const ensureSchema = require('./database/ensureSchema');
ensureSchema().then(() => {
  antiScraping.reloadManualBlocks();
  seedSiteAssets();
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

    // House דרום LetsPoker sync — כל 5 שעות החל מחצות, מקום חדש
    cron.schedule(process.env.HOUSEDAROM_LETSPOKER_SYNC_CRON || '0 0,5,10,15,20 * * *', () => {
      console.log('[letsPokerSync] running housedarom sync…');
      syncLetsPoker('housedarom').catch(e => console.error('[letsPokerSync:housedarom] run failed:', e.message));
    }, { timezone: 'Asia/Jerusalem' });

    // פרסומי Ludus מתיקיית Google Drive (services/drivePromos.js) — מה שבתיקייה מוחלף באתר
    // בשעות 09:00, 10:00, 11:00, 14:35, 15:00, 16:00 (שעון ישראל), וגם מיד בהפעלת השרת
    const { syncDrivePromos, loadState: loadDrivePromos } = require('./services/drivePromos');
    const runDriveSync = () => syncDrivePromos()
      .then(r => console.log('[drivePromos] synced:', JSON.stringify(r)))
      .catch(e => console.error('[drivePromos] sync failed:', e.message));
    loadDrivePromos().then(runDriveSync);
    cron.schedule(process.env.DRIVE_PROMOS_CRON || '0 9,10,11,15,16 * * *', runDriveSync, { timezone: 'Asia/Jerusalem' });
    cron.schedule(process.env.DRIVE_PROMOS_CRON_2 || '35 14 * * *', runDriveSync, { timezone: 'Asia/Jerusalem' });

    // התראת בוקר לאדמין: "טורנירי היום מוכנים לשיתוף" → /today (services/webPush.js)
    const { sendDailyShareReminder } = require('./services/webPush');
    cron.schedule(process.env.PUSH_DAILY_CRON || '0 8 * * *', () => {
      sendDailyShareReminder()
        .then(r => console.log('[push] daily share reminder:', JSON.stringify(r)))
        .catch(e => console.error('[push] daily share reminder failed:', e.message));
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
