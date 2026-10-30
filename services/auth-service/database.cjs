const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'nomina.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 8192) {
  const seedPath = path.join(__dirname, 'nomina.db');
  if (fs.existsSync(seedPath) && seedPath !== dbPath) {
    try {
      fs.copyFileSync(seedPath, dbPath);
      console.log(`[Auth Microservice] Seeded database from ${seedPath} to ${dbPath}`);
    } catch (err) {
      console.error('[Auth Microservice] Failed to seed database:', err);
    }
  }
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('[Auth Microservice] Connected to database at:', dbPath);

module.exports = db;
