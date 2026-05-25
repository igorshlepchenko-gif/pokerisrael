const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const ctrl = require('../controllers/tournamentController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// multer עבור העלאת קבצי Excel/CSV — שמירה בזיכרון בלבד
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('פורמט קובץ לא נתמך — השתמש ב-xlsx או csv'));
  },
});

router.get('/', ctrl.getAll);
router.get('/public-venues', ctrl.getPublicVenues);

router.get('/my', authenticate, requireRole('venue_owner', 'admin'), ctrl.getMyTournaments);

router.post('/', authenticate, requireRole('venue_owner', 'admin'), [
  body('venue_id').isInt().withMessage('מקום לא תקין'),
  body('name').trim().notEmpty().withMessage('שם הטורניר הוא שדה חובה'),
  body('cost').isFloat({ min: 0 }).withMessage('עלות לא תקינה'),
  body('start_time').isISO8601().withMessage('שעת התחלה לא תקינה'),
], ctrl.create);

router.get('/venues', authenticate, requireRole('venue_owner', 'admin'), ctrl.getVenuesByOwner);

router.post('/bulk', authenticate, requireRole('venue_owner', 'admin'),
  bulkUpload.single('file'), ctrl.bulkCreate);

router.put('/:id', authenticate, requireRole('venue_owner', 'admin'), [
  body('name').trim().notEmpty().withMessage('שם הטורניר הוא שדה חובה'),
  body('cost').isFloat({ min: 0 }).withMessage('עלות לא תקינה'),
  body('start_time').isISO8601().withMessage('שעת התחלה לא תקינה'),
], ctrl.updateTournament);

router.post('/venues', authenticate, requireRole('venue_owner', 'admin'), [
  body('name').trim().notEmpty().withMessage('שם המקום הוא שדה חובה'),
  body('address').trim().notEmpty().withMessage('כתובת היא שדה חובה'),
  body('city').trim().notEmpty().withMessage('עיר היא שדה חובה'),
  body('whatsapp_number').trim().notEmpty().withMessage('מספר וואצאפ הוא שדה חובה'),
], ctrl.createVenue);

module.exports = router;
