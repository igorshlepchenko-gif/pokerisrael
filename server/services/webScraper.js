/**
 * Web Scraper — sifts Israeli poker club websites for tournament announcements.
 * Called from importAgent.runDailyScan(). Feeds into the same import pipeline
 * (processMessage → Groq parse → tournament_imports → admin approval).
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const crypto  = require('crypto');
const pool    = require('../config/db');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const POKER_KEYWORDS = [
  'טורניר','פוקר','poker','tournament','buy-in','buy in','באי-אין',
  'gtd','פרס מובטח','ערימה','stack','בליינד','blind','re-entry',
  'late reg','שלב','level','מועדון','קאש','cash game','₪',
];

function looksLikePoker(text) {
  const lower = text.toLowerCase();
  return POKER_KEYWORDS.some(k => lower.includes(k));
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function isDuplicate(hash) {
  try {
    const r = await pool.query(
      `SELECT id FROM tournament_imports WHERE content_hash=$1 LIMIT 1`,
      [hash]
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

// Extract meaningful text blocks from an HTML page.
// Returns array of strings, each 50–2000 chars, that mention poker.
async function fetchAndExtract(url) {
  const resp = await axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': USER_AGENT },
    maxRedirects: 5,
  });

  const $ = cheerio.load(resp.data);

  // Strip boilerplate
  $('script, style, noscript, nav, footer, header, [role="navigation"], ' +
    '.nav, .navbar, .menu, .footer, .sidebar, .cookie-banner, .gdpr').remove();

  const blocks = new Set();

  // Priority: elements likely to contain event/tournament info
  const SELECTORS = [
    'article', '.event', '.tournament', '.post', '.card',
    '[class*="event"]', '[class*="tournament"]', '[class*="poker"]',
    'li', 'p', 'td',
  ];

  for (const sel of SELECTORS) {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 60 && text.length <= 3000 && looksLikePoker(text)) {
        blocks.add(text);
      }
    });
  }

  // Fallback: chunk the full body text if no blocks found
  if (blocks.size === 0) {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const chunkSize = 800;
    for (let i = 0; i < bodyText.length; i += chunkSize) {
      const chunk = bodyText.slice(i, i + chunkSize).trim();
      if (chunk.length >= 60 && looksLikePoker(chunk)) {
        blocks.add(chunk);
      }
    }
  }

  return [...blocks];
}

// ── Main scanner ─────────────────────────────────────────────────────────────

async function scanWebSources() {
  const { processMessage } = require('./importAgent');

  const sources = await pool.query(
    `SELECT * FROM agent_sources WHERE platform='website' AND active=true`
  );

  if (sources.rows.length === 0) return { scanned: 0, found: 0 };

  let scanned = 0, found = 0;

  for (const src of sources.rows) {
    try {
      console.log(`[WebScraper] Scraping: ${src.name} (${src.identifier})`);
      const blocks = await fetchAndExtract(src.identifier);
      console.log(`[WebScraper] ${blocks.length} poker blocks found on ${src.name}`);

      for (const block of blocks) {
        scanned++;
        const hash = hashText(block);
        if (await isDuplicate(hash)) continue;

        const ok = await processMessage('website', block, src.id, hash);
        if (ok) found++;
      }

      await pool.query(
        `UPDATE agent_sources SET last_checked=NOW() WHERE id=$1`,
        [src.id]
      );
    } catch (e) {
      console.error(`[WebScraper] Error on ${src.name}:`, e?.message);
    }
  }

  console.log(`[WebScraper] Done. scanned=${scanned} imported=${found}`);
  return { scanned, found };
}

module.exports = { scanWebSources };
