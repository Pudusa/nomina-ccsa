const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'nomina.db');
const db = new Database(dbPath);

// Create tables if they don't exist to ensure true persistence across server restarts
db.exec(`
  CREATE TABLE IF NOT EXISTS workers (
    no TEXT PRIMARY KEY,
    nombre TEXT,
    default_turno TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    timestamp TEXT,
    location_id TEXT,
    verification TEXT,
    FOREIGN KEY(worker_no) REFERENCES workers(no)
  );

  CREATE TABLE IF NOT EXISTS shift_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    type TEXT,
    turno TEXT,
    start_date TEXT,
    end_date TEXT,
    first_mark_direction TEXT,
    FOREIGN KEY(worker_no) REFERENCES workers(no)
  );

  CREATE TABLE IF NOT EXISTS shift_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shift_template_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_template_id INTEGER,
    day_index INTEGER,
    hours TEXT,
    mark_direction TEXT,
    FOREIGN KEY(shift_template_id) REFERENCES shift_templates(id) ON DELETE CASCADE
  );
`);

console.log('Database connected and tables verified at:', dbPath);

module.exports = db;
