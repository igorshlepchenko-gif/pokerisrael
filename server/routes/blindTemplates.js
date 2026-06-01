const express = require('express');
const ctrl = require('../controllers/blindTemplateController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// כל הנתיבים דורשים התחברות + תפקיד venue_owner/admin
router.use(authenticate, requireRole('venue_owner', 'admin'));

router.get('/',      ctrl.getTemplates);
router.post('/',     ctrl.createTemplate);
router.delete('/:id', ctrl.deleteTemplate);

module.exports = router;
