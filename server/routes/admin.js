const express = require('express');
const ctrl = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/pending', ctrl.getPending);
router.patch('/venues/:id/approve', ctrl.approveVenue);
router.delete('/venues/:id', ctrl.rejectVenue);
router.patch('/tournaments/:id/approve', ctrl.approveTournament);
router.patch('/tournaments/:id/reject', ctrl.rejectTournament);
router.patch('/tournaments/:id/boost', ctrl.boostTournament);
router.get('/venues/all', ctrl.getAllVenues);
router.get('/tournaments', ctrl.getAllTournaments);
router.get('/users', ctrl.getAllUsers);
router.patch('/users/:id/toggle', ctrl.toggleUser);
router.patch('/users/:id/unlock', ctrl.unlockUser);
router.patch('/users/:id/hand-logger-access', ctrl.toggleHandLoggerAccess);
router.get('/change-logs', ctrl.getChangeLogs);

// temporary one-time fix — remove after use
const pool = require('../config/db');
router.post('/one-time/fix-suits-owner', async (req, res) => {
  try {
    // inspect venues columns
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='venues' ORDER BY ordinal_position");
    const colNames = cols.rows.map(r => r.column_name);

    const adminRes = await pool.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
    const admin = adminRes.rows[0];
    if (!admin) return res.json({ error: 'admin not found', cols: colNames });

    const suitsRes = await pool.query("SELECT id, name FROM venues WHERE name ILIKE '%suits%' LIMIT 1");
    const suits = suitsRes.rows[0];
    if (!suits) return res.json({ error: 'suits venue not found', cols: colNames });

    await pool.query("UPDATE users SET phone=$1 WHERE id=$2", ['0545861119', admin.id]);

    // find the owner column
    const ownerCol = colNames.find(c => c.includes('user') || c.includes('owner') || c.includes('created'));
    if (ownerCol) {
      await pool.query(`UPDATE venues SET ${ownerCol}=$1 WHERE id=$2`, [admin.id, suits.id]);
    }

    res.json({ ok: true, adminId: admin.id, suitsId: suits.id, ownerCol, cols: colNames });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
