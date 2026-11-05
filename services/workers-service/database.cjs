const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'workers.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS workers (
    no TEXT PRIMARY KEY,
    nombre TEXT,
    default_turno TEXT
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

// Auto-seed workers and shift_rules from nomina.db if workers table is empty
const workerCount = db.prepare('SELECT COUNT(*) as count FROM workers').get();
if (workerCount.count === 0) {
  const nominaDbPath = process.env.NOMINA_DB_PATH || path.join(dbDir, 'nomina.db');
  if (fs.existsSync(nominaDbPath)) {
    try {
      const nominaDb = new Database(nominaDbPath, { readonly: true });
      const workers = nominaDb.prepare('SELECT * FROM workers').all();
      const rules = nominaDb.prepare('SELECT * FROM shift_rules').all();
      nominaDb.close();

      const insertWorker = db.prepare('INSERT OR REPLACE INTO workers (no, nombre, default_turno) VALUES (?, ?, ?)');
      const insertRule = db.prepare('INSERT OR REPLACE INTO shift_rules (id, worker_no, type, turno, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)');

      const seedTx = db.transaction(() => {
        for (const w of workers) {
          insertWorker.run(w.no, w.nombre, w.default_turno);
        }
        for (const r of rules) {
          insertRule.run(r.id, r.worker_no, r.type, r.turno, r.start_date, r.end_date);
        }
      });
      seedTx();
      console.log(`[Workers Microservice] Seeded ${workers.length} workers and ${rules.length} shift rules from nomina.db into workers.sqlite`);
    } catch (err) {
      console.error('[Workers Microservice] Failed to seed from nomina.db:', err);
    }
  }
}

console.log('[Workers Microservice] Connected autonomously to dedicated workers database at:', dbPath);

module.exports = db;
