// בדיקות להגנה מפני scraping — רצות בלי DB (היומן והפיתיונות מוחלפים בזיכרון).
// הרצה: cd server && npm test
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-anti-scraping';

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const config = require('../config/antiScraping');
const pageToken = require('../utils/pageToken');
const anti = require('../middleware/antiScraping');

const events = [];
anti._test.setEventSink(async (e) => { events.push(e); });
anti._test.setCanaryLoader(async () => [42]);

function buildApp() {
  const app = express();
  app.set('trust proxy', 2); // כמו בפרודקשן (Railway: לקוח, edge)
  app.use(anti.resolveClientIp);
  app.use(anti.guard);
  app.get('/robots.txt', (req, res) => res.type('text/plain').send(anti.robotsTxt()));
  app.get(`${config.trap.path}*`, (req, res, next) => anti.trap(req, res).catch(next));
  app.use(cookieParser());
  app.use(anti.dataGuard);
  app.get('/api/tournaments', (req, res) => res.json({ items: [] }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.post('/api/agent/whatsapp-webhook', (req, res) => res.json({ ok: true }));
  app.get(/^(?!\/api).*/, anti.pageLimiter, async (req, res) =>
    res.type('html').send(anti.renderIndexHtml('<html><head></head><body><div id="root"></div></body></html>',
      { canaryIds: await anti.getCanaryIds() })));
  return app;
}

let server, base, ipCounter = 0;
const app = buildApp();
server = app.listen(0);
base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
// כל בדיקה מקבלת IP משלה (דרך X-Forwarded-For, שהשרת מאמין לו בדיוק בקפיצה אחת) כדי שמגבלות הקצב לא יתערבבו
const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250 + 1}`;
// כמו Railway: "<גולש>, <edge>" — ה-edge תמיד מאותו טווח, כדי לוודא שהוא לא נחשב ל-IP של הגולש
const EDGE = '152.233.13.164';
const get = (path, { ua = BROWSER_UA, ip = freshIp(), headers = {} } = {}) =>
  fetch(base + path, { headers: { ...(ua !== null && { 'user-agent': ua }), 'x-forwarded-for': `${ip}, ${EDGE}`, ...headers } });

beforeEach(() => { events.length = 0; anti._test.reset(); });

test('page token: valid / tampered / expired', () => {
  const t = pageToken.issue();
  assert.equal(pageToken.verify(t).ok, true);
  const [body, mac] = t.split('.');
  assert.equal(pageToken.verify(`${body}x.${mac}`).reason, 'invalid');
  assert.equal(pageToken.verify('').reason, 'missing');
  const old = pageToken.issue({ now: Date.now() - (config.pageToken.ttlSeconds + 5) * 1000 });
  assert.equal(pageToken.verify(old).reason, 'expired');
});

test('page token carries canary hashes, not raw ids', () => {
  const t = pageToken.issue({ canaryIds: [42] });
  const payload = JSON.parse(Buffer.from(t.split('.')[0], 'base64url').toString());
  assert.deepEqual(payload.h, [pageToken.canaryHash(payload.s, 42)]);
  assert.ok(!JSON.stringify(payload).includes('42"'));
});

test('browser user agent can load a page', async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, new RegExp(`<meta name="${config.pageToken.metaName}" content="[^"]+"`));
  assert.match(html, new RegExp(`href="${config.trap.path}"`));
});

test('script clients and empty user agent get 403 and are logged', async () => {
  for (const ua of ['python-requests/2.31', 'curl/8.4.0', 'Wget/1.21', 'Go-http-client/1.1', 'axios/1.6.0',
    'node-fetch/1.0', 'Mozilla/5.0 HeadlessChrome/120.0', 'Scrapy/2.11']) {
    const r = await get('/', { ua });
    assert.equal(r.status, 403, ua);
  }
  assert.equal((await get('/', { ua: null })).status, 403); // fetch של Node שולח "node"
  // User-Agent ריק לגמרי — דרך http ישירות (fetch תמיד מוסיף אחד)
  const status = await new Promise((resolve, reject) => {
    require('http').get(base + '/', { headers: { 'x-forwarded-for': freshIp() } }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(status, 403);
  await new Promise((res) => setImmediate(res));
  assert.ok(events.some((e) => e.reason === 'blocked_user_agent'));
  assert.ok(events.some((e) => e.reason === 'empty_user_agent'));
});

test('agent webhooks and health check are exempt from the user-agent filter', async () => {
  assert.equal((await get('/api/health', { ua: 'node-fetch/1.0' })).status, 200);
  const r = await fetch(base + '/api/agent/whatsapp-webhook', { method: 'POST', headers: { 'user-agent': 'axios/1.6.0' } });
  assert.equal(r.status, 200);
});

test('data endpoint needs a page token', async () => {
  const ip = freshIp();
  const noToken = await get('/api/tournaments', { ip });
  assert.equal(noToken.status, 403);
  assert.equal((await noToken.json()).code, 'PAGE_TOKEN');
  const ok = await get('/api/tournaments', { ip, headers: { [config.pageToken.header]: pageToken.issue() } });
  assert.equal(ok.status, 200);
});

test('logged-in users skip the page token and rate limit', async () => {
  const jwtToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  const ip = freshIp();
  for (let i = 0; i < config.rateLimits.data.max + 5; i++) {
    const r = await get('/api/tournaments', { ip, headers: { cookie: `pli_token=${jwtToken}` } });
    assert.equal(r.status, 200);
  }
  // JWT מזויף לא נחשב התחברות
  const fake = jwt.sign({ id: 1 }, 'wrong-secret');
  assert.equal((await get('/api/tournaments', { headers: { authorization: `Bearer ${fake}` } })).status, 403);
});

test('data rate limit returns 429 with Retry-After', async () => {
  const ip = freshIp();
  const headers = { [config.pageToken.header]: pageToken.issue() };
  for (let i = 0; i < config.rateLimits.data.max; i++) {
    assert.equal((await get('/api/tournaments', { ip, headers })).status, 200);
  }
  const r = await get('/api/tournaments', { ip, headers });
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers.get('retry-after')) > 0);
  await new Promise((res) => setImmediate(res));
  assert.ok(events.some((e) => e.reason === 'rate_limit_data' && e.ip === ip));
});

test('page rate limit returns 429', async () => {
  const ip = freshIp();
  for (let i = 0; i < config.rateLimits.pages.max; i++) assert.equal((await get('/', { ip })).status, 200);
  const r = await get('/', { ip });
  assert.equal(r.status, 429);
  assert.ok(r.headers.get('retry-after'));
});

test('honeypot blocks the IP for everything else', async () => {
  const ip = freshIp();
  assert.equal((await get(config.trap.path, { ip })).status, 404);
  assert.ok(anti._test.isBlocked(ip));
  assert.equal((await get('/', { ip })).status, 403);
  assert.equal((await get('/', {})).status, 200); // IP אחר לא מושפע
  await new Promise((res) => setImmediate(res));
  assert.ok(events.some((e) => e.reason === 'honeypot' && e.ip === ip));
});

test('client IP: the visitor, not the Railway edge, and not a spoofed entry', async () => {
  const realIp = freshIp();
  // גם אם גולש מצליח להכניס ערך מזויף בתחילת השרשרת — נספרים רק 2 הקפיצות האחרונות
  await get(config.trap.path, { ip: `1.2.3.4, ${realIp}` });
  assert.ok(anti._test.isBlocked(realIp));
  assert.ok(!anti._test.isBlocked('1.2.3.4'));
  assert.ok(!anti._test.isBlocked(EDGE)); // שרת ה-edge המשותף לא נחסם
});

test('CF-Connecting-IP is ignored while not behind Cloudflare', async () => {
  const ip = freshIp();
  await get(config.trap.path, { ip, headers: { 'cf-connecting-ip': '9.9.9.9' } });
  assert.ok(anti._test.isBlocked(ip));
  assert.ok(!anti._test.isBlocked('9.9.9.9'));
});

test('fake Googlebot (no matching reverse DNS) is not exempt', async () => {
  const ip = freshIp();
  const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  assert.equal((await get('/api/tournaments', { ip, ua })).status, 403);
});

test('robots.txt blocks AI crawlers, keeps Google/Bing, hides /api and the trap', async () => {
  const txt = await (await get('/robots.txt')).text();
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'CCBot', 'Google-Extended', 'Bytespider']) {
    assert.match(txt, new RegExp(`User-agent: ${bot}\\n`));
  }
  assert.match(txt, /User-agent: Googlebot\n(Allow: .*\n)+Disallow: \/api\//);
  assert.match(txt, /User-agent: \*\nDisallow: \/api\/\nDisallow: \/partners\/feed-export/);
});
