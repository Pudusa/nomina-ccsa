const express = require('express');
const cors = require('cors');

for (const key of ['JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`[FATAL] Falta la variable de entorno obligatoria: ${key}`);
    process.exit(1);
  }
}

const db = require('./database.cjs');
const attendanceRoutes = require('./routes/attendance.routes.cjs');
const { authenticateToken, requireRole } = require('./middleware/auth.middleware.cjs');
const { reloadAttendanceFiles } = require('./services/reload.service.cjs');

const app = express();
const PORT = process.env.PORT || 3003;

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
      service: 'attendance-service',
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
      service: 'attendance-service',
      db: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'attendance-service',
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

app.get('/metrics', authenticateToken, requireRole(['admin']), (req, res) => {
  res.status(200).json({
    timestamp: new Date().toISOString(),
    service: 'attendance-service',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    pid: process.pid
  });
});

app.use('/api', attendanceRoutes);

// Recarga diaria de los archivos de asistencia a las 10:00 (hora local).
// Con >= 10 también recarga si el servicio arranca después de las 10.
let lastReloadDate = null;
setInterval(() => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (now.getHours() >= 10 && lastReloadDate !== today) {
    lastReloadDate = today;
    try {
      reloadAttendanceFiles();
    } catch (err) {
      console.error('[Reload] Error en la recarga programada:', err.message);
    }
  }
}, 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: `[Attendance Microservice] Running on http://0.0.0.0:${PORT}`
  }));
});
