const express = require('express');
const ctrl    = require('../controllers/importController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/imports/parse  — parse raw text (admin only)
router.post('/parse', authenticate, requireRole('admin'), ctrl.parseText);

// POST /api/imports        — save pending import (admin only)
router.post('/',       authenticate, requireRole('admin'), ctrl.createImport);

// GET  /api/imports        — list pending imports (admin only)
router.get('/',        authenticate, requireRole('admin'), ctrl.listImports);

// PATCH /api/imports/:id/approve
router.patch('/:id/approve', authenticate, requireRole('admin'), ctrl.approveImport);

// PATCH /api/imports/:id/reject
router.patch('/:id/reject',  authenticate, requireRole('admin'), ctrl.rejectImport);

module.exports = router;
