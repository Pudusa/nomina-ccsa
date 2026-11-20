const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'workers.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS workers (
    no TEXT PRIMARY KEY,
    nombre TEXT,
    default_turno TEXT,
    departamento TEXT DEFAULT 'General'
  );

  CREATE TABLE IF NOT EXISTS shift_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    type TEXT,
    turno TEXT,
    start_date TEXT,
    end_date TEXT,
    FOREIGN KEY(worker_no) REFERENCES workers(no)
  );

  CREATE INDEX IF NOT EXISTS idx_shift_rules_worker ON shift_rules(worker_no);
`);

try {
  db.exec(`ALTER TABLE workers ADD COLUMN departamento TEXT DEFAULT 'General'`);
} catch (e) {
  // Column already exists
}

console.log('[Workers Microservice] Connected autonomously to dedicated workers database at:', dbPath);

module.exports = db;
