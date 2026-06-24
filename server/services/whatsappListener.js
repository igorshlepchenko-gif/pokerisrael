/**
 * WhatsApp Group Listener (whatsapp-web.js)
 * Connects via QR code, listens to specific groups, pipes messages into the import agent.
 *
 * Enable by setting in .env:
 *   WHATSAPP_ENABLED=true
 *
 * Monitored groups are stored in agent_sources (platform='whatsapp', identifier = group name).
 * Session is persisted in server/.wwebjs_auth so QR is only needed once.
 */

const path = require('path');
const QRCode = require('qrcode');
const pool = require('../config/db');

let Client, LocalAuth;
try {
  ({ Client, LocalAuth } = require('whatsapp-web.js'));
} catch {
  // package not installed — listener disabled
}

// ── State ────────────────────────────────────────────────────────────────────
let client       = null;
let status       = 'disconnected';   // disconnected | qr | authenticating | ready | error
let lastQrDataUrl = null;            // PNG data-URL of the current QR
let lastError    = null;
let readyInfo    = null;             // { pushname, number }

// Lazy require to avoid circular dependency
function getProcessMessage() {
  return require('./importAgent').processMessage;
}

// ── Load monitored group names from DB ───────────────────────────────────────
async function getMonitoredGroups() {
  try {
    const r = await pool.query(
      `SELECT identifier, name FROM agent_sources
       WHERE platform='whatsapp' AND active=true`
    );
    return r.rows;
  } catch { return []; }
}

// Normalize for matching (strip emojis/spaces, lowercase)
function normGroup(s) {
  return (s || '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Handle an incoming group message ─────────────────────────────────────────
async function handleMessage(msg) {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const monitored = await getMonitoredGroups();
    if (monitored.length === 0) return;

    const chatName = normGroup(chat.name);
    const match = monitored.find(g => {
      const gn = normGroup(g.identifier);
      return chatName === gn || chatName.includes(gn) || gn.includes(chatName);
    });
    if (!match) return;

    const body = msg.body || '';
    if (body.length < 20) return;

    console.log(`[WhatsApp] 📨 Message from "${chat.name}" (${body.length} chars)`);

    // Pipe into the import agent → AI parse → pending import → Telegram notify
    const processMessage = getProcessMessage();
    const created = await processMessage('whatsapp', body, null);
    if (created) console.log(`[WhatsApp] ✅ Tournament import created from "${chat.name}"`);
  } catch (e) {
    console.error('[WhatsApp] handleMessage error:', e?.message);
  }
}

// ── Initialize the client ────────────────────────────────────────────────────
function initClient() {
  if (!Client) {
    status = 'error';
    lastError = 'whatsapp-web.js not installed';
    return null;
  }
  if (client) return client;

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'pokerisrael',
      dataPath: path.join(__dirname, '..', '.wwebjs_auth'),
    }),
    // Pin a known-good WhatsApp Web version to fix "can't link devices" errors.
    // Override with WA_WEB_VERSION in .env if WhatsApp updates and this breaks.
    webVersionCache: {
      type: 'remote',
      remotePath: process.env.WA_WEB_VERSION_URL ||
        'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1040911178-alpha.html',
    },
    puppeteer: {
      headless: true,
      // Use system Chrome if available (set CHROME_PATH in .env to override)
      executablePath: process.env.CHROME_PATH ||
        (process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : '/usr/bin/chromium'),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', async (qr) => {
    status = 'qr';
    try { lastQrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 }); } catch {}
    console.log('[WhatsApp] 📱 QR code ready — scan in admin panel');
  });

  client.on('authenticated', () => {
    status = 'authenticating';
    lastQrDataUrl = null;
    console.log('[WhatsApp] 🔐 Authenticated');
  });

  client.on('ready', () => {
    status = 'ready';
    lastQrDataUrl = null;
    lastError = null;
    readyInfo = {
      pushname: client.info?.pushname || null,
      number:   client.info?.wid?.user || null,
    };
    console.log(`[WhatsApp] ✅ Connected as ${readyInfo.pushname || readyInfo.number}`);
  });

  client.on('auth_failure', (m) => {
    status = 'error';
    lastError = 'Authentication failed: ' + m;
    console.error('[WhatsApp] ❌ Auth failure:', m);
  });

  client.on('disconnected', (reason) => {
    status = 'disconnected';
    readyInfo = null;
    console.warn('[WhatsApp] ⚠️ Disconnected:', reason);
  });

  // Listen to both received and own messages (in case admin is in the group)
  client.on('message',        handleMessage);
  client.on('message_create', handleMessage);

  return client;
}

// ── Public API ────────────────────────────────────────────────────────────────

function startWhatsApp() {
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('[WhatsApp] ⏸  disabled (set WHATSAPP_ENABLED=true to enable)');
    return;
  }
  if (!Client) {
    console.log('[WhatsApp] ⚠️  whatsapp-web.js not installed');
    return;
  }
  const c = initClient();
  if (!c) return;
  status = 'authenticating';
  c.initialize().catch(e => {
    status = 'error';
    lastError = e?.message;
    console.error('[WhatsApp] init error:', e?.message);
  });
  console.log('[WhatsApp] 🚀 Initializing client...');
}

function getStatus() {
  return { status, qr: lastQrDataUrl, error: lastError, info: readyInfo };
}

// List the WhatsApp groups the connected account belongs to (for easy source picking)
async function listGroups() {
  if (status !== 'ready' || !client) return [];
  try {
    const chats = await client.getChats();
    return chats
      .filter(c => c.isGroup)
      .map(c => ({ id: c.id?._serialized, name: c.name, participants: c.participants?.length || 0 }));
  } catch (e) {
    console.error('[WhatsApp] listGroups error:', e?.message);
    return [];
  }
}

async function logout() {
  if (client) {
    try { await client.logout(); } catch {}
    try { await client.destroy(); } catch {}
    client = null;
  }
  status = 'disconnected';
  lastQrDataUrl = null;
  readyInfo = null;
}

module.exports = { startWhatsApp, getStatus, listGroups, logout, initClient };
