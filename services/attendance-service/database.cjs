const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'attendance.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    date TEXT,
    time TEXT,
    timestamp TEXT,
    location_id TEXT,
    verification TEXT
  );

  CREATE TABLE IF NOT EXISTS incident_justifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    date TEXT,
    tipo TEXT,
    descripcion TEXT,
    updated_at TEXT,
    UNIQUE(worker_no, date)
  );

  CREATE TABLE IF NOT EXISTS zk_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    sync_hour INTEGER NOT NULL DEFAULT 0,
    sync_minute INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_sync_date TEXT
  );
  INSERT OR IGNORE INTO zk_settings (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS zk_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 4370,
    comm_key INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_worker_date ON attendance(worker_no, date);
  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
`);

console.log('[Attendance Microservice] Connected autonomously to dedicated attendance database at:', dbPath);

module.exports = db;
