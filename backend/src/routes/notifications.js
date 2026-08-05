'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const handler = require('../handlers/notifications');

const router = Router();
router.use(authenticate);

router.get('/', handler.list);
router.patch('/read-all', handler.markAllAsRead);
router.patch('/:id/read', handler.markAsRead);

module.exports = router;
