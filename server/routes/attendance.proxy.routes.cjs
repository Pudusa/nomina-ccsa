const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const { authenticateToken } = require('../middleware/auth.middleware.cjs');

router.use(authenticateToken);

const ATTENDANCE_SERVICE_URL = process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3003';
const INTERNAL_SECRET = process.env.INTERNAL_GATEWAY_SECRET || 'nomina_ccsa_internal_hmac_secret_2026';

const proxyHandler = async (req, res, next) => {
  try {
    const targetUrl = `${ATTENDANCE_SERVICE_URL}${req.originalUrl}`;
    
    const userId = req.user?.id || req.user?.no || 'system';
    const userRole = req.user?.role || 'user';

    const signaturePayload = `${userId}:${userRole}`;
    const hmacSignature = crypto
      .createHmac('sha256', INTERNAL_SECRET)
      .update(signaturePayload)
      .digest('hex');

    const headers = {
      'x-user-id': String(userId),
      'x-user-roles': String(userRole),
      'x-gateway-signature': hmacSignature,
      ...(req.headers['authorization'] ? { 'authorization': req.headers['authorization'] } : {}),
      ...(req.headers['accept'] ? { 'accept': req.headers['accept'] } : {})
    };

    const fetchOptions = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(5000)
    };

    const isUpload = req.originalUrl.includes('/upload');
    if (isUpload && req.file) {
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append('file', blob, req.file.originalname);
      fetchOptions.body = formData;
    } else {
      headers['content-type'] = 'application/json';
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[API Gateway Proxy Error] Attendance microservice unreachable:', err.message);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'El microservicio de asistencia (attendance-service) no se encuentra disponible.',
      details: err.message
    });
  }
};

router.all('/upload', upload.single('file'), proxyHandler);
router.all('/attendance/upload', upload.single('file'), proxyHandler);
router.all('/dates', proxyHandler);
router.all('/attendance/dates', proxyHandler);
router.all('/attendance', proxyHandler);
router.all('/range', proxyHandler);
router.all('/attendance/range', proxyHandler);
router.all('/incidents', proxyHandler);
router.all('/attendance/incidents', proxyHandler);

module.exports = router;
