const express = require('express');
const router = express.Router();
const shiftsController = require('../controllers/shifts.controller.cjs');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware.cjs');

router.get('/shift-templates', authenticateToken, shiftsController.getShiftTemplates);
router.post('/shift-templates', authenticateToken, requireRole(['admin', 'editor']), shiftsController.saveShiftTemplate);
router.delete('/shift-templates/:name', authenticateToken, requireRole(['admin', 'editor']), shiftsController.deleteShiftTemplate);

module.exports = router;
