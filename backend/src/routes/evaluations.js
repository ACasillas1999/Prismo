'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const handler = require('../handlers/evaluations');
const upload = require('../middleware/upload');

const router = Router();

router.use(authenticate);

// Agent's own evaluations
router.get('/my', handler.myEvaluations);

// List & detail
router.get('/',    requireRole('admin', 'department_head'), handler.list);
router.get('/bulk-details', requireRole('admin', 'department_head'), handler.bulkDetails);
router.get('/:id', handler.getById);
router.delete('/:id', requireRole('admin', 'department_head'), handler.remove);

// Create
router.post('/',     requireRole('admin', 'department_head'), handler.create);
router.post('/bulk', requireRole('admin', 'department_head'), handler.bulkCreate);

// Agent actions
router.patch('/:id/agent-scores', requireRole('agent', 'admin', 'department_head'), handler.updateAgentScores);
router.patch('/:id/submit',       requireRole('agent'), handler.submit);
router.post('/:id/scores/:criterion_id/evidence', requireRole('agent', 'admin', 'department_head'), upload.single('evidence'), handler.uploadEvidence);
router.delete('/evidence/:evidence_id', requireRole('agent', 'admin', 'department_head'), handler.deleteEvidence);

// Evaluator actions
router.patch('/:id/evaluator-scores', requireRole('admin', 'department_head'), handler.updateEvaluatorScores);
router.patch('/:id/complete',         requireRole('admin', 'department_head'), handler.complete);

module.exports = router;
