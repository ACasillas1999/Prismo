'use strict';
const express = require('express');
const router = express.Router();
const reportsHandler = require('../handlers/reports');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(authenticate);

// Solo admin y jefes pueden ver reportes
router.get('/dashboard', requireRole('admin', 'department_head'), reportsHandler.getDashboard);
router.get('/agents-list', requireRole('admin', 'department_head'), reportsHandler.getAgentsList);
router.get('/agent-history', requireRole('admin', 'department_head', 'agent'), reportsHandler.getAgentHistory);

module.exports = router;
