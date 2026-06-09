/**
 * RunnerRunner.app tournament importer.
 * Saves session cookies after first login — subsequent runs skip the login form.
 *
 * Run: node server/scripts/importRunnerRunner.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const puppeteer = require('puppeteer-core');
const pool      = require('../config/db');
const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');

const PHONE       = '0545861119';
const PASSWORD    = 'AnE181924!';
const BASE_URL    = 'https://runnerrunner.app';
const COOKIES_FILE = path.join(__dirname, 'rr_cookies.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `C:/Users/${process.env.USERNAME || 'MS'}/AppData/Local/Google/Chrome/Application/chrome.exe`,
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

async function loginAndSaveCookies(page) {
  console.log('🔑 Logging in...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);

  try {
    await page.waitForSelector('input[type="tel"], input[type="text"]', { timeout: 10000 });
    const phoneInput = await page.$('input[type="tel"]') || await page.$('input[type="text"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type(PHONE);
    }
  } catch (e) { console.error('Phone input error:', e.message); }

  try {
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.type('input[type="password"]', PASSWORD);
  } catch (e) { console.error('Password input error:', e.message); }

  try {
    const btn = await page.$('button[type="submit"]') || await page.$('button');
    if (btn) await btn.click();
  } catch {}

  await sleep(5000);

  const url = page.url();
  if (url.includes('login') || url.includes('auth') || url === BASE_URL + '/') {
    // might have redirected to app — check if we're past login
    const isLoggedIn = await page.evaluate(() =>
      !document.querySelector('input[type="password"]')
    );
    if (!isLoggedIn) {
      console.error('❌ Login may have failed — check if the account is locked');
      return false;
    }
  }

  const cookies = await page.cookies();
  const storage = await page.evaluate(() => ({
    local:   { ...localStorage },
    session: { ...sessionStorage },
  }));
  fs.writeFileSync(COOKIES_FILE, JSON.stringify({ cookies, storage }, null, 2));
  console.log('💾 Session saved to rr_cookies.json');
  return true;
}

async function restoreSession(page) {
  if (!fs.existsSync(COOKIES_FILE)) return false;
  try {
    const { cookies, storage } = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    // Navigate to site first so we can set cookies on the right domain
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (cookies?.length) await page.setCookie(...cookies);
    if (storage?.local) {
      await page.evaluate(data => {
        Object.entries(data).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch {} });
      }, storage.local);
    }
    console.log('🍪 Session restored from rr_cookies.json');
    return true;
  } catch (e) {
    console.error('Could not restore session:', e.message);
    return false;
  }
}

async function run() {
  const chromePath = findChrome();
  if (!chromePath) { console.error('❌ Chrome not found'); process.exit(1); }
  console.log('🌐 Chrome:', chromePath);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=he-IL'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // ── Capture API responses ───────────────────────────────────────────────────
  const apiData = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/') && !url.includes('/tournament') && !url.includes('/event')) return;
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const json = await response.json();
      apiData.push({ url, json });
    } catch {}
  });

  // ── Authenticate ────────────────────────────────────────────────────────────
  const hasSavedSession = fs.existsSync(COOKIES_FILE);

  if (hasSavedSession) {
    console.log('♻️  Using saved session (no login needed)');
    await restoreSession(page);
  } else {
    const ok = await loginAndSaveCookies(page);
    if (!ok) { await browser.close(); await pool.end(); return; }
  }

  // ── Navigate to tournament list ─────────────────────────────────────────────
  console.log('\n📋 Loading tournament page...');
  const routes = ['/tournaments', '/events', '/schedule', '/home', '/dashboard', '/'];
  for (const route of routes) {
    const url = BASE_URL + route;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(3000);
      const cur = page.url();
      const onLogin = cur.includes('login') || cur.includes('/auth');
      if (!onLogin) { console.log(`  ✓ ${route}`); break; }
      console.log(`  redirect→login on ${route}`);
    } catch (e) { console.log(`  ✗ ${route}: ${e.message}`); }
  }

  // If we got redirected to login even with cookies, session expired — delete & retry
  const finalUrl = page.url();
  if (finalUrl.includes('login') || finalUrl.includes('/auth')) {
    console.log('⚠️  Session expired — deleting saved session and logging in fresh...');
    fs.unlinkSync(COOKIES_FILE);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    const ok = await loginAndSaveCookies(page);
    if (!ok) { await browser.close(); await pool.end(); return; }
  }

  await sleep(2000);
  console.log('  Final URL:', page.url());

  // ── Extract DOM blocks ──────────────────────────────────────────────────────
  const domBlocks = await page.evaluate(() => {
    const seen = new Set();
    const results = [];
    const selectors = [
      '[class*="tournament"]', '[class*="event"]', '[class*="card"]',
      '[class*="item"]', 'article', 'li', 'tr',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (text.length > 50 && !seen.has(text)) { seen.add(text); results.push(text); }
      });
      if (results.length >= 30) break;
    }
    if (results.length === 0) {
      const body = (document.body.innerText || '').trim();
      if (body) results.push(body.slice(0, 8000));
    }
    return results;
  });

  await page.screenshot({ path: path.join(__dirname, 'rr_debug.png') });
  console.log('📸 rr_debug.png');
  console.log(`  DOM: ${domBlocks.length} blocks | API: ${apiData.length} responses`);

  await browser.close();

  // ── Parse & save ────────────────────────────────────────────────────────────
  const items = [];
  for (const { url, json } of apiData) {
    const arr = Array.isArray(json) ? json
      : (json.data || json.tournaments || json.events || json.results || []);
    if (Array.isArray(arr) && arr.length > 0) {
      console.log(`  📡 API ${url}: ${arr.length} items`);
      items.push(...arr.map(i => (typeof i === 'string' ? i : JSON.stringify(i))));
    }
  }
  if (items.length === 0) items.push(...domBlocks.filter(b => b.length > 30));

  if (items.length === 0) {
    console.log('\n⚠️  No data found. Check rr_debug.png');
    await pool.end();
    return;
  }

  console.log(`\n🎯 Processing ${items.length} candidates...`);
  const { parseWithAI } = require('../services/importAgent');
  const KEYWORDS = ['טורניר','פוקר','poker','tournament','buy','gtd','blind','₪','stack','level'];
  let saved = 0;

  for (const raw of items) {
    if (items.length > 20 && !KEYWORDS.some(k => raw.toLowerCase().includes(k))) continue;

    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const dup = await pool.query(`SELECT id FROM tournament_imports WHERE content_hash=$1 LIMIT 1`, [hash]);
    if (dup.rows.length > 0) { process.stdout.write('.'); continue; }

    const parsed = await parseWithAI(raw);
    const conf = parsed?.confidence ?? 0;
    if (!parsed || conf < 0.2) continue;

    await pool.query(
      `INSERT INTO tournament_imports (source, raw_text, parsed_data, content_hash, status)
       VALUES ('website', $1, $2, $3, 'pending')`,
      [raw.slice(0, 8000), JSON.stringify(parsed), hash]
    );
    console.log(`  ✅ ${parsed.name || '(unnamed)'} | conf=${conf.toFixed(2)} | ${parsed.date || '?'} ${parsed.start_time || ''}`);
    saved++;
  }

  console.log(`\n✅ Done. ${saved} new tournaments saved as pending imports.`);
  await pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
