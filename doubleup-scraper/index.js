/**
 * Doubleup Club Scraper
 * Runs on any machine with Node — headless-renders the Doubleup Monday.com schedule form
 * (a client-side SPA with real Cloudflare bot-detection against datacenter IPs, confirmed
 * 2026-07-27 — must run from a residential IP, never Railway) once daily at 22:00 and POSTs
 * the parsed tournament list to the main server, which handles add/update/remove diffing
 * (see server/services/doubleupSync.js).
 *
 * Setup:
 *   npm install
 *   node index.js
 *
 * Runs an immediate sync on startup, then every day at 22:00.
 */

const cron = require('node-cron');
const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer');
const { parseDoubleupText } = require('./parse');

const BASE_URL = process.env.BASE_URL || 'https://www.pokerisrael.org';
const SYNC_URL = process.env.SYNC_URL || `${BASE_URL}/api/agent/doubleup-sync`;
const TARGET_URL = process.env.TARGET_URL || 'https://wkf.ms/4cY3pvm';
// חייב להתאים ל-AGENT_SECRET בסביבת השרת — בלעדיו הבקשות מהסקריפט הזה יידחו ב-401/503
const AGENT_SECRET = process.env.AGENT_SECRET || '';

function postJSON(targetUrl, data) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const url = new URL(targetUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Agent-Secret': AGENT_SECRET,
      },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.write(payload);
    req.end();
  });
}

async function scrapeOnce() {
  console.log(`\n[${new Date().toLocaleString('he-IL')}] 🔍 סורק את ${TARGET_URL}...`);
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000)); // let any late client-side fetch settle

    const text = await page.evaluate(() => document.body.innerText);
    const tournaments = parseDoubleupText(text);
    console.log(`   נמצאו ${tournaments.length} טורנירים — שולח לשרת...`);

    if (tournaments.length === 0) {
      console.warn('   ⚠️  0 טורנירים נמצאו — לא שולח (כנראה שגיאת פרסינג או חסימה, לא באמת ריק)');
      return;
    }

    const { status, body } = await postJSON(SYNC_URL, { tournaments });
    console.log(`   ${status === 200 ? '✅' : '⚠️'} תגובת שרת (${status}): ${body}`);
  } catch (e) {
    console.error('   ❌ שגיאה:', e.message);
  } finally {
    if (browser) await browser.close();
  }
}

console.log('🃏 Doubleup Scraper — בדיקה כל יום ב-22:00');
console.log(`   יעד: ${TARGET_URL}`);
console.log(`   שרת: ${SYNC_URL}\n`);

scrapeOnce();
cron.schedule('0 22 * * *', scrapeOnce);
console.log('⏰ מתוזמן לרוץ כל יום ב-22:00 (בנוסף לריצה המיידית שלמעלה)');
