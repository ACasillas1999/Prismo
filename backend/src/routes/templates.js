'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const handler = require('../handlers/templates');

const router = Router();

router.use(authenticate);

router.get('/',    handler.list);
router.get('/:id', handler.getById);
router.post('/',   requireRole('admin', 'department_head'), handler.create);
router.put('/:id', requireRole('admin', 'department_head'), handler.update);
router.delete('/:id', requireRole('admin', 'department_head'), handler.remove);

module.exports = router;
