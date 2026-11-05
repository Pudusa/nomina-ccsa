const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'shifts.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

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

  CREATE INDEX IF NOT EXISTS idx_shift_monthly_dist ON shift_monthly_distributions(shift_id, year_month);
`);

// Auto-seed shifts from nomina.db if shift_templates table is empty
const tCount = db.prepare('SELECT COUNT(*) as count FROM shift_templates').get();
if (tCount.count === 0) {
  const nominaDbPath = process.env.NOMINA_DB_PATH || path.join(dbDir, 'nomina.db');
  if (fs.existsSync(nominaDbPath)) {
    try {
      const nominaDb = new Database(nominaDbPath, { readonly: true });
      const templates = nominaDb.prepare('SELECT * FROM shift_templates').all();
      const dists = nominaDb.prepare('SELECT * FROM shift_monthly_distributions').all();
      const rules = nominaDb.prepare('SELECT * FROM shift_rules').all();
      nominaDb.close();

      const insertT = db.prepare('INSERT OR REPLACE INTO shift_templates (id, name) VALUES (?, ?)');
      const insertD = db.prepare('INSERT OR REPLACE INTO shift_monthly_distributions (id, shift_id, year_month, days_json) VALUES (?, ?, ?, ?)');
      const insertR = db.prepare('INSERT OR REPLACE INTO shift_rules (id, worker_no, type, turno, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)');

      const seedTx = db.transaction(() => {
        for (const t of templates) insertT.run(t.id, t.name);
        for (const d of dists) insertD.run(d.id, d.shift_id, d.year_month, d.days_json);
        for (const r of rules) insertR.run(r.id, r.worker_no, r.type, r.turno, r.start_date, r.end_date);
      });
      seedTx();
      console.log(`[Shifts Microservice] Seeded ${templates.length} templates, ${dists.length} distributions, and ${rules.length} rules from nomina.db into shifts.sqlite`);
    } catch (err) {
      console.error('[Shifts Microservice] Failed to seed from nomina.db:', err);
    }
  }
}

console.log('[Shifts Microservice] Connected autonomously to dedicated shifts database at:', dbPath);

module.exports = db;
