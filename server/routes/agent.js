const express = require('express');
const pool    = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { requireAgentSecret } = require('../middleware/agentAuth');
const { runDailyScan, processMessage, detectWeeklySchedule, processWeeklyScheduleMessage, findVenueByGroupName } = require('../services/importAgent');
const wa = require('../services/whatsappListener');

const router = express.Router();

// ── WhatsApp Forwarder heartbeat (called by local whatsapp-forwarder script) ──
let forwarderLastSeen = null; // ms timestamp
let forwarderInfo     = null; // { pushname, number, groups }

// POST /api/agent/whatsapp/forwarder-heartbeat — shared-secret auth, called by local script
router.post('/whatsapp/forwarder-heartbeat', requireAgentSecret, (req, res) => {
  forwarderLastSeen = Date.now();
  forwarderInfo     = req.body || null;
  res.json({ ok: true });
});

// ── WhatsApp connection management (admin only) ───────────────────────────────

// GET /api/agent/whatsapp/status — connection state + QR code
router.get('/whatsapp/status', authenticate, requireRole('admin'), (req, res) => {
  const base = wa.getStatus();
  const forwarderAlive = forwarderLastSeen && (Date.now() - forwarderLastSeen < 90_000);
  res.json({
    ...base,
    forwarder: forwarderAlive
      ? { status: 'ready', info: forwarderInfo, lastSeen: forwarderLastSeen }
      : null,
  });
});

// POST /api/agent/whatsapp/connect — start the client (triggers QR)
router.post('/whatsapp/connect', authenticate, requireRole('admin'), (req, res) => {
  process.env.WHATSAPP_ENABLED = 'true';
  wa.startWhatsApp();
  res.json({ message: 'WhatsApp client starting — fetch /status for QR' });
});

// GET /api/agent/whatsapp/groups — list groups the account is in
router.get('/whatsapp/groups', authenticate, requireRole('admin'), async (req, res) => {
  const groups = await wa.listGroups();
  res.json(groups);
});

// POST /api/agent/whatsapp/logout
router.post('/whatsapp/logout', authenticate, requireRole('admin'), async (req, res) => {
  await wa.logout();
  res.json({ message: 'Logged out' });
});

// ── Admin-only routes ─────────────────────────────────────────────────────────

// GET /api/agent/sources — list all monitored sources
router.get('/sources', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM agent_sources ORDER BY platform, name`
    );
    res.json(r.rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/agent/sources — add a new source
router.post('/sources', authenticate, requireRole('admin'), async (req, res) => {
  const { platform, name, identifier } = req.body;
  if (!platform || !name || !identifier)
    return res.status(400).json({ message: 'platform, name, identifier required' });

  try {
    const r = await pool.query(
      `INSERT INTO agent_sources (platform, name, identifier, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [platform, name, identifier, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Source already exists' });
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/agent/sources/:id/toggle — enable/disable
router.patch('/sources/:id/toggle', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE agent_sources SET active = NOT active WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// DELETE /api/agent/sources/:id
router.delete('/sources/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM agent_sources WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/agent/run — trigger manual scan
router.post('/run', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await runDailyScan();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e?.message });
  }
});

// ── WhatsApp webhook (no auth — called by external services) ──────────────────
// Ensure the whatsapp_inbox table exists
async function ensureWhatsAppTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_inbox (
        id         SERIAL PRIMARY KEY,
        from_num   VARCHAR(50),
        body       TEXT,
        processed  BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch {}
}
ensureWhatsAppTable();

// Auto-register the known fully-automatic WhatsApp groups as monitored sources
const AUTO_AGENT_SOURCES = [
  { name: 'SUITS WhatsApp', identifier: "SUITS - The Mind's Playground ♣️" },
  { name: 'HOUSE WhatsApp',  identifier: 'האוס אירועים House ♦️' },
];
async function ensureAgentSources() {
  for (const src of AUTO_AGENT_SOURCES) {
    try {
      await pool.query(`
        INSERT INTO agent_sources (platform, name, identifier, active)
        VALUES ('whatsapp', $1, $2, true)
        ON CONFLICT DO NOTHING
      `, [src.name, src.identifier]);
    } catch {}
  }
}
ensureAgentSources();

// POST /api/agent/import-schedule — accept pre-parsed tournament list (shared-secret auth, internal use)
router.post('/import-schedule', requireAgentSecret, async (req, res) => {
  try {
    const { tournaments, venue_name = 'suits' } = req.body;
    if (!Array.isArray(tournaments) || !tournaments.length)
      return res.status(400).json({ error: 'tournaments array required' });

    const vRes = await pool.query(
      `SELECT id, name FROM venues WHERE name ILIKE $1 LIMIT 1`, [`%${venue_name}%`]
    );
    if (!vRes.rows[0]) return res.status(404).json({ error: `venue "${venue_name}" not found` });

    const { importWeeklySchedule } = require('../services/importAgent');
    const { imported, updated, skipped } = await importWeeklySchedule(tournaments, vRes.rows[0].id);
    console.log(`[Agent] import-schedule: ${imported} new, ${updated} updated, ${skipped} skipped (manually edited) → ${vRes.rows[0].name}`);
    res.json({ imported, updated, skipped, venue: vRes.rows[0].name });
  } catch (e) {
    console.error('[Agent] import-schedule error:', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/agent/whatsapp-image — called by local forwarder with base64 image
router.post('/whatsapp-image', requireAgentSecret, async (req, res) => {
  try {
    const { from, imageBase64, mimeType = 'image/jpeg', caption } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'no image data' });

    const kb = Math.round(imageBase64.length * 0.75 / 1024);
    console.log(`[Agent] 🖼️ Image from "${from}" (${kb}KB)${caption ? ` — "${caption.slice(0,40)}"` : ''}`);

    const { parseScheduleImage, importWeeklySchedule } = require('../services/importAgent');

    // Pass caption text so Groq can extract exact times (image often omits them)
    const tournaments = await parseScheduleImage(imageBase64, mimeType, caption || '');
    if (!tournaments?.length) {
      console.log('[Agent] No tournaments parsed from image');
      return res.json({ imported: 0, updated: 0, message: 'no tournaments found' });
    }

    // Find venue by WhatsApp group name — no cross-venue fallback: an unmatched group must
    // never silently land in another club's venue (this used to default to SUITS).
    const venue = from ? await findVenueByGroupName(from) : null;
    if (!venue) {
      console.warn('[Agent] Venue not found for image from:', from);
      return res.json({ imported: 0, updated: 0, message: 'venue not found' });
    }

    const { imported, updated, skipped } = await importWeeklySchedule(tournaments, venue.id);
    console.log(`[Agent] ✅ Weekly schedule: ${imported} new, ${updated} updated, ${skipped} skipped (manually edited) → ${venue.name}`);
    res.json({ imported, updated, skipped, total: tournaments.length, venue: venue.name });
  } catch (e) {
    console.error('[Agent] whatsapp-image error:', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/agent/jokerclub-sync — called by local jokerclub-scraper script (headless
// browser scrape of jokerclub.co.il/reg, which has no public API) with parsed tournaments
router.post('/jokerclub-sync', requireAgentSecret, async (req, res) => {
  try {
    const { tournaments } = req.body;
    if (!Array.isArray(tournaments)) return res.status(400).json({ error: 'tournaments array required' });

    const { syncJokerClub } = require('../services/jokerClubSync');
    const result = await syncJokerClub(tournaments);
    res.json(result);
  } catch (e) {
    console.error('[Agent] jokerclub-sync error:', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/agent/whatsapp-webhook — shared-secret auth (X-Agent-Secret header).
// NOTE: if this is ever pointed at a real Twilio/CallMeBot webhook (no evidence one is
// configured today — the live path is the whatsapp-forwarder script below), that provider
// needs to be configured to send the header too, or this needs provider-specific signature
// verification instead.
router.post('/whatsapp-webhook', requireAgentSecret, async (req, res) => {
  try {
    // Twilio format: req.body.Body + req.body.From
    // CallMeBot / generic: req.body.text or req.body.message
    const body = req.body?.Body || req.body?.text || req.body?.message || '';
    const from = req.body?.From || req.body?.from || 'unknown';

    if (!body || body.length < 10) return res.status(200).send('OK');

    await pool.query(
      `INSERT INTO whatsapp_inbox (from_num, body) VALUES ($1, $2)`,
      [from, body.slice(0, 8000)]
    );

    // Detect weekly schedule (≥3 buy-in blocks) vs single-tournament message
    if (detectWeeklySchedule(body)) {
      console.log(`[Agent] Weekly schedule detected from "${from}" — parsing all tournaments`);
      processWeeklyScheduleMessage('whatsapp', body, from).catch(() => {});
    } else {
      processMessage('whatsapp', body, null).catch(() => {});
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('[Agent] WhatsApp webhook error:', e?.message);
    res.status(200).send('OK'); // Always 200 to prevent webhook retries
  }
});

module.exports = router;
