const express = require('express');
const router = express.Router();
const workersController = require('../controllers/workers.controller.cjs');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware.cjs');

router.get('/workers', authenticateToken, workersController.getWorkers);
router.get('/workers/calendar', authenticateToken, workersController.getWorkerCalendar);
router.post('/workers/:no/rules', authenticateToken, requireRole(['admin', 'editor']), workersController.addWorkerRule);
router.delete('/rules/:id', authenticateToken, requireRole(['admin', 'editor']), workersController.deleteRule);
router.put('/workers/:no/baja', authenticateToken, requireRole(['admin', 'editor']), workersController.setWorkerBaja);

module.exports = router;
