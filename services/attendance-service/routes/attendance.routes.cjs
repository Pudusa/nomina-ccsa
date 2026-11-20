const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const attendanceController = require('../controllers/attendance.controller.cjs');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware.cjs');

router.post('/upload', authenticateToken, requireRole(['admin']), upload.single('file'), attendanceController.uploadAttendance);
router.post('/attendance/zk-sync', authenticateToken, requireRole(['admin']), attendanceController.syncZkDevices);
router.get('/attendance/zk/config', authenticateToken, requireRole(['admin']), attendanceController.getZkConfig);
router.put('/attendance/zk/config', authenticateToken, requireRole(['admin']), attendanceController.saveZkConfig);
router.get('/attendance/zk/history', authenticateToken, requireRole(['admin']), attendanceController.getZkHistory);
router.get('/dates', authenticateToken, attendanceController.getDates);
router.get('/attendance', authenticateToken, attendanceController.getAttendanceByDate);
router.get('/attendance/range', authenticateToken, attendanceController.getAttendanceByRange);
router.get('/incidents', authenticateToken, attendanceController.getIncidents);
router.get('/attendance/incidents', authenticateToken, attendanceController.getIncidents);
router.put('/incidents/justify', authenticateToken, requireRole(['admin', 'editor']), attendanceController.saveIncidentJustification);
router.put('/attendance/incidents/justify', authenticateToken, requireRole(['admin', 'editor']), attendanceController.saveIncidentJustification);
router.post('/incidents/justify', authenticateToken, requireRole(['admin', 'editor']), attendanceController.saveIncidentJustification);
router.post('/attendance/incidents/justify', authenticateToken, requireRole(['admin', 'editor']), attendanceController.saveIncidentJustification);

module.exports = router;
