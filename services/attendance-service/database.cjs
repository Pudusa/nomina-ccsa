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

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    timestamp TEXT,
    location_id TEXT,
    verification TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_worker_timestamp ON attendance(worker_no, timestamp);
  CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
`);

// Auto-seed attendance from nomina.db if attendance table is empty
const attCount = db.prepare('SELECT COUNT(*) as count FROM attendance').get();
if (attCount.count === 0) {
  const nominaDbPath = process.env.NOMINA_DB_PATH || path.join(dbDir, 'nomina.db');
  if (fs.existsSync(nominaDbPath)) {
    try {
      const nominaDb = new Database(nominaDbPath, { readonly: true });
      const records = nominaDb.prepare('SELECT * FROM attendance').all();
      nominaDb.close();

      const insertAtt = db.prepare('INSERT OR REPLACE INTO attendance (id, worker_no, timestamp, location_id, verification) VALUES (?, ?, ?, ?, ?)');
      const seedTx = db.transaction(() => {
        for (const r of records) {
          insertAtt.run(r.id, r.worker_no, r.timestamp, r.location_id, r.verification);
        }
      });
      seedTx();
      console.log(`[Attendance Microservice] Seeded ${records.length} attendance records from nomina.db into attendance.sqlite`);
    } catch (err) {
      console.error('[Attendance Microservice] Failed to seed from nomina.db:', err);
    }
  }
}

console.log('[Attendance Microservice] Connected autonomously to dedicated attendance database at:', dbPath);

module.exports = db;
