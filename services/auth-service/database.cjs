const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'auth.sqlite');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

// Ensure users table exists for auth-service isolation
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    activo INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migración para bases existentes creadas con el esquema anterior
for (const col of [
  "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer'",
  "ALTER TABLE users ADD COLUMN activo INTEGER DEFAULT 1",
  "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'))",
]) {
  try { db.exec(col); } catch { /* la columna ya existe */ }
}

// Normalizar roles legacy
try {
  db.prepare("UPDATE users SET role='viewer' WHERE role NOT IN ('admin','editor','viewer')").run();
} catch { /* sin roles legacy por normalizar */ }

console.log('[Auth Microservice] Connected autonomously to dedicated auth database at:', dbPath);

module.exports = db;
