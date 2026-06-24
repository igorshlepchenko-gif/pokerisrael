/**
 * WhatsApp Group Listener — powered by @whiskeysockets/baileys
 * Connects via QR code (no browser/Puppeteer), listens to specific groups,
 * pipes messages into the import agent.
 *
 * Enable: WHATSAPP_ENABLED=true in Railway env vars.
 * Session persisted in server/.wwebjs_auth/baileys (survives redeploys via Railway volume).
 */

// Baileys requires globalThis.crypto (Web Crypto API) — polyfill for Node 18
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;

const path = require('path');
const fs   = require('fs');
const QRCode = require('qrcode');
const pool = require('../config/db');

let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket              = baileys.default || baileys.makeWASocket || baileys;
  useMultiFileAuthState     = baileys.useMultiFileAuthState;
  DisconnectReason          = baileys.DisconnectReason;
  Browsers                  = baileys.Browsers;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
} catch {
  // package not installed — listener disabled
}

// ── State ─────────────────────────────────────────────────────────────────────
let sock          = null;
let status        = 'disconnected';
let lastQrDataUrl = null;
let lastError     = null;
let readyInfo     = null;
let reconnectTimer = null;

const AUTH_DIR = path.join(__dirname, '..', '.wwebjs_auth', 'baileys');

function getProcessMessage() {
  return require('./importAgent').processMessage;
}

async function getMonitoredGroups() {
  try {
    const r = await pool.query(
      `SELECT identifier, name FROM agent_sources WHERE platform='whatsapp' AND active=true`
    );
    return r.rows;
  } catch { return []; }
}

function normGroup(s) {
  return (s || '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function handleMessage(msg) {
  try {
    const jid = msg.key?.remoteJid || '';
    if (!jid.endsWith('@g.us')) return;   // groups only
    if (msg.key?.fromMe) return;

    const body = msg.message?.conversation
      || msg.message?.extendedTextMessage?.text
      || '';
    if (body.length < 20) return;

    const monitored = await getMonitoredGroups();
    if (!monitored.length) return;

    // Resolve group name from metadata
    let groupName = '';
    try {
      const meta = await sock.groupMetadata(jid);
      groupName = meta?.subject || '';
    } catch {}

    const cn = normGroup(groupName);
    const match = monitored.find(g => {
      const gn = normGroup(g.identifier);
      return cn === gn || cn.includes(gn) || gn.includes(cn);
    });
    if (!match) return;

    console.log(`[WhatsApp] 📨 Message from "${groupName}" (${body.length} chars)`);
    const created = await getProcessMessage()('whatsapp', body, null);
    if (created) console.log(`[WhatsApp] ✅ Tournament import created from "${groupName}"`);
  } catch (e) {
    console.error('[WhatsApp] handleMessage error:', e?.message);
  }
}

// ── Initialize / reconnect ────────────────────────────────────────────────────
async function initClient() {
  if (!makeWASocket) {
    status = 'error';
    lastError = '@whiskeysockets/baileys not installed';
    return null;
  }
  if (sock) return sock;

  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  } catch {}

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  // Always fetch the latest WhatsApp Web version — avoids 405 Connection Failure
  let waVersion;
  try {
    const vResult = await fetchLatestBaileysVersion();
    waVersion = vResult.version;
    console.log('[WhatsApp] Using WA version:', waVersion?.join('.'));
  } catch (e) {
    console.warn('[WhatsApp] Could not fetch WA version, using default:', e?.message);
  }

  sock = makeWASocket({
    auth: state,
    version: waVersion,
    printQRInTerminal: false,
    browser: Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '20.0.04'],
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    logger: { level: 'silent', trace(){}, debug(){}, info(){}, warn: console.warn, error: console.error, fatal: console.error, child(){ return this; } },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      status = 'qr';
      try { lastQrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 }); } catch {}
      console.log('[WhatsApp] 📱 QR code ready — scan in admin panel');
    }

    if (connection === 'open') {
      status = 'ready';
      lastQrDataUrl = null;
      lastError = null;
      readyInfo = {
        pushname: sock.user?.name || null,
        number:   sock.user?.id?.split(':')[0] || null,
      };
      console.log(`[WhatsApp] ✅ Connected as ${readyInfo.pushname || readyInfo.number}`);
    }

    if (connection === 'close') {
      const err  = lastDisconnect?.error;
      const code = err?.output?.statusCode ?? err?.data?.statusCode;
      const loggedOut = code === (DisconnectReason?.loggedOut ?? 401);
      console.warn('[WhatsApp] ⚠️ Connection closed. code:', code, '| msg:', err?.message ?? err?.data ?? String(err ?? ''));
      sock = null;
      if (loggedOut) {
        status = 'disconnected';
        lastError = 'Logged out';
        readyInfo = null;
        console.log('[WhatsApp] 🚪 Logged out — clear session and reconnect manually');
      } else {
        status = 'authenticating';
        lastError = err?.message || String(err ?? '');
        console.warn('[WhatsApp] ⚠️ Reconnecting in 5s...');
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => initClient(), 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) await handleMessage(msg);
  });

  return sock;
}

// ── Public API ─────────────────────────────────────────────────────────────────

function startWhatsApp() {
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('[WhatsApp] ⏸  disabled (set WHATSAPP_ENABLED=true to enable)');
    return;
  }
  if (!makeWASocket) {
    console.log('[WhatsApp] ⚠️  @whiskeysockets/baileys not installed');
    return;
  }
  status = 'authenticating';
  console.log('[WhatsApp] 🚀 Initializing client...');
  initClient().catch(e => {
    status = 'error';
    lastError = e?.message;
    console.error('[WhatsApp] init error:', e?.message);
  });
}

function getStatus() {
  return { status, qr: lastQrDataUrl, error: lastError, info: readyInfo };
}

async function listGroups() {
  if (status !== 'ready' || !sock) return [];
  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups).map(g => ({
      id:           g.id,
      name:         g.subject,
      participants: g.participants?.length || 0,
    }));
  } catch (e) {
    console.error('[WhatsApp] listGroups error:', e?.message);
    return [];
  }
}

async function logout() {
  clearTimeout(reconnectTimer);
  if (sock) {
    try { await sock.logout(); } catch {}
    sock = null;
  }
  // Clear saved credentials
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
  status = 'disconnected';
  lastQrDataUrl = null;
  readyInfo = null;
}

module.exports = { startWhatsApp, getStatus, listGroups, logout, initClient };
