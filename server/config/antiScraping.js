// ── הגדרות הגנה מפני גריפת נתונים (scraping) — כל הספים והרשימות במקום אחד ──
//
// כל שינוי כאן נכנס לתוקף בדפלוי הבא. אין צורך לגעת בקוד עצמו
// (middleware/antiScraping.js, utils/pageToken.js) כדי לכוונן.

module.exports = {
  // ── User-Agent: כלי סקריפט מוכרים → 403 (וגם User-Agent ריק) ──
  blockedUserAgents: [
    /python-requests/i,
    /python-urllib/i,
    /aiohttp/i,
    /httpx/i,
    /^curl\//i,
    /^wget\//i,
    /go-http-client/i,
    /^axios\//i,
    /node-fetch/i,
    /undici/i,
    /^node$/i,               // ברירת המחדל של fetch ב-Node.js
    /okhttp/i,
    /java\/\d/i,
    /libwww-perl/i,
    /headlesschrome/i,
    /phantomjs/i,
    /scrapy/i,
    /colly/i,
  ],

  // נתיבים שלא עוברים סינון User-Agent / חסימות IP / מגבלת קצב:
  // ה-webhooks של הסוכנים שלנו (forwarder, jokerclub, doubleup — רצים עם axios/node-fetch,
  // מאומתים בסוד משותף) ובדיקת הבריאות של Railway.
  exemptPaths: [
    /^\/api\/agent\//,
    /^\/api\/health$/,
  ],

  // ── מנועי חיפוש — מאומתים ב-reverse DNS (לא רק לפי User-Agent, שקל לזייף) ──
  // בוט מאומת לא נחסם, לא מוגבל בקצב ולא נדרש לטוקן דף.
  searchBots: [
    { name: 'Googlebot', ua: /googlebot|google-inspectiontool|googleother|storebot-google/i,
      hostSuffixes: ['.googlebot.com', '.google.com', '.googleusercontent.com'] },
    { name: 'Bingbot', ua: /bingbot|adidxbot|bingpreview|msnbot/i,
      hostSuffixes: ['.search.msn.com'] },
  ],
  searchBotCacheHours: 24,

  // ── robots.txt ──
  aiCrawlers: [
    'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
    'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
    'PerplexityBot', 'Perplexity-User',
    'CCBot', 'Bytespider', 'Google-Extended', 'Applebot-Extended',
    'meta-externalagent', 'Amazonbot', 'Diffbot',
  ],
  // נתיבי API שמותרים לגוגל/בינג בלבד ב-robots.txt — בלעדיהם גוגל רואה עמוד בית ריק
  // (הטורנירים נטענים מה-API בדפדפן)
  searchBotAllowedApi: [
    '/api/tournaments$',
    '/api/tournaments?',
    '/api/tournaments/public-venues',
    '/api/tournaments/all-brands',
    '/api/stats',
  ],

  // ── מגבלות קצב לכל IP (לא חלות על משתמשים מחוברים ועל בוטי חיפוש מאומתים) ──
  rateLimits: {
    pages: { windowMs: 60 * 1000, max: 60 },   // טעינות דף (HTML), לא JS/CSS/תמונות
    data:  { windowMs: 60 * 1000, max: 20 },   // נקודות קצה של נתוני טורנירים/מועדונים
  },

  // נקודות קצה ציבוריות של נתונים (GET בלבד) — מוגבלות בקצב ודורשות טוקן דף
  dataPaths: [
    '/api/tournaments',
    '/api/tournaments/public-venues',
    '/api/tournaments/all-brands',
    '/api/tournaments/nearby',
    '/api/stats',
  ],

  // ── טוקן דף: נוצר בכל טעינת דף ומוטמע ב-HTML, נדרש לקריאות הנתונים ──
  pageToken: {
    ttlSeconds: 10 * 60,
    metaName: 'pli-pt',
    header: 'x-page-token',
  },

  // ── עימוד ──
  pagination: {
    defaultPageSize: 30,
    maxPageSize: 50,
  },
  nearbyMaxResults: 100,

  // ── מלכודת (honeypot): קישור נסתר ב-HTML, חסום ב-robots.txt ──
  trap: {
    path: '/partners/feed-export',
    blockMinutes: 60,
  },

  // ── Cloudflare: כרגע האתר לא מאחורי Cloudflare (DNS ב-GoDaddy → Railway ישירות),
  // לכן הכותרת CF-Connecting-IP לא נקראת בכלל — כל אחד יכול לזייף אותה.
  // אם עוברים ל-Cloudflare: לשנות ל-true. גם אז הכותרת נקראת רק כשהבקשה הגיעה
  // בפועל מכתובת של Cloudflare (רשימה למטה, מ-https://www.cloudflare.com/ips/).
  trustCloudflare: false,
  cloudflareRanges: [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
    '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
    '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
    '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
    '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
  ],

  // ── יומן אבטחה (טבלת security_events) ──
  log: {
    retentionDays: 30,
    dedupeSeconds: 60,       // אותו IP + אותה סיבה נרשם פעם אחת בדקה
    maxUserAgentLength: 300,
  },
};
