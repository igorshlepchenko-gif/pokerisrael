// ── הגנה מפני גריפת נתונים (scraping) ─────────────────────────────────────
// כל הספים והרשימות ב-config/antiScraping.js. סדר השימוש ב-index.js:
//   resolveClientIp → guard (חסימות IP + User-Agent) → robots/trap → dataGuard
//   (מגבלת קצב + טוקן דף על נקודות הקצה של הנתונים) → pageLimiter על דפי HTML.
//
// מגבלות הקצב והחסימות נשמרות בזיכרון התהליך — מתאפס בכל דפלוי/הפעלה מחדש,
// ומתאים לשרת יחיד (Railway רץ עם מופע אחד). היומן עצמו נשמר ב-DB (security_events).
const dns = require('dns').promises;
const crypto = require('crypto');
const net = require('net');
const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config/antiScraping');
const pageToken = require('../utils/pageToken');

// ── יומן אבטחה ────────────────────────────────────────────────────────────
// ניתן להחלפה בבדיקות (setEventSink). ברירת מחדל: טבלת security_events.
let eventSink = async (e) => {
  const pool = require('../config/db');
  await pool.query(
    `INSERT INTO security_events (ip, user_agent, method, path, reason) VALUES ($1,$2,$3,$4,$5)`,
    [e.ip, e.userAgent, e.method, e.path, e.reason]
  );
};
const recentEvents = new Map(); // `${ip}|${reason}` → timestamp

function logEvent(req, reason) {
  const ip = req.clientIp || req.ip;
  const key = `${ip}|${reason}`;
  const now = Date.now();
  if (now - (recentEvents.get(key) || 0) < config.log.dedupeSeconds * 1000) return;
  if (recentEvents.size > 10000) recentEvents.clear();
  recentEvents.set(key, now);
  const event = {
    ip,
    userAgent: (req.get('user-agent') || '').slice(0, config.log.maxUserAgentLength),
    method: req.method,
    path: req.path.slice(0, 300), // בלי query string — חיפושים של גולשים לא נרשמים
    reason,
  };
  console.warn(`[anti-scraping] ${reason} ip=${ip} path=${event.path} ua="${event.userAgent}"`);
  Promise.resolve().then(() => eventSink(event)).catch((err) => console.error('[anti-scraping] log failed:', err.message));
}

// ── IP אמיתי של הלקוח ─────────────────────────────────────────────────────
// req.ip כבר מחושב מ-X-Forwarded-For לפי 'trust proxy' = 1 (הכתובת שהפרוקסי של
// Railway ראה בפועל — לא ערך שהלקוח שלח). CF-Connecting-IP נקרא רק כשהוגדר
// trustCloudflare והבקשה באמת הגיעה מטווח של Cloudflare.
const cfList = new net.BlockList();
for (const cidr of config.cloudflareRanges) {
  const [addr, bits] = cidr.split('/');
  cfList.addSubnet(addr, Number(bits), net.isIPv6(addr) ? 'ipv6' : 'ipv4');
}
const normalizeIp = (ip) => (ip || '').replace(/^::ffff:/, '');

function resolveClientIp(req, res, next) {
  let ip = normalizeIp(req.ip);
  if (config.trustCloudflare) {
    const cf = normalizeIp(req.get('cf-connecting-ip'));
    const type = net.isIPv6(ip) ? 'ipv6' : 'ipv4';
    if (cf && net.isIP(cf) && net.isIP(ip) && cfList.check(ip, type)) ip = cf;
  }
  req.clientIp = ip;
  next();
}

// ── בוטים של מנועי חיפוש — אימות reverse DNS + forward DNS ────────────────
const botCache = new Map(); // ip → { ok, until }

async function isVerifiedSearchBot(req) {
  if (req._verifiedBot !== undefined) return req._verifiedBot;
  const ua = req.get('user-agent') || '';
  const bot = config.searchBots.find((b) => b.ua.test(ua));
  if (!bot) return (req._verifiedBot = false);
  const ip = req.clientIp || normalizeIp(req.ip);
  const cached = botCache.get(ip);
  if (cached && cached.until > Date.now()) return (req._verifiedBot = cached.ok);
  let ok = false;
  try {
    const hosts = await dns.reverse(ip);
    for (const host of hosts) {
      if (!bot.hostSuffixes.some((s) => host.endsWith(s))) continue;
      const addrs = await dns.lookup(host, { all: true });
      if (addrs.some((a) => normalizeIp(a.address) === ip)) { ok = true; break; }
    }
  } catch { ok = false; }
  if (botCache.size > 10000) botCache.clear();
  botCache.set(ip, { ok, until: Date.now() + config.searchBotCacheHours * 3600 * 1000 });
  if (!ok) logEvent(req, `fake_search_bot:${bot.name}`);
  return (req._verifiedBot = ok);
}

// משתמש מחובר (JWT תקף) — לא מוגבל בקצב ולא נדרש לטוקן דף. בדיקת חתימה בלבד,
// בלי DB; זיוף דורש את JWT_SECRET.
function isLoggedIn(req) {
  const token = req.cookies?.pli_token || req.headers.authorization?.split(' ')[1];
  if (!token || !process.env.JWT_SECRET) return false;
  try { jwt.verify(token, process.env.JWT_SECRET); return true; } catch { return false; }
}

const isExempt = (req) => config.exemptPaths.some((re) => re.test(req.path));

// ── חסימות IP זמניות (מלכודת) ─────────────────────────────────────────────
const blockedIps = new Map(); // ip → until (ms)

function blockIp(ip, minutes) {
  blockedIps.set(ip, Date.now() + minutes * 60 * 1000);
}
function isBlocked(ip) {
  const until = blockedIps.get(ip);
  if (!until) return false;
  if (until < Date.now()) { blockedIps.delete(ip); return false; }
  return true;
}

// ── שומר ראשי: IP חסום / User-Agent ריק / כלי סקריפט ─────────────────────
function guard(req, res, next) {
  if (isExempt(req)) return next();
  const ip = req.clientIp;
  if (isBlocked(ip)) {
    logEvent(req, 'blocked_ip');
    return res.status(403).type('text/plain').send('Forbidden');
  }
  const ua = (req.get('user-agent') || '').trim();
  if (!ua) {
    logEvent(req, 'empty_user_agent');
    return res.status(403).type('text/plain').send('Forbidden');
  }
  const hit = config.blockedUserAgents.find((re) => re.test(ua));
  if (hit) {
    logEvent(req, 'blocked_user_agent');
    return res.status(403).type('text/plain').send('Forbidden');
  }
  next();
}

// ── מלכודת: קישור נסתר ב-HTML שאסור ב-robots.txt — מי שמגיע אליו הוא רובוט ──
async function trap(req, res) {
  if (await isVerifiedSearchBot(req)) return res.status(404).end();
  blockIp(req.clientIp, config.trap.blockMinutes);
  logEvent(req, 'honeypot');
  res.status(404).type('text/plain').send('Not found');
}

// ── robots.txt ────────────────────────────────────────────────────────────
function robotsTxt() {
  const lines = [];
  for (const bot of config.aiCrawlers) lines.push(`User-agent: ${bot}`);
  lines.push('Disallow: /', '');
  for (const bot of ['Googlebot', 'Bingbot']) {
    lines.push(`User-agent: ${bot}`);
    for (const p of config.searchBotAllowedApi) lines.push(`Allow: ${p}`);
    lines.push('Disallow: /api/', `Disallow: ${config.trap.path}`, '');
  }
  lines.push('User-agent: *', 'Disallow: /api/', `Disallow: ${config.trap.path}`, '');
  return lines.join('\n');
}

// ── מגבלות קצב ────────────────────────────────────────────────────────────
function makeLimiter({ windowMs, max }, reason) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.clientIp || normalizeIp(req.ip)),
    skip: async (req) => isExempt(req) || isLoggedIn(req) || (await isVerifiedSearchBot(req)),
    handler: (req, res, _next, options) => {
      logEvent(req, reason);
      res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
      res.status(429);
      if (req.path.startsWith('/api/')) return res.json({ message: 'יותר מדי בקשות — נסה שוב בעוד דקה' });
      res.type('text/plain').send('Too many requests — please try again in a minute.');
    },
  });
}

const pageLimiter = makeLimiter(config.rateLimits.pages, 'rate_limit_pages');
const dataLimiter = makeLimiter(config.rateLimits.data, 'rate_limit_data');

// ── חסימת IP ידנית (מהאדמין, טבלת blocked_ips) — רק לנתוני הטורנירים ──
// נטען מה-DB פעם בדקה ובכל שינוי מהאדמין; בדיקה בזיכרון בכל בקשה.
let manualBlocks = new Set();
let blocksLoader = async () => {
  const pool = require('../config/db');
  const r = await pool.query('SELECT ip FROM blocked_ips WHERE expires_at IS NULL OR expires_at > NOW()');
  return r.rows.map((x) => x.ip);
};
async function reloadManualBlocks() {
  try { manualBlocks = new Set(await blocksLoader()); } catch (err) { console.error('[anti-scraping] blocked_ips load failed:', err.message); }
}
if (process.env.NODE_ENV !== 'test') setInterval(reloadManualBlocks, 60 * 1000).unref();

const isDataRequest = (req) => req.method === 'GET' && config.dataPaths.includes(req.path);

// ── טוקן דף על נקודות הקצה של הנתונים ─────────────────────────────────────
async function requirePageToken(req, res, next) {
  if (isLoggedIn(req) || (await isVerifiedSearchBot(req))) return next();
  const result = pageToken.verify(req.get(config.pageToken.header));
  if (result.ok) return next();
  // טוקן שפג תוקפו = לשונית שנשארה פתוחה — הדפדפן מחדש אותו לבד; לא חשוד
  if (result.reason !== 'expired') logEvent(req, `page_token_${result.reason}`);
  res.status(403).json({ code: 'PAGE_TOKEN', reason: result.reason, message: 'יש לרענן את הדף' });
}

// dataLimiter + requirePageToken — רק על GET לנקודות הקצה שב-config.dataPaths
function dataGuard(req, res, next) {
  if (!isDataRequest(req)) return next();
  if (manualBlocks.has(req.clientIp) && !isLoggedIn(req)) {
    logEvent(req, 'blocked_ip_manual');
    return res.status(403).json({ code: 'BLOCKED', message: 'אין גישה' });
  }
  dataLimiter(req, res, (err) => {
    if (err) return next(err);
    requirePageToken(req, res, next).catch(next);
  });
}

// ── קוד אישי בסימן המים ──────────────────────────────────────────────────
// דטרמיניסטי ל-(יום, IP): אותו גולש מקבל אותו קוד כל היום, והמיפוי נשמר בטבלה
// watermark_codes כדי שאפשר יהיה לחפש קוד מתוך צילום מסך ולמצוא את ה-IP.
const israelDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
function watermarkCode(day, ip) {
  const { alphabet, length } = config.watermark;
  const h = crypto.createHmac('sha256', process.env.JWT_SECRET || 'wm').update(`wm:${day}:${ip}`).digest();
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[h[i] % alphabet.length];
  return out;
}
const recordedWm = new Map(); // `${day}|${ip}` → ms — לא לכתוב ל-DB בכל טעינת דף
let wmSink = async ({ code, day, ip, ua }) => {
  const pool = require('../config/db');
  await pool.query(
    `INSERT INTO watermark_codes (code, day, ip, user_agent) VALUES ($1,$2,$3,$4)
     ON CONFLICT (day, ip) DO UPDATE SET last_seen = NOW(), views = watermark_codes.views + 1,
       user_agent = EXCLUDED.user_agent`,
    [code, day, ip, ua]
  );
};
function watermarkFor(ip, ua) {
  if (!ip) return null;
  const day = israelDay();
  const code = watermarkCode(day, ip);
  const key = `${day}|${ip}`;
  if (Date.now() - (recordedWm.get(key) || 0) > 10 * 60 * 1000) { // עדכון לכל היותר פעם ב-10 דק' לגולש
    if (recordedWm.size > 20000) recordedWm.clear();
    recordedWm.set(key, Date.now());
    Promise.resolve()
      .then(() => wmSink({ code, day, ip, ua: (ua || '').slice(0, config.log.maxUserAgentLength) }))
      .catch((err) => console.error('[anti-scraping] watermark record failed:', err.message));
  }
  return code;
}

// ── הזרקת טוקן + קישור מלכודת ל-index.html ────────────────────────────────
function renderIndexHtml(html, { canaryIds = [], ip = null, ua = '', promos = [], promoClubs = [] } = {}) {
  const token = pageToken.issue({ canaryIds, wm: watermarkFor(ip, ua) });
  // פרסומי אונליין שמתעדכנים מהשרת (services/drivePromos.js) — בלוק נתונים, לא סקריפט שרץ
  // (CSP מתיר אותו), ו-< מוברח כדי שתוכן לא יוכל לסגור את התגית
  const promosJson = JSON.stringify(promos).replace(/</g, '\\u003c');
  // data-clubs — הקלאבים שהפרסומים שלהם מגיעים רק מ-Drive (פרסומי האקסל שלהם מתעלמים)
  const clubsAttr = promoClubs.filter((c) => /^[a-z0-9-]+$/.test(c)).join(',');
  const meta = `<meta name="${config.pageToken.metaName}" content="${token}" />\n` +
    `<script id="pli-promos" type="application/json" data-clubs="${clubsAttr}">${promosJson}</script>`;
  // בלתי נראה (פיקסל אחד חתוך), מוסתר מקוראי מסך ומניווט מקלדת — בני אדם לא נתקלים בו.
  // ⚠️ לא left:-10000px: בעמוד RTL זה מרחיב את הגלילה האופקית ב-10,000px (אפשר היה לגלול הצידה לריק)
  const trapLink = `<a href="${config.trap.path}" rel="nofollow" tabindex="-1" aria-hidden="true" ` +
    `style="position:absolute;top:0;right:0;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap">Tournament data export</a>`;
  return html.replace('</head>', `${meta}\n</head>`).replace(/<body([^>]*)>/, `<body$1>\n${trapLink}`);
}

// מזהי טורנירי פיתיון — שאילתה אחת בדקה לכל היותר
let canaryCache = { ids: [], until: 0 };
let canaryLoader = async () => {
  const pool = require('../config/db');
  const r = await pool.query('SELECT id FROM tournaments WHERE is_canary = true');
  return r.rows.map((row) => row.id);
};
async function getCanaryIds() {
  if (canaryCache.until > Date.now()) return canaryCache.ids;
  try {
    canaryCache = { ids: await canaryLoader(), until: Date.now() + 60 * 1000 };
  } catch (err) {
    console.error('[anti-scraping] canary lookup failed:', err.message);
  }
  return canaryCache.ids;
}

module.exports = {
  resolveClientIp,
  guard,
  trap,
  robotsTxt,
  pageLimiter,
  dataGuard,
  renderIndexHtml,
  getCanaryIds,
  reloadManualBlocks,
  watermarkCode,
  logEvent,
  // לבדיקות
  _test: {
    setEventSink: (fn) => { eventSink = fn; },
    setCanaryLoader: (fn) => { canaryLoader = fn; canaryCache = { ids: [], until: 0 }; },
    setWatermarkSink: (fn) => { wmSink = fn; },
    setBlocksLoader: (fn) => { blocksLoader = fn; },
    reset: () => { blockedIps.clear(); recentEvents.clear(); botCache.clear(); recordedWm.clear(); },
    isBlocked,
  },
};
