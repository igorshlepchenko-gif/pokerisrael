/**
 * PokerIsrael Import Agent
 * Daily routine: reads Telegram channels + WhatsApp webhook messages,
 * parses them with Groq AI, creates pending imports, notifies admin via Telegram.
 *
 * Setup:
 *   TELEGRAM_BOT_TOKEN   — from @BotFather
 *   TELEGRAM_ADMIN_ID    — your personal Telegram chat ID (send /start to the bot to get it)
 *   GROQ_API_KEY         — already configured
 */

const TelegramBot = require('node-telegram-bot-api');
const cron        = require('node-cron');
const Groq        = require('groq-sdk');
const pool        = require('../config/db');

// ── Lazy singletons ──────────────────────────────────────────────────────────
let _bot  = null;
let _groq = null;

function getBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  if (!_bot) {
    _bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    attachBotHandlers(_bot);
  }
  return _bot;
}

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// ── Keyword filter — quick check before calling AI ───────────────────────────
const POKER_KEYWORDS = [
  'טורניר','פוקר','poker','tournament','באי-אין','buy-in','buy in',
  'gtd','פרס מובטח','ערימה','stack','בליינד','blind','re-entry',
  'late reg','שלב','level','מועדון','קאש','cash game',
];

function looksLikePoker(text) {
  const lower = text.toLowerCase();
  return POKER_KEYWORDS.some(k => lower.includes(k));
}

// ── Groq parser (same logic as importController) ─────────────────────────────
const PARSE_SYSTEM = `You are an expert at parsing Hebrew poker tournament announcements.
Extract structured data and return ONLY valid JSON — no markdown.
Rules:
- null for any field not found.
- date: YYYY-MM-DD. start_time: HH:MM (24h). cost/gtd/starting_stack: integer.
- is_recurring: true only if explicitly "שבועי"/"קבוע".
- confidence: 0.0–1.0.`;

async function parseWithAI(text) {
  const groq = getGroq();
  if (!groq) return null;
  try {
    const r = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PARSE_SYSTEM },
        { role: 'user', content:
          `Parse this poker announcement and return JSON:\n---\n${text.slice(0, 4000)}\n---\n` +
          `Fields: name, venue_name, venue_city, date, start_time, cost, gtd, starting_stack, ` +
          `level_duration, re_entry, late_reg_level, is_recurring, whatsapp_number, description, confidence` },
      ],
    });
    const raw = r.choices[0]?.message?.content || '{}';
    return JSON.parse(raw);
  } catch (e) {
    console.error('[Agent] Groq parse error:', e?.message);
    return null;
  }
}

// ── Save import record ────────────────────────────────────────────────────────
async function saveImport(platform, rawText, parsedData, hash = null) {
  try {
    const r = await pool.query(
      `INSERT INTO tournament_imports (source, raw_text, parsed_data, content_hash, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [platform, rawText.slice(0, 8000), JSON.stringify(parsedData || {}), hash || null]
    );
    return r.rows[0].id;
  } catch (e) {
    console.error('[Agent] saveImport error:', e?.message);
    return null;
  }
}

// ── Send Telegram notification to admin ──────────────────────────────────────
async function notifyAdmin(importId, platform, parsed, rawText) {
  const bot     = getBot();
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  if (!bot || !adminId) return;

  const conf  = Math.round((parsed?.confidence || 0) * 100);
  const emoji = conf >= 80 ? '🟢' : conf >= 50 ? '🟡' : '🔴';
  const name  = parsed?.name || '(שם לא זוהה)';
  const date  = parsed?.date ? `📅 ${parsed.date}` : '';
  const time  = parsed?.start_time ? `🕐 ${parsed.start_time}` : '';
  const cost  = parsed?.cost ? `💰 ₪${parsed.cost}` : '';
  const gtd   = parsed?.gtd ? `🏆 GTD ₪${parsed.gtd}` : '';
  const venue = parsed?.venue_name ? `📍 ${parsed.venue_name}` : '';

  const preview = rawText.slice(0, 200) + (rawText.length > 200 ? '...' : '');

  const msg =
    `📥 *פרסום חדש זוהה* — ${platform.toUpperCase()}\n\n` +
    `${emoji} ביטחון: ${conf}%\n` +
    `🎯 *${name}*\n` +
    [date, time, cost, gtd, venue].filter(Boolean).join('  ·  ') + '\n\n' +
    `_"${preview}"_\n\n` +
    `Import #${importId}`;

  await bot.sendMessage(adminId, msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ אשר טורניר', callback_data: `approve_${importId}` },
        { text: '❌ דחה',        callback_data: `reject_${importId}` },
        { text: '👁 צפה',        url: `https://www.pokerisrael.org/admin` },
      ]],
    },
  });
}

// ── Auto-approve import (creates tournament) ─────────────────────────────────
async function autoApproveImport(importId, adminUserId) {
  try {
    const imp = await pool.query('SELECT * FROM tournament_imports WHERE id=$1', [importId]);
    if (!imp.rows[0]) return { ok: false, msg: 'Import not found' };
    const row = imp.rows[0];
    const d   = row.parsed_data || {};
    if (!row.venue_id && !d.venue_id) return { ok: false, msg: 'No venue — approve manually in admin panel' };

    const startTime = (d.date && d.start_time) ? `${d.date}T${d.start_time}:00` : null;
    const tRes = await pool.query(
      `INSERT INTO tournaments
         (venue_id, name, description, cost, start_time, is_recurring, day_of_week,
          re_entry, late_reg_level, gtd, starting_stack, level_duration, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'approved',$13) RETURNING id`,
      [
        d.venue_id || row.venue_id,
        d.name || 'Imported Tournament',
        d.description || null,
        d.cost || null, startTime,
        d.is_recurring || false, d.day_of_week ?? null,
        d.re_entry || false, d.late_reg_level || null,
        d.gtd || null, d.starting_stack || null, d.level_duration || null,
        adminUserId || null,
      ]
    );
    await pool.query(
      `UPDATE tournament_imports SET status='approved', tournament_id=$1 WHERE id=$2`,
      [tRes.rows[0].id, importId]
    );
    return { ok: true, tournamentId: tRes.rows[0].id };
  } catch (e) {
    console.error('[Agent] autoApprove error:', e?.message);
    return { ok: false, msg: e?.message };
  }
}

// ── Bot button handlers ───────────────────────────────────────────────────────
function attachBotHandlers(bot) {
  // /start — show chat ID
  bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
      `👋 *PokerIsrael Agent*\n\nChat ID שלך: \`${msg.chat.id}\`\n\n` +
      `הוסף מספר זה ל-.env:\n\`TELEGRAM_ADMIN_ID=${msg.chat.id}\``,
      { parse_mode: 'Markdown' }
    );
  });

  // /status — last run info
  bot.onText(/\/status/, async (msg) => {
    if (String(msg.chat.id) !== process.env.TELEGRAM_ADMIN_ID) return;
    try {
      const cnt = await pool.query(`SELECT COUNT(*) FROM tournament_imports WHERE status='pending'`);
      const src = await pool.query(`SELECT COUNT(*) FROM agent_sources WHERE active=true`);
      await bot.sendMessage(msg.chat.id,
        `📊 *Agent Status*\n\n` +
        `🔴 ממתין לאישור: ${cnt.rows[0].count}\n` +
        `📡 מקורות פעילים: ${src.rows[0].count}`,
        { parse_mode: 'Markdown' }
      );
    } catch { await bot.sendMessage(msg.chat.id, 'שגיאה בקריאת הנתונים'); }
  });

  // /run — trigger manual scan
  bot.onText(/\/run/, async (msg) => {
    if (String(msg.chat.id) !== process.env.TELEGRAM_ADMIN_ID) return;
    await bot.sendMessage(msg.chat.id, '🔄 מריץ סריקה ידנית...');
    const result = await runDailyScan();
    await bot.sendMessage(msg.chat.id,
      `✅ סריקה הסתיימה\n\n` +
      `📨 הודעות נסרקו: ${result.scanned}\n` +
      `🎯 פרסומי פוקר שנמצאו: ${result.found}\n` +
      `💾 ייבואים חדשים: ${result.imported}`
    );
  });

  // Inline button callbacks (✅ Approve / ❌ Reject)
  bot.on('callback_query', async (query) => {
    const data    = query.data;
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (String(query.from.id) !== adminId) {
      await bot.answerCallbackQuery(query.id, { text: 'אין הרשאה' });
      return;
    }

    if (data.startsWith('approve_')) {
      const importId = parseInt(data.split('_')[1]);
      const result   = await autoApproveImport(importId);
      if (result.ok) {
        await bot.editMessageText(
          `✅ *אושר!* טורניר #${result.tournamentId} נוצר`,
          { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );
      } else {
        await bot.answerCallbackQuery(query.id, {
          text: result.msg || 'אשר ידנית בפאנל — חסר מועדון',
          show_alert: true,
        });
      }
    }

    if (data.startsWith('reject_')) {
      const importId = parseInt(data.split('_')[1]);
      await pool.query(`UPDATE tournament_imports SET status='rejected' WHERE id=$1`, [importId]);
      await bot.editMessageText(
        `❌ *נדחה* — Import #${importId}`,
        { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
      );
    }

    await bot.answerCallbackQuery(query.id);
  });
}

// ── Detect weekly tournament schedule (≥3 buy-in blocks = schedule, not reminder) ──
function detectWeeklySchedule(text) {
  return (text.match(/כניסה:/g) || []).length >= 3;
}

// ── Parse ALL tournaments from a weekly schedule text message ─────────────────
const WEEKLY_SCHEDULE_TEXT_SYSTEM = `You are parsing a Hebrew WhatsApp weekly poker tournament schedule message from an Israeli poker club.
Extract ALL individual tournaments listed and return ONLY valid JSON — no markdown, no explanation.`;

async function parseWeeklyScheduleText(text) {
  const groq = getGroq();
  if (!groq) return [];
  try {
    const r = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: WEEKLY_SCHEDULE_TEXT_SYSTEM },
        { role: 'user', content:
          `Parse this Hebrew weekly poker schedule and extract ALL tournaments.\n` +
          `For each tournament return:\n` +
          `- name: English/caps name (e.g. "Omaha Mindset", "Mystery Bounty", "The Playground")\n` +
          `- date_str: "DD.MM" format (e.g. "21.6")\n` +
          `- start_time: exact "HH:MM" 24h (e.g. "18:00", "11:00", "20:30")\n` +
          `- cost: total buy-in integer\n` +
          `- starting_stack: chip count integer (300,000→300000)\n` +
          `- re_entry: integer (X2→2, X3→3)\n` +
          `- level_count: level duration minutes integer\n\n` +
          `Return ONLY: {"tournaments":[{"name":"...","date_str":"21.6","start_time":"18:00","cost":800,"starting_stack":300000,"re_entry":2,"level_count":20}]}\n\n` +
          `Message:\n---\n${text.slice(0, 6000)}\n---`
        },
      ],
    });
    const raw   = r.choices[0]?.message?.content || '{}';
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
    const obj   = JSON.parse(clean);
    console.log(`[Agent] Parsed ${obj.tournaments?.length || 0} tournaments from weekly schedule text`);
    return obj.tournaments || [];
  } catch (e) {
    console.error('[Agent] parseWeeklyScheduleText error:', e?.message);
    return [];
  }
}

// ── Find venue by WhatsApp group name (tokenizes name, searches DB) ───────────
async function findVenueByGroupName(groupName) {
  const words = (groupName || '').toLowerCase()
    .split(/[\s\-|♣♠♥♦✨🎰]+/)
    .filter(w => w.length >= 3 && !/^(the|and|for|its|of)$/.test(w));
  for (const word of words) {
    try {
      const r = await pool.query(
        `SELECT id, name FROM venues WHERE name ILIKE $1 LIMIT 1`, [`%${word}%`]
      );
      if (r.rows[0]) return r.rows[0];
    } catch {}
  }
  return null;
}

// ── Process a full weekly schedule text message (multi-tournament) ─────────────
async function processWeeklyScheduleMessage(platform, text, groupName) {
  try {
    const venue = await findVenueByGroupName(groupName);
    if (!venue) {
      console.warn(`[Agent] No venue for group "${groupName}" — weekly schedule skipped`);
      return { imported: 0, updated: 0 };
    }
    const tournaments = await parseWeeklyScheduleText(text);
    if (!tournaments.length) return { imported: 0, updated: 0 };
    const result = await importWeeklySchedule(tournaments, venue.id);
    console.log(`[Agent] Weekly schedule "${groupName}" → ${result.imported} new, ${result.updated} updated → ${venue.name}`);
    return result;
  } catch (e) {
    console.error('[Agent] processWeeklyScheduleMessage error:', e?.message);
    return { imported: 0, updated: 0 };
  }
}

// ── Process a single message text ────────────────────────────────────────────
async function processMessage(platform, text, sourceId, hash = null) {
  if (!text || text.length < 20) return false;
  if (!looksLikePoker(text))     return false;

  // Dedup for web-scraped content
  if (hash) {
    try {
      const dup = await pool.query(
        `SELECT id FROM tournament_imports WHERE content_hash=$1 LIMIT 1`, [hash]
      );
      if (dup.rows.length > 0) return false;
    } catch {}
  }

  const parsed = await parseWithAI(text);
  if (!parsed || (parsed.confidence || 0) < 0.3) return false;

  const importId = await saveImport(platform, text, parsed, hash);
  if (!importId) return false;

  await notifyAdmin(importId, platform, parsed, text);
  return true;
}

// ── Telegram channel scan ────────────────────────────────────────────────────
async function scanTelegramSources() {
  const bot = getBot();
  if (!bot) return { scanned: 0, found: 0 };

  const sources = await pool.query(
    `SELECT * FROM agent_sources WHERE platform='telegram' AND active=true`
  );

  let scanned = 0, found = 0;

  for (const src of sources.rows) {
    try {
      // getUpdates fetches recent messages the bot received
      // For channels, the bot must be an admin member
      const updates = await bot.getUpdates({
        offset: (src.last_msg_id || 0) + 1,
        limit: 100,
        allowed_updates: ['channel_post', 'message'],
      });

      let maxId = src.last_msg_id || 0;

      for (const upd of updates) {
        const msg = upd.channel_post || upd.message;
        if (!msg) continue;

        // Only process messages from this source channel/group
        if (String(msg.chat.id) !== src.identifier &&
            msg.chat.username !== src.identifier.replace('@', '')) continue;

        const text = msg.text || msg.caption || '';
        scanned++;
        maxId = Math.max(maxId, upd.update_id);

        const ok = await processMessage('telegram', text, src.id);
        if (ok) found++;
      }

      // Update last seen message ID + timestamp
      await pool.query(
        `UPDATE agent_sources SET last_checked=NOW(), last_msg_id=$1 WHERE id=$2`,
        [maxId, src.id]
      );
    } catch (e) {
      console.error(`[Agent] Telegram scan error for ${src.name}:`, e?.message);
    }
  }

  return { scanned, found };
}

// ── WhatsApp webhook messages (stored in DB by the webhook handler) ───────────
async function scanWhatsAppPending() {
  try {
    const rows = await pool.query(
      `SELECT * FROM whatsapp_inbox WHERE processed=false ORDER BY created_at ASC LIMIT 50`
    );
    let found = 0;
    for (const row of rows.rows) {
      if (detectWeeklySchedule(row.body)) {
        const r = await processWeeklyScheduleMessage('whatsapp', row.body, row.from_num || '');
        if (r.imported > 0 || r.updated > 0) found++;
      } else {
        const ok = await processMessage('whatsapp', row.body, null);
        if (ok) found++;
      }
      await pool.query(`UPDATE whatsapp_inbox SET processed=true WHERE id=$1`, [row.id]);
    }
    return { scanned: rows.rows.length, found };
  } catch {
    return { scanned: 0, found: 0 };
  }
}

// ── Main daily scan ───────────────────────────────────────────────────────────
async function runDailyScan() {
  console.log('[Agent] 🔍 Starting daily import scan...');
  let totalScanned = 0, totalFound = 0;

  try {
    const tg = await scanTelegramSources();
    totalScanned += tg.scanned;
    totalFound   += tg.found;
    console.log(`[Agent] Telegram: scanned=${tg.scanned} found=${tg.found}`);
  } catch (e) {
    console.error('[Agent] Telegram scan failed:', e?.message);
  }

  try {
    const wa = await scanWhatsAppPending();
    totalScanned += wa.scanned;
    totalFound   += wa.found;
    console.log(`[Agent] WhatsApp: scanned=${wa.scanned} found=${wa.found}`);
  } catch (e) {
    console.error('[Agent] WhatsApp scan failed:', e?.message);
  }

  try {
    const { scanWebSources } = require('./webScraper');
    const ws = await scanWebSources();
    totalScanned += ws.scanned;
    totalFound   += ws.found;
    console.log(`[Agent] Web: scanned=${ws.scanned} found=${ws.found}`);
  } catch (e) {
    console.error('[Agent] Web scan failed:', e?.message);
  }

  console.log(`[Agent] ✅ Scan done. scanned=${totalScanned} imported=${totalFound}`);
  return { scanned: totalScanned, found: totalFound, imported: totalFound };
}

// ── Start everything ──────────────────────────────────────────────────────────
function startAgent() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('[Agent] ⚠️  TELEGRAM_BOT_TOKEN not set — agent disabled');
    return;
  }

  // Init bot (starts polling)
  getBot();
  console.log('[Agent] 🤖 Telegram bot started');

  // Daily cron: 08:00 Israel time
  const schedule = process.env.AGENT_CRON || '0 8 * * *';
  cron.schedule(schedule, () => {
    runDailyScan().catch(e => console.error('[Agent] cron error:', e?.message));
  }, { timezone: 'Asia/Jerusalem' });
  console.log(`[Agent] ⏰ Daily scan scheduled (08:00 IL)`);

  // Evening crons: 20:00, 21:00, 22:00 IL — catch SUITS weekly schedule messages
  cron.schedule('0 20,21,22 * * *', () => {
    scanWhatsAppPending().catch(e => console.error('[Agent] evening scan error:', e?.message));
  }, { timezone: 'Asia/Jerusalem' });
  console.log(`[Agent] ⏰ Evening WhatsApp scans scheduled (20:00, 21:00, 22:00 IL)`);
}

// ── Weekly Schedule Image Parser (Groq Vision) ────────────────────────────────

const SCHEDULE_VISION_PROMPT = `You are parsing a weekly poker tournament schedule image from an Israeli poker club.
Extract ALL tournaments shown in the image and return JSON.

For each tournament extract:
- name: tournament name exactly as shown (e.g. "Omaha Mindset", "Mystery Bounty", "The Playground")
- day_hebrew: Hebrew day shown (ראשון/שני/שלישי/רביעי/חמישי/שישי/שבת)
- date_str: date string as shown in image (e.g. "21.6", "22.6", "25.6") — day.month format
- start_time: exact start time as "HH:MM" if visible (e.g. "18:00", "11:00", "20:30"); null if not shown
- time_hint: fallback hint when exact time is unknown — "בוקר" for morning, "ערב" for evening, or null
- cost: total buy-in as integer (e.g. 800, 600, 1000)
- starting_stack: chip stack as integer (300k→300000, 75k→75000, 100k→100000)
- re_entry: re-entry count as integer (X1→1, X2→2, X3→3)
- level_count: levels count as integer (18, 20, 25)

Return ONLY valid JSON, no markdown, no explanation:
{"tournaments":[{"name":"...","day_hebrew":"...","date_str":"21.6","start_time":null,"time_hint":"ערב","cost":800,"starting_stack":300000,"re_entry":2,"level_count":20}]}`;

async function parseScheduleImage(imageBase64, mimeType = 'image/jpeg', captionText = '') {
  const groq = getGroq();
  if (!groq) throw new Error('GROQ_API_KEY not configured');

  const VISION_MODELS = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.2-90b-vision-preview',
    'llama-3.2-11b-vision-preview',
  ];

  // If caption text is provided (e.g. full Hebrew schedule), use it to get exact times
  const prompt = captionText
    ? `${SCHEDULE_VISION_PROMPT}\n\nAdditional context from the accompanying message text — use this for exact start times and any details not visible in the image:\n${captionText.slice(0, 2000)}`
    : SCHEDULE_VISION_PROMPT;

  let lastErr;
  for (const model of VISION_MODELS) {
    try {
      const r = await groq.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
      });
      const raw   = r.choices[0]?.message?.content || '{}';
      const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
      const obj   = JSON.parse(clean);
      console.log(`[Agent] Vision model ${model} parsed ${obj.tournaments?.length || 0} tournaments`);
      return obj.tournaments || [];
    } catch (e) {
      lastErr = e;
      if (e?.status === 404 || e?.message?.includes('model') || e?.message?.includes('vision')) {
        console.warn(`[Agent] Vision model ${model} unavailable, trying next...`);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('No vision model available');
}

function parseDateStr(dateStr, year) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!m) return null;
  return `${year}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
}

function guessStartTime(timeHint) {
  if (!timeHint) return '20:00';
  const h = String(timeHint).toLowerCase();
  const explicit = h.match(/(\d{1,2}):(\d{2})/);
  if (explicit) return `${explicit[1].padStart(2,'0')}:${explicit[2]}`;
  if (h.includes('בוקר') || h.includes('morning') || h.includes('midday') || h.includes('mid')) return '13:00';
  return '20:00';
}

async function importWeeklySchedule(rawTournaments, venueId) {
  let imported = 0, updated = 0;
  const year = new Date().getFullYear();

  for (const t of rawTournaments) {
    try {
      const date       = parseDateStr(t.date_str, year);
      const startTime  = t.start_time || guessStartTime(t.time_hint);
      const startDt    = date ? `${date}T${startTime}:00` : null;
      const firstName  = (t.name || '').split(' ')[0];

      // Check if a tournament for this venue+name+date already exists
      const existing = await pool.query(
        `SELECT id FROM tournaments
         WHERE venue_id=$1 AND name ILIKE $2 AND DATE(start_time)=$3 LIMIT 1`,
        [venueId, `%${firstName}%`, date]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE tournaments
           SET cost=$1, starting_stack=$2, re_entry=$3, level_duration=$4, name=$5, start_time=$6
           WHERE id=$7`,
          [t.cost||null, t.starting_stack||null, t.re_entry||null, t.level_count||null, t.name, startDt, existing.rows[0].id]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO tournaments
             (venue_id, name, cost, start_time, starting_stack, re_entry, level_duration, is_recurring, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,false,'approved')`,
          [venueId, t.name||'טורניר', t.cost||null, startDt, t.starting_stack||null, t.re_entry||null, t.level_count||null]
        );
        imported++;
      }
    } catch (e) {
      console.error('[Agent] importWeeklySchedule row error:', e?.message, JSON.stringify(t));
    }
  }
  return { imported, updated };
}

module.exports = { startAgent, runDailyScan, processMessage, parseWithAI, parseScheduleImage, importWeeklySchedule, detectWeeklySchedule, parseWeeklyScheduleText, processWeeklyScheduleMessage, findVenueByGroupName };
