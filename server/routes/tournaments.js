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
router.get('/template', authenticate, requireRole('venue_owner', 'admin'), ctrl.downloadTemplate);

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

router.post('/:id/skip-next', authenticate, requireRole('venue_owner', 'admin'), ctrl.skipNextOccurrence);
router.post('/:id/clear-skips', authenticate, requireRole('venue_owner', 'admin'), ctrl.clearSkips);

const waValidation = body('whatsapp_number')
  .trim().notEmpty().withMessage('מספר וואצאפ הוא שדה חובה')
  .matches(/^[\d\s\-+()]{7,20}$/).withMessage('מספר וואצאפ לא תקין');

// כתובת/עיר חובה רק למועדון פיזי
const addressValidation = body('address')
  .if(body('venue_type').not().equals('online'))
  .trim().notEmpty().withMessage('כתובת היא שדה חובה');
const cityValidation = body('city')
  .if(body('venue_type').not().equals('online'))
  .trim().notEmpty().withMessage('עיר היא שדה חובה');

router.put('/venues/:id', authenticate, requireRole('venue_owner', 'admin'), [
  body('name').trim().notEmpty().withMessage('שם המועדון הוא שדה חובה'),
  addressValidation,
  cityValidation,
  waValidation,
], ctrl.updateVenue);

router.post('/venues', authenticate, requireRole('venue_owner', 'admin'), [
  body('name').trim().notEmpty().withMessage('שם המקום הוא שדה חובה'),
  addressValidation,
  cityValidation,
  waValidation,
], ctrl.createVenue);

// ── ייבוא מתמונה עם AI ──────────────────────────────────────────
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('פורמט תמונה לא נתמך'));
  },
});
router.post('/import-image', authenticate, requireRole('venue_owner', 'admin'), imageUpload.single('image'), ctrl.importFromImage);

// ── לוגואי אירועים (event brands) ───────────────────────────────
router.get('/venues/:id/brands',    authenticate, requireRole('venue_owner', 'admin'), ctrl.getBrands);
router.post('/venues/:id/brands',   authenticate, requireRole('venue_owner', 'admin'), ctrl.createBrand);
router.delete('/brands/:id',        authenticate, requireRole('venue_owner', 'admin'), ctrl.deleteBrand);

// ── קבלת brands לתצוגה ציבורית (לטורנירים) ──────────────────────
router.get('/all-brands', ctrl.getAllBrandsPublic);

module.exports = router;
