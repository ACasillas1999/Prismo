'use strict';
const express = require('express');
const router = express.Router();
const reportsHandler = require('../handlers/reports');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(authenticate);

// Solo admin y jefes pueden ver reportes
router.get('/dashboard', requireRole('admin', 'department_head'), reportsHandler.getDashboard);

module.exports = router;
