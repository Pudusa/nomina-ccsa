const express = require('express');
const router = express.Router();
const localShiftsRoutes = require('./shifts.routes.cjs');

const SHIFTS_SERVICE_URL = process.env.SHIFTS_SERVICE_URL || 'http://localhost:3004';

const proxyHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return localShiftsRoutes(req, res, next);
  }
  try {
    const targetUrl = `${SHIFTS_SERVICE_URL}${req.originalUrl}`;
    
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
    console.error('[API Gateway Proxy Error] Failed to reach shifts microservice:', err);
    res.status(502).json({ error: 'Shifts microservice unavailable (Strangler Fig Proxy)', details: err.cause ? `${err.message} (${err.cause.code})` : err.message });
  }
};

router.all('/shift-templates', proxyHandler);
router.all('/shift-templates/:name', proxyHandler);

module.exports = router;
