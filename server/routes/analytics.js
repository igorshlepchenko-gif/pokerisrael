// ── מונה כניסות ────────────────────────────────────────────────────────────
// הדפדפן שולח "צפייה בדף" בכל מעבר דף (client/src/components/PageViewTracker.jsx).
// בלי עוגיות ובלי שמירת IP: המבקר מזוהה רק בתוך אותו יום, לפי גיבוב של IP+דפדפן
// עם מלח יומי שנגזר מסוד השרת. לא נספרים: בוטים, אדמין, ובקשות בלי טוקן דף תקף
// (כך שאי אפשר לנפח את המונה בסקריפט).
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const config = require('../config/antiScraping');
const pageToken = require('../utils/pageToken');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const israelDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD

function visitorHash(day, ip, ua) {
  const salt = crypto.createHmac('sha256', process.env.JWT_SECRET || 'pv').update(`pv:${day}`).digest();
  return crypto.createHmac('sha256', salt).update(`${ip}|${ua}`).digest('hex').slice(0, 16);
}

function deviceOf(ua) {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

// מקור הכניסה: utm_source אם יש, אחרת הדומיין שממנו הגיעו (בלי www). כניסה מתוך האתר עצמו = null
function sourceOf(utm, referrer, host) {
  if (utm) return String(utm).toLowerCase().slice(0, 100);
  if (!referrer) return null;
  try {
    const h = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    const own = String(host || '').toLowerCase().replace(/^www\./, '').split(':')[0];
    if (!h || h === own || h.endsWith('pokerisrael.org')) return null;
    return h.slice(0, 100);
  } catch {
    return null;
  }
}

function isAdminRequest(req) {
  const token = req.cookies?.pli_token || req.headers.authorization?.split(' ')[1];
  if (!token) return false;
  try { return jwt.verify(token, process.env.JWT_SECRET).role === 'admin'; } catch { return false; }
}

const recent = new Map(); // `${visitor}|${path}` → ms — רינדור כפול / רענון מהיר לא נספר פעמיים

router.post('/pv', async (req, res) => {
  res.status(204).end(); // הדפדפן לא מחכה לתשובה
  try {
    const ua = req.get('user-agent') || '';
    if (!ua || config.analytics.botUserAgents.test(ua) || isAdminRequest(req)) return;
    if (!pageToken.verify(req.body?.t).ok) return;

    let path = String(req.body?.path || '/').split(/[?#]/)[0].slice(0, 200);
    if (!path.startsWith('/')) path = '/';
    const day = israelDay();
    const visitor = visitorHash(day, req.clientIp || req.ip, ua);

    const key = `${visitor}|${path}`;
    const now = Date.now();
    if (now - (recent.get(key) || 0) < 10 * 1000) return;
    if (recent.size > 20000) recent.clear();
    recent.set(key, now);

    const isEntry = !!req.body?.entry;
    await pool.query(
      `INSERT INTO page_views (day, visitor, path, source, device, is_entry) VALUES ($1,$2,$3,$4,$5,$6)`,
      [day, visitor, path, isEntry ? sourceOf(req.body?.utm, req.body?.ref, req.get('host')) : null, deviceOf(ua), isEntry]
    );
  } catch (err) {
    console.error('[analytics] pv failed:', err.message);
  }
});

// ── סיכום לאדמין ──
router.get('/summary', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const since = `day > (NOW() AT TIME ZONE 'Asia/Jerusalem')::date - $1::int`;
    const [daily, pages, sources, devices] = await Promise.all([
      pool.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day,
                COALESCE(v.visitors, 0)::int AS visitors, COALESCE(v.views, 0)::int AS views
         FROM generate_series((NOW() AT TIME ZONE 'Asia/Jerusalem')::date - ($1::int - 1),
                              (NOW() AT TIME ZONE 'Asia/Jerusalem')::date, '1 day') AS d
         LEFT JOIN (SELECT day, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS views
                    FROM page_views WHERE ${since} GROUP BY day) v ON v.day = d::date
         ORDER BY d`, [days]),
      pool.query(
        `SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT day::text || visitor)::int AS visitors
         FROM page_views WHERE ${since} GROUP BY path ORDER BY views DESC LIMIT 15`, [days]),
      pool.query(
        `SELECT COALESCE(source, '') AS source, COUNT(*)::int AS visits
         FROM page_views WHERE ${since} AND is_entry GROUP BY 1 ORDER BY visits DESC LIMIT 15`, [days]),
      pool.query(
        `SELECT device, COUNT(*)::int AS visits
         FROM page_views WHERE ${since} AND is_entry GROUP BY device ORDER BY visits DESC`, [days]),
    ]);
    res.json({ days, daily: daily.rows, pages: pages.rows, sources: sources.rows, devices: devices.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
module.exports._test = { visitorHash, deviceOf, sourceOf };
