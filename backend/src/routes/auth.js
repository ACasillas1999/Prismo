'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { login, me } = require('../handlers/auth');

const router = Router();

// POST /api/auth/login — No requiere autenticación
router.post('/login', login);

// GET /api/auth/me — Requiere JWT
router.get('/me', authenticate, me);

module.exports = router;
