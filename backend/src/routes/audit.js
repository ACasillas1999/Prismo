'use strict';
const express = require('express');
const router = express.Router();
const auditHandler = require('../handlers/audit');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', auditHandler.getLogs);

module.exports = router;
