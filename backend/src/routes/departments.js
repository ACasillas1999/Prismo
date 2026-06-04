'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const handler = require('../handlers/departments');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/',    handler.list);
router.get('/:id', handler.getById);
router.post('/',   requireRole('admin'), handler.create);
router.put('/:id', requireRole('admin'), handler.update);
router.delete('/:id', requireRole('admin'), handler.remove);

module.exports = router;
