'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const handler = require('../handlers/users');

const router = Router();

router.use(authenticate);

router.get('/',    requireRole('admin', 'department_head'), handler.list);
router.get('/:id', handler.getById);
router.post('/',   requireRole('admin'), handler.create);
router.put('/:id', requireRole('admin'), handler.update);
router.delete('/:id', requireRole('admin'), handler.remove);

module.exports = router;
