const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller.cjs');
const { authenticateToken } = require('../middleware/auth.middleware.cjs');

router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);

module.exports = router;
