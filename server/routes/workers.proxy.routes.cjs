const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware.cjs');

router.use(authenticateToken);

const WORKERS_SERVICE_URL = process.env.WORKERS_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_GATEWAY_SECRET || 'nomina_ccsa_internal_hmac_secret_2026';

const proxyHandler = async (req, res, next) => {
  try {
    const targetUrl = `${WORKERS_SERVICE_URL}${req.originalUrl}`;
    
    // Extract user info from authenticated request (set by authenticateToken middleware)
    const userId = req.user?.id || req.user?.no || 'system';
    const userRole = req.user?.role || 'user';

    // Generate cryptographic HMAC signature to prevent header spoofing in internal network
    const signaturePayload = `${userId}:${userRole}`;
    const hmacSignature = crypto
      .createHmac('sha256', INTERNAL_SECRET)
      .update(signaturePayload)
      .digest('hex');

    const headers = {
      'content-type': 'application/json',
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

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[API Gateway Proxy Error] Workers microservice unreachable:', err.message);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'El microservicio de trabajadores (workers-service) no se encuentra disponible.',
      details: err.message
    });
  }
};

router.all('/workers', proxyHandler);
router.all('/workers/stats', proxyHandler);
router.all('/workers/calendar', proxyHandler);
router.all('/workers/:no/rules', proxyHandler);
router.all('/rules/:id', proxyHandler);

module.exports = router;
