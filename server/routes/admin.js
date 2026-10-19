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
router.patch('/tournaments/:id/canary', ctrl.toggleCanary);
router.get('/security-events', ctrl.getSecurityEvents);
// סנכרון מיידי של פרסומי Drive (Ludus) — במקום לחכות לשעה הבאה בתזמון
router.post('/drive-promos/sync', async (req, res) => {
  try { res.json(await require('../services/drivePromos').syncDrivePromos()); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get('/watermark/:code', ctrl.lookupWatermark);
router.get('/blocked-ips', ctrl.getBlockedIps);
router.post('/blocked-ips', ctrl.blockIp);
router.delete('/blocked-ips/:ip', ctrl.unblockIp);
router.get('/venues/all', ctrl.getAllVenues);
router.get('/tournaments', ctrl.getAllTournaments);
router.get('/users', ctrl.getAllUsers);
router.patch('/users/:id/toggle', ctrl.toggleUser);
router.patch('/users/:id/unlock', ctrl.unlockUser);
router.patch('/users/:id/hand-logger-access', ctrl.toggleHandLoggerAccess);
router.patch('/users/:id/hand-narration-pilot-access', ctrl.toggleHandNarrationPilotAccess);
router.get('/change-logs', ctrl.getChangeLogs);

// ניהול מיקומים — כתובת -> קואורדינטות, הבסיס ל"מצא טורניר קרוב אליי"
router.get('/locations', ctrl.getLocations);
router.post('/locations', ctrl.createLocation);
router.post('/locations/resolve-link', ctrl.resolveMapsLink);
router.put('/locations/:id', ctrl.updateLocation);
router.delete('/locations/:id', ctrl.deleteLocation);

// תוצאות ניסויי A/B
router.get('/ab-results', require('../controllers/abController').results);

module.exports = router;
