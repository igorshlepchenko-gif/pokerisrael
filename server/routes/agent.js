const express = require('express');
const pool    = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { runDailyScan, processMessage } = require('../services/importAgent');
const wa = require('../services/whatsappListener');

const router = express.Router();

// ── WhatsApp connection management (admin only) ───────────────────────────────

// GET /api/agent/whatsapp/status — connection state + QR code
router.get('/whatsapp/status', authenticate, requireRole('admin'), (req, res) => {
  res.json(wa.getStatus());
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

// POST /api/agent/whatsapp-webhook
// Compatible with Twilio, CallMeBot, or any service that POSTs body text
router.post('/whatsapp-webhook', async (req, res) => {
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

    // Process immediately (don't wait for daily cron)
    processMessage('whatsapp', body, null).catch(() => {});

    res.status(200).send('OK');
  } catch (e) {
    console.error('[Agent] WhatsApp webhook error:', e?.message);
    res.status(200).send('OK'); // Always 200 to prevent webhook retries
  }
});

module.exports = router;
