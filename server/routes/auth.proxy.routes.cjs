const express = require('express');
const router = express.Router();
const localAuthRoutes = require('./auth.routes.cjs');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

const proxyHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return localAuthRoutes(req, res, next);
  }
  try {
    const targetUrl = `${AUTH_SERVICE_URL}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['content-length'];

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
      fetchOptions.headers['content-type'] = 'application/json';
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[API Gateway Proxy Error] Failed to reach auth microservice:', err.message);
    res.status(502).json({ error: 'Auth microservice unavailable (Strangler Fig Proxy)' });
  }
};

router.all('/auth/login', proxyHandler);
router.all('/auth/me', proxyHandler);

module.exports = router;
