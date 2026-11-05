const express = require('express');
const router = express.Router();
const localWorkersRoutes = require('./workers.routes.cjs');

const WORKERS_SERVICE_URL = process.env.WORKERS_SERVICE_URL || 'http://localhost:3002';

const proxyHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return localWorkersRoutes(req, res, next);
  }
  try {
    const targetUrl = `${WORKERS_SERVICE_URL}${req.originalUrl}`;
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        ...(req.headers['authorization'] ? { 'authorization': req.headers['authorization'] } : {}),
        ...(req.headers['accept'] ? { 'accept': req.headers['accept'] } : {})
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[API Gateway Proxy Error] Failed to reach workers microservice:', err);
    res.status(502).json({ error: 'Workers microservice unavailable (Strangler Fig Proxy)', details: err.cause ? `${err.message} (${err.cause.code})` : err.message });
  }
};

router.all('/workers', proxyHandler);
router.all('/workers/stats', proxyHandler);
router.all('/workers/calendar', proxyHandler);
router.all('/workers/:no/rules', proxyHandler);
router.all('/rules/:id', proxyHandler);

module.exports = router;
