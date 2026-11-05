const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const localAttendanceRoutes = require('./attendance.routes.cjs');

const ATTENDANCE_SERVICE_URL = process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3003';

const proxyHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return localAttendanceRoutes(req, res, next);
  }
  try {
    const targetUrl = `${ATTENDANCE_SERVICE_URL}${req.originalUrl}`;
    
    const isUpload = req.originalUrl.includes('/upload');
    if (isUpload) {
      console.log('PROXY UPLOAD DEBUG:', {
        hasFile: !!req.file,
        fileDetails: req.file ? { originalname: req.file.originalname, size: req.file.size } : null,
        contentType: req.headers['content-type']
      });
    }

    const headers = {
      ...(req.headers['authorization'] ? { 'authorization': req.headers['authorization'] } : {}),
      ...(req.headers['accept'] ? { 'accept': req.headers['accept'] } : {})
    };

    const fetchOptions = {
      method: req.method,
      headers
    };

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
    console.error('[API Gateway Proxy Error] Failed to reach attendance microservice:', err);
    res.status(502).json({ error: 'Attendance microservice unavailable (Strangler Fig Proxy)', details: err.cause ? `${err.message} (${err.cause.code})` : err.message });
  }
};

router.all('/upload', upload.single('file'), proxyHandler);
router.all('/dates', proxyHandler);
router.all('/attendance', proxyHandler);

module.exports = router;
