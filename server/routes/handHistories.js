const express = require('express');
const ctrl = require('../controllers/handHistoryController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, ctrl.createHand);
router.get('/', authenticate, ctrl.getUserHands);
router.delete('/:id', authenticate, ctrl.deleteHand);

module.exports = router;
