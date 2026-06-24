/**
 * WhatsApp Local Forwarder
 * Run on your home/office computer (residential IP) to bridge WhatsApp → Railway.
 *
 * Setup:
 *   npm install
 *   node index.js
 *
 * Scans QR once, then runs in background forwarding group messages to the server.
 */

if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');

const WEBHOOK_URL  = process.env.WEBHOOK_URL  || 'https://www.pokerisrael.org/api/agent/whatsapp-webhook';
const GROUP_FILTER = (process.env.GROUPS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const AUTH_DIR     = path.join(__dirname, '.auth');

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion;
try {
  const b = require('@whiskeysockets/baileys');
  makeWASocket              = b.default || b.makeWASocket || b;
  useMultiFileAuthState     = b.useMultiFileAuthState;
  DisconnectReason          = b.DisconnectReason;
  fetchLatestBaileysVersion = b.fetchLatestBaileysVersion;
} catch (e) {
  console.error('❌ @whiskeysockets/baileys not found. Run: npm install');
  process.exit(1);
}

// QR code display in terminal
let qrcode;
try { qrcode = require('qrcode-terminal'); } catch {}

function normName(s) {
  return (s || '').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function postWebhook(groupName, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ from: groupName, text: body, message: body });
    const url = new URL(WEBHOOK_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', (e) => { console.error('⚠️  Webhook error:', e.message); resolve(0); });
    req.write(payload);
    req.end();
  });
}

async function start() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  let version;
  try {
    const v = await fetchLatestBaileysVersion();
    version = v.version;
  } catch {}

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    connectTimeoutMs: 60000,
    logger: { level: 'silent', trace(){}, debug(){}, info(){}, warn(){}, error: console.error, fatal: console.error, child(){ return this; } },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 סרוק את קוד ה-QR עם הוואטסאפ שלך:\n');
      if (qrcode) qrcode.generate(qr, { small: true });
      else console.log('QR:', qr.substring(0, 60) + '...');
    }
    if (connection === 'open') {
      console.log('✅ WhatsApp מחובר!');
      if (GROUP_FILTER.length)
        console.log('👂 מאזין לקבוצות:', GROUP_FILTER.join(', '));
      else
        console.log('👂 מאזין לכל הקבוצות');
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === (DisconnectReason?.loggedOut ?? 401)) {
        console.log('🚪 נותקת. מחק את תיקיית .auth והפעל מחדש.');
        process.exit(1);
      }
      console.log('⚠️  מחבר מחדש...');
      setTimeout(start, 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.key?.remoteJid?.endsWith('@g.us')) continue;
      if (msg.key?.fromMe) continue;

      const body = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || '';
      if (body.length < 20) continue;

      let groupName = '';
      try {
        const meta = await sock.groupMetadata(msg.key.remoteJid);
        groupName = meta?.subject || '';
      } catch {}

      // Filter by group name if configured
      if (GROUP_FILTER.length) {
        const gn = normName(groupName);
        const match = GROUP_FILTER.some(f => gn.includes(f) || f.includes(gn));
        if (!match) continue;
      }

      console.log(`📨 הודעה מ-"${groupName}" (${body.length} תווים) — שולח לשרת...`);
      const status = await postWebhook(groupName, body);
      console.log(`   ${status === 200 ? '✅' : '⚠️'} תגובת שרת: ${status}`);
    }
  });
}

start().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
