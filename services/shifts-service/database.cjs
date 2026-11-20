const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'shifts.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS shift_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shift_monthly_distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL,
    year_month TEXT NOT NULL,
    days_json TEXT NOT NULL,
    FOREIGN KEY(shift_id) REFERENCES shift_templates(id) ON DELETE CASCADE,
    UNIQUE(shift_id, year_month)
  );

  CREATE TABLE IF NOT EXISTS shift_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    type TEXT,
    turno TEXT,
    start_date TEXT,
    end_date TEXT
  );

`);

console.log('[Shifts Microservice] Connected autonomously to dedicated shifts database at:', dbPath);

module.exports = db;
