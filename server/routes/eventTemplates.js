const express = require('express');
const ctrl = require('../controllers/eventTemplateController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('venue_owner', 'admin'));

router.get('/',       ctrl.getTemplates);
router.post('/',      ctrl.createTemplate);
router.delete('/:id', ctrl.deleteTemplate);

module.exports = router;
