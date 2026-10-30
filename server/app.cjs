const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database.cjs');

const attendanceRoutes = require('./routes/attendance.routes.cjs');
const workersRoutes = require('./routes/workers.routes.cjs');
const shiftsRoutes = require('./routes/shifts.routes.cjs');
const authProxyRoutes = require('./routes/auth.proxy.routes.cjs');

const app = express();

app.use(cors());
app.use(express.json());

// Structured JSON request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 400 ? 'ERROR' : 'INFO',
      service: 'nomina-monolith',
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket.remoteAddress
    };
    console.log(JSON.stringify(logEntry));
  });
  next();
});

// Health check endpoints
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.status(200).json({
      status: 'ok',
      service: 'nomina-monolith',
      db: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'nomina-monolith',
      db: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/ready', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.status(200).json({
      status: 'READY',
      database: 'CONNECTED',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'NOT_READY',
      database: 'DISCONNECTED',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/metrics', (req, res) => {
  res.status(200).json({
    timestamp: new Date().toISOString(),
    service: 'nomina-monolith',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    pid: process.pid
  });
});

// Mount modular routes under /api
app.use('/api', authProxyRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', workersRoutes);
app.use('/api', shiftsRoutes);

// Serve frontend static files if built in production / docker
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/ready' || req.path === '/metrics') {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

module.exports = app;
