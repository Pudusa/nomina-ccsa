const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const attendanceService = require('./services/attendance.service.cjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'attendance.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
  const centralDbPaths = [
    path.join(__dirname, '../../data/attendance.sqlite'),
    path.join(__dirname, '../../../data/attendance.sqlite'),
    path.join(process.cwd(), 'data/attendance.sqlite')
  ];
  for (const centralPath of centralDbPaths) {
    if (fs.existsSync(centralPath)) {
      try {
        fs.copyFileSync(centralPath, dbPath);
        console.log(`[Attendance Microservice] Initialized attendance.sqlite from central database: ${centralPath}`);
        break;
      } catch (e) {}
    }
  }
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    date TEXT,
    time TEXT,
    timestamp TEXT,
    location_id TEXT,
    verification TEXT
  );

  CREATE TABLE IF NOT EXISTS incident_justifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_no TEXT,
    date TEXT,
    tipo TEXT,
    descripcion TEXT,
    updated_at TEXT,
    UNIQUE(worker_no, date)
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_worker_date ON attendance(worker_no, date);
  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
`);

// Check if attendance is empty or has corrupted 00:00:00 times
const attCount = db.prepare('SELECT COUNT(*) as count FROM attendance').get();

if (attCount.count === 0) {

  const excelPaths = [
    path.join(__dirname, '../../edifico Admin.xls'),
    path.join(__dirname, '../../../edifico Admin.xls'),
    path.join(__dirname, '../../public/InOutData.xls'),
    path.join(__dirname, '../../../public/InOutData.xls'),
    path.join(dbDir, '../../edifico Admin.xls'),
    path.join(dbDir, '../../public/InOutData.xls'),
    path.join(process.cwd(), 'edifico Admin.xls'),
    path.join(process.cwd(), 'public/InOutData.xls')
  ];

  let seeded = false;
  for (const excelPath of excelPaths) {
    if (fs.existsSync(excelPath)) {
      try {
        const workbook = XLSX.readFile(excelPath, { cellDates: true, dense: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const insertAtt = db.prepare('INSERT OR REPLACE INTO attendance (worker_no, date, time, timestamp, location_id, verification) VALUES (?, ?, ?, ?, ?, ?)');
        const seedTx = db.transaction(() => {
          for (const row of rows) {
            const no = String(row['No.'] || '').trim();
            const rawDate = row['Fecha/Hora'];
            const locationId = String(row['Location ID'] || '');
            const verification = String(row['Verificación'] || '');

            const parsedRec = attendanceService.parseAttendanceRecord(rawDate, XLSX);
            if (!no || !parsedRec) continue;

            const { dateStr, timeStr, timestampStr } = parsedRec;
            insertAtt.run(no, dateStr, timeStr, timestampStr, locationId, verification);
          }
        });
        seedTx();
        console.log(`[Attendance Microservice] Seeded attendance records from Excel: ${excelPath}`);
        seeded = true;
        break;
      } catch (err) {
        console.error('[Attendance Microservice] Failed to seed from Excel:', excelPath, err);
      }
    }
  }

  // Fallback to nomina.db if no Excel found
  if (!seeded) {
    const nominaDbPath = process.env.NOMINA_DB_PATH || 
        (fs.existsSync(path.join(dbDir, 'nomina.db')) ? path.join(dbDir, 'nomina.db') :
         fs.existsSync(path.join(__dirname, '../../data/nomina.db')) ? path.join(__dirname, '../../data/nomina.db') :
         path.join(__dirname, '../../../data/nomina.db'));
    if (fs.existsSync(nominaDbPath)) {
      try {
        const nominaDb = new Database(nominaDbPath, { readonly: true });
        const records = nominaDb.prepare('SELECT * FROM attendance').all();
        nominaDb.close();

        const insertAtt = db.prepare('INSERT OR REPLACE INTO attendance (id, worker_no, date, time, timestamp, location_id, verification) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const seedTx = db.transaction(() => {
          for (const r of records) {
            const t = r.timestamp || '';
            const dateStr = r.date || (t.length >= 10 ? t.substring(0, 10) : '');
            const timeStr = r.time || (t.length >= 19 ? t.substring(11, 19) : '00:00:00');
            insertAtt.run(r.id, r.worker_no, dateStr, timeStr, t, r.location_id, r.verification);
          }
        });
        seedTx();
        console.log(`[Attendance Microservice] Seeded ${records.length} attendance records from nomina.db into attendance.sqlite`);
      } catch (err) {
        console.error('[Attendance Microservice] Failed to seed from nomina.db:', err);
      }
    }
  }
}

console.log('[Attendance Microservice] Connected autonomously to dedicated attendance database at:', dbPath);

module.exports = db;
