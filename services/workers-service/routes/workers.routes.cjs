const express = require('express');
const router = express.Router();
const workersController = require('../controllers/workers.controller.cjs');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware.cjs');

router.get('/workers', authenticateToken, workersController.getWorkers);
router.get('/workers/stats', authenticateToken, workersController.getWorkersStats);
router.get('/workers/incidents', authenticateToken, workersController.getWorkersIncidents);
router.get('/workers/calendar', authenticateToken, workersController.getWorkerCalendar);
router.post('/workers/:no/rules', authenticateToken, requireRole(['admin']), workersController.addWorkerRule);
router.delete('/rules/:id', authenticateToken, requireRole(['admin']), workersController.deleteRule);

module.exports = router;
