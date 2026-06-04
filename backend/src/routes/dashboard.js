'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const handler = require('../handlers/dashboard');

const router = Router();

router.use(authenticate);

router.get('/stats', handler.getStats);

module.exports = router;
