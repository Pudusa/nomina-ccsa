const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'nomina.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Auto-seed database if target does not exist or is an empty/new skeleton database (< 8KB)
if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 8192) {
  const seedPath = path.join(__dirname, 'nomina.db');
  if (fs.existsSync(seedPath) && seedPath !== dbPath) {
    try {
      fs.copyFileSync(seedPath, dbPath);
      console.log(`Seeded database from ${seedPath} to ${dbPath}`);
    } catch (err) {
      console.error('Failed to seed database:', err);
    }
  }
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator'
  );

  -- Performance Indexes for high concurrency & fast joins
  CREATE INDEX IF NOT EXISTS idx_attendance_worker_timestamp ON attendance(worker_no, timestamp);
  CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
  CREATE INDEX IF NOT EXISTS idx_shift_rules_worker ON shift_rules(worker_no);
  CREATE INDEX IF NOT EXISTS idx_shift_monthly_dist ON shift_monthly_distributions(shift_id, year_month);
`);

const bcrypt = require('bcryptjs');
const adminCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (adminCount.count === 0) {
  const defaultPasswordHash = bcrypt.hashSync('adminpassword123', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', defaultPasswordHash, 'admin');
  console.log('Default admin user created (username: admin, password: adminpassword123)');
}

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

// Automated SQLite Backup Mechanism
const backupDir = path.join(path.dirname(dbPath), 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}
const backupFileName = `nomina_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.db`;
const backupPath = path.join(backupDir, backupFileName);

try {
  // better-sqlite3 native backup
  db.backup(backupPath)
    .then(() => {
      console.log('📦 Automated database backup created successfully at:', backupPath);
    })
    .catch((err) => {
      console.error('❌ Database backup async error:', err);
    });
} catch (e) {
  try {
    db.backup(backupPath);
    console.log('📦 Automated database backup created successfully at:', backupPath);
  } catch (err2) {
    console.error('❌ Database backup sync error:', err2);
  }
}

console.log('Database connected, indexes verified, and tables ready at:', dbPath);

module.exports = db;
