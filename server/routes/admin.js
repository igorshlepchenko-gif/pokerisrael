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

module.exports = router;
