const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'auth.sqlite');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Ensure users table exists for auth-service isolation
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator'
  );
`);

// Seed default admin user if users table is empty
const adminCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (adminCount.count === 0) {
  const defaultPasswordHash = bcrypt.hashSync('adminpassword123', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', defaultPasswordHash, 'admin');
  console.log('[Auth Microservice] Default admin user created in auth.sqlite (username: admin, password: adminpassword123)');
}

console.log('[Auth Microservice] Connected autonomously to dedicated auth database at:', dbPath);

module.exports = db;
