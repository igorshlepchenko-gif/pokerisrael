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

const BASE_URL      = process.env.BASE_URL      || 'https://www.pokerisrael.org';
const WEBHOOK_URL   = process.env.WEBHOOK_URL   || `${BASE_URL}/api/agent/whatsapp-webhook`;
const IMAGE_URL     = process.env.IMAGE_URL     || `${BASE_URL}/api/agent/whatsapp-image`;
const HEARTBEAT_URL = process.env.HEARTBEAT_URL || `${BASE_URL}/api/agent/whatsapp/forwarder-heartbeat`;
const GROUP_FILTER  = (process.env.GROUPS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
// חייב להתאים ל-AGENT_SECRET בסביבת השרת — בלעדיו כל הבקשות מהסקריפט הזה יידחו ב-401/503
const AGENT_SECRET  = process.env.AGENT_SECRET || '';
const AUTH_DIR      = path.join(__dirname, '.auth');

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage;
try {
  const b = require('@whiskeysockets/baileys');
  makeWASocket                 = b.default || b.makeWASocket || b;
  useMultiFileAuthState        = b.useMultiFileAuthState;
  DisconnectReason             = b.DisconnectReason;
  fetchLatestBaileysVersion    = b.fetchLatestBaileysVersion;
  downloadContentFromMessage   = b.downloadContentFromMessage;
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
    }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', () => resolve(0));
    req.write(payload);
    req.end();
  });
}

function postWebhook(groupName, body) {
  return postJSON(WEBHOOK_URL, { from: groupName, text: body, message: body });
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

  let heartbeatTimer = null;

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 סרוק את קוד ה-QR עם הוואטסאפ שלך:\n');
      if (qrcode) qrcode.generate(qr, { small: true });
      else console.log('QR:', qr.substring(0, 60) + '...');
    }
    if (connection === 'open') {
      const pushname = sock.user?.name || '';
      const number   = sock.user?.id?.split(':')[0] || '';
      console.log('✅ WhatsApp מחובר!', pushname ? `(${pushname})` : '');
      if (GROUP_FILTER.length)
        console.log('👂 מאזין לקבוצות:', GROUP_FILTER.join(', '));
      else
        console.log('👂 מאזין לכל הקבוצות');

      // Send heartbeat immediately and every 30s so the admin panel shows "connected"
      const beat = () => postJSON(HEARTBEAT_URL, { pushname, number, groups: GROUP_FILTER });
      beat();
      heartbeatTimer = setInterval(beat, 30_000);
    }
    if (connection === 'close') {
      clearInterval(heartbeatTimer);
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

      let groupName = '';
      try {
        const meta = await sock.groupMetadata(msg.key.remoteJid);
        groupName = meta?.subject || '';
      } catch {}

      // Filter by group name if configured
      if (GROUP_FILTER.length) {
        const gn = normName(groupName);
        if (!GROUP_FILTER.some(f => gn.includes(f) || f.includes(gn))) continue;
      }

      const msgContent = msg.message || {};
      const msgType    = Object.keys(msgContent)[0] || '';

      // ── Image message → Weekly Schedule parser ──────────────────────────────
      if (msgType === 'imageMessage' && downloadContentFromMessage) {
        try {
          const imgMsg  = msgContent.imageMessage;
          const caption = imgMsg.caption || '';
          console.log(`🖼️  תמונה מ-"${groupName}"${caption ? ` — "${caption.slice(0,40)}"` : ''} — מוריד...`);

          const stream = await downloadContentFromMessage(imgMsg, 'image');
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const buffer   = Buffer.concat(chunks);
          const base64   = buffer.toString('base64');
          const mimeType = imgMsg.mimetype || 'image/jpeg';

          console.log(`   גודל: ${Math.round(buffer.length / 1024)}KB — שולח לשרת לניתוח...`);
          const status = await postJSON(IMAGE_URL, { from: groupName, imageBase64: base64, mimeType, caption });
          console.log(`   ${status === 200 ? '✅' : '⚠️'} תגובת שרת: ${status}`);
        } catch (e) {
          console.error(`⚠️  שגיאה בהורדת תמונה מ-"${groupName}":`, e.message);
        }
        continue;
      }

      // ── Text message → Webhook ──────────────────────────────────────────────
      const body = msgContent.conversation
        || msgContent.extendedTextMessage?.text
        || '';
      if (body.length < 20) continue;

      console.log(`📨 הודעה מ-"${groupName}" (${body.length} תווים) — שולח לשרת...`);
      const status = await postWebhook(groupName, body);
      console.log(`   ${status === 200 ? '✅' : '⚠️'} תגובת שרת: ${status}`);
    }
  });
}

start().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
