const express = require('express');
const ctrl = require('../controllers/abController');

const router = express.Router();

// ציבורי — נשלח מדפדפן של מבקר לא מחובר
router.post('/event', ctrl.track);

module.exports = router;
