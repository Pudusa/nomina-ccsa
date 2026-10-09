const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'nomina.db');
const db = new Database(dbPath);

// Drop legacy unused tables if they exist from previous iterations
db.exec(`
  DROP TABLE IF EXISTS shift_template_days;
  DROP TABLE IF EXISTS shift_monthly_overrides;
  DROP TABLE IF EXISTS shift_rules;

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
    FOREIGN KEY(worker_no) REFERENCES workers(no)
  );

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
`);

// Remove any duplicate shift_monthly_distributions keeping the latest id
try {
  db.exec(`
    DELETE FROM shift_monthly_distributions
    WHERE id NOT IN (
      SELECT MAX(id)
      FROM shift_monthly_distributions
      GROUP BY shift_id, year_month
    );
  `);
} catch (e) {
  console.error('Error cleaning up duplicate shift distributions:', e);
}

console.log('Database connected and tables verified at:', dbPath);

module.exports = db;
