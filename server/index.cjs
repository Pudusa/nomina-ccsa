const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('./database.cjs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Clean request logging middleware (status & duration)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const emoji = status >= 400 ? '❌' : '✅';
    console.log(`${emoji} [${req.method}] ${req.originalUrl} - Status: ${status} (${duration}ms)`);
  });
  next();
});

// Helper to convert Excel date
function parseToDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      return new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H, dateObj.M, dateObj.S));
    }
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get default shift template name
function getDefaultTemplateName() {
  return 'Sin turno';
}

// Helper to ensure unset worker turnos default to 'Sin turno' without overwriting assigned turnos
function normalizeWorkerTurnos() {
  try {
    const workers = db.prepare('SELECT no, default_turno FROM workers').all();
    const updateStmt = db.prepare('UPDATE workers SET default_turno = ? WHERE no = ?');

    for (const w of workers) {
      if (!w.default_turno) {
        updateStmt.run('Sin turno', w.no);
      }
    }
  } catch (err) {
    console.error('Error normalizing worker turnos:', err);
  }
}

// Helper to cleanup fulfilled/expired rules
function cleanupExpiredRules() {
  try {
    normalizeWorkerTurnos();
    const todayStr = formatDateKey(new Date());

    const activeTotalRules = db.prepare(`
      SELECT * FROM shift_rules WHERE type = 'total' AND start_date <= ?
    `).all(todayStr);

    const updateDefaultTurno = db.prepare('UPDATE workers SET default_turno = ? WHERE no = ?');
    const deleteRule = db.prepare('DELETE FROM shift_rules WHERE id = ?');

    for (const r of activeTotalRules) {
      updateDefaultTurno.run(r.turno, r.worker_no);
      deleteRule.run(r.id);
    }

    db.prepare(`
      DELETE FROM shift_rules
      WHERE type = 'parcial' AND end_date < ?
    `).run(todayStr);
  } catch (err) {
    console.error('Error cleaning up expired rules:', err);
  }
}

// 1. Upload and process Excel file
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const workerHoursMap = new Map();
    const defaultTurnoName = getDefaultTemplateName();

    const checkExistingAttendance = db.prepare(`
      SELECT id FROM attendance
      WHERE worker_no = ? AND timestamp = ? AND location_id = ? AND verification = ?
    `);

    const insertAttendance = db.prepare(`
      INSERT INTO attendance (worker_no, timestamp, location_id, verification)
      VALUES (?, ?, ?, ?)
    `);

    const insertOrIgnoreWorker = db.prepare(`
      INSERT OR IGNORE INTO workers (no, nombre, default_turno)
      VALUES (?, ?, ?)
    `);

    const updateWorkerName = db.prepare(`
      UPDATE workers SET nombre = ? WHERE no = ?
    `);

    let newRecordsCount = 0;
    let duplicateRecordsCount = 0;

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const no = String(row['No.'] || '').trim();
        const nombre = String(row.Nombre || 'Desconocido').trim();
        const rawDate = row['Fecha/Hora'];
        const locationId = String(row['Location ID'] || '');
        const verification = String(row['Verificación'] || '');

        const d = parseToDate(rawDate);
        if (!no || !d) continue;

        const timestampIso = d.toISOString();

        insertOrIgnoreWorker.run(no, nombre, defaultTurnoName);
        updateWorkerName.run(nombre, no);

        const existing = checkExistingAttendance.get(no, timestampIso, locationId, verification);

        if (!existing) {
          insertAttendance.run(no, timestampIso, locationId, verification);
          newRecordsCount++;
        } else {
          duplicateRecordsCount++;
        }
      }
    });

    transaction(rows);

    res.json({
      message: 'Archivo procesado con éxito bajo política de auditoría.',
      totalRowsInFile: rows.length,
      newRecordsAdded: newRecordsCount,
      duplicatesSkipped: duplicateRecordsCount,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get all dates
app.get('/api/dates', (req, res) => {
  try {
    const rows = db.prepare('SELECT timestamp FROM attendance').all();
    const datesSet = new Set();
    rows.forEach((r) => {
      const d = new Date(r.timestamp);
      if (!isNaN(d.getTime())) {
        datesSet.add(formatDateKey(d));
      }
    });
    const sortedDates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));
    res.json(sortedDates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to resolve shift on date
function getTurnoOnDate(defaultTurno, rules, dateStr) {
  if (!rules || rules.length === 0) return defaultTurno;
  let resolved = defaultTurno;
  const sorted = [...rules].sort((a, b) => a.start_date.localeCompare(b.start_date));

  for (const rule of sorted) {
    if (rule.type === 'total') {
      if (dateStr >= rule.start_date) {
        resolved = rule.turno;
      }
    } else if (rule.type === 'parcial') {
      const end = rule.end_date || rule.start_date;
      if (dateStr >= rule.start_date && dateStr <= end) {
        resolved = rule.turno;
      }
    }
  }
  return resolved;
}

// Helper to filter out duplicate/accidental double punches within a 30-minute window
function filterDuplicatePunches(times) {
  if (!times || times.length <= 1) return times;
  const filtered = [times[0]];
  const MIN_GAP_MS = 30 * 60 * 1000;

  for (let i = 1; i < times.length; i++) {
    const lastAccepted = filtered[filtered.length - 1];
    const current = times[i];
    if (current.getTime() - lastAccepted.getTime() >= MIN_GAP_MS) {
      filtered.push(current);
    }
  }
  return filtered;
}

// Helper to classify punches
function classifyPunches(times, turno, ruleFirstMarkDir) {
  let entradaMañana = null;
  let salidaMañana = null;
  let entradaTarde = null;
  let salidaTarde = null;

  if (!times || times.length === 0) {
    return { entradaMañana, salidaMañana, entradaTarde, salidaTarde, marca1: null, marca2: null };
  }

  const tLower = (turno || '').toLowerCase();
  const isNightOrAfternoon = tLower.includes('turno 2') || tLower.includes('nocturno') || tLower.includes('vespertino');
  const isSalidaFirst = ruleFirstMarkDir === 'salida' || isNightOrAfternoon;

  const marca1 = times[0] ? times[0].toISOString() : null;
  const marca2 = times.length > 1 ? times[1].toISOString() : null;

  if (!isSalidaFirst) {
    // Normal: First is Entrada, Second is Salida
    if (times.length > 0) {
      const t = times[0];
      const timeDec = t.getHours() + t.getMinutes() / 60;
      if (timeDec < 12.5) entradaMañana = t.toISOString();
      else entradaTarde = t.toISOString();
    }
    if (times.length > 1) {
      const t = times[times.length - 1];
      const timeDec = t.getHours() + t.getMinutes() / 60;
      if (timeDec < 12.5) salidaMañana = t.toISOString();
      else salidaTarde = t.toISOString();
    }
  } else {
    // Salida First: First is Salida, Second is Entrada
    if (times.length > 0) {
      const t = times[0];
      const timeDec = t.getHours() + t.getMinutes() / 60;
      if (timeDec < 12.5) salidaMañana = t.toISOString();
      else salidaTarde = t.toISOString();
    }
    if (times.length > 1) {
      const t = times[1];
      const timeDec = t.getHours() + t.getMinutes() / 60;
      if (timeDec < 12.5) entradaMañana = t.toISOString();
      else entradaTarde = t.toISOString();
    }
  }

  return {
    entradaMañana,
    salidaMañana,
    entradaTarde,
    salidaTarde,
    marca1,
    marca2,
  };
}

// 3. Get all workers with their rules
app.get('/api/workers', (req, res) => {
  try {
    cleanupExpiredRules();

    const workers = db.prepare('SELECT * FROM workers ORDER BY CAST(no AS INTEGER) ASC, no ASC').all();
    const rules = db.prepare('SELECT * FROM shift_rules').all();

    const rulesMap = {};
    rules.forEach((r) => {
      if (!rulesMap[r.worker_no]) rulesMap[r.worker_no] = [];
      rulesMap[r.worker_no].push(r);
    });

    const defaultFallback = getDefaultTemplateName();

    const result = workers.map((w) => ({
      no: w.no,
      nombre: w.nombre,
      defaultTurno: w.default_turno || defaultFallback,
      rules: rulesMap[w.no] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Add shift rule for worker
app.post('/api/workers/:no/rules', (req, res) => {
  try {
    const { no } = req.params;
    const { type, turno, startDate, endDate } = req.body;

    if (!type || !turno || !startDate) {
      return res.status(400).json({ error: 'Faltan datos requeridos (type, turno, startDate).' });
    }

    const transaction = db.transaction(() => {
      if (type === 'total') {
        db.prepare('UPDATE workers SET default_turno = ? WHERE no = ?').run(turno, no);
        db.prepare('DELETE FROM shift_rules WHERE worker_no = ?').run(no);
      } else {
        const stmt = db.prepare(`
          INSERT INTO shift_rules (worker_no, type, turno, start_date, end_date)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(no, type, turno, startDate, endDate || startDate);
      }
    });

    transaction();
    res.json({ message: 'Turno asignado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete shift rule
app.delete('/api/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM shift_rules WHERE id = ?').run(id);
    res.json({ message: 'Regla eliminada con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get shift templates (for specific month with BASE fallback)
app.get('/api/shift-templates', (req, res) => {
  try {
    const { year_month } = req.query;
    const targetMonth = year_month || 'BASE';
    const templates = db.prepare('SELECT * FROM shift_templates').all();
    const result = {};

    templates.forEach((t) => {
      let dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(t.id, targetMonth);
      if (!dist && targetMonth !== 'BASE') {
        dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(t.id, 'BASE');
      }

      if (dist && dist.days_json) {
        try {
          const parsed = JSON.parse(dist.days_json);
          result[t.name] = parsed.map(item => {
            const hours = Array.isArray(item) ? item[0] : item.hours;
            const markDirection = Array.isArray(item) ? item[1] : item.markDirection;
            return {
              hours: isNaN(Number(hours)) ? hours : Number(hours),
              markDirection: markDirection || 'entrada',
            };
          });
        } catch (e) {
          result[t.name] = [];
        }
      } else {
        result[t.name] = [];
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Create or update shift template and its distribution for a specific month (or BASE)
app.post('/api/shift-templates', (req, res) => {
  try {
    const { name, days, yearMonth } = req.body;
    if (!name || !days || !Array.isArray(days)) {
      return res.status(400).json({ error: 'Nombre y días del turno son requeridos.' });
    }

    const ym = yearMonth || 'BASE';

    const insertOrIgnore = db.prepare('INSERT OR IGNORE INTO shift_templates (name) VALUES (?)');
    insertOrIgnore.run(name);

    const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(name);
    const shiftId = templateRow.id;

    // Tuple array format: [ [hours, markDirection, dayIndex], ... ]
    const tuples = days.map((d, idx) => {
      const item = d || {};
      return [
        item.hours !== undefined ? item.hours : 'P',
        item.markDirection || 'entrada',
        item.dayIndex !== undefined ? item.dayIndex : idx
      ];
    });

    const existing = db.prepare('SELECT id FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ?').get(shiftId, ym);
    if (existing) {
      db.prepare('UPDATE shift_monthly_distributions SET days_json = ? WHERE id = ?').run(JSON.stringify(tuples), existing.id);
    } else {
      db.prepare('INSERT INTO shift_monthly_distributions (shift_id, year_month, days_json) VALUES (?, ?, ?)').run(shiftId, ym, JSON.stringify(tuples));
    }

    res.json({ message: 'Turno guardado con éxito en la base de datos.' });
  } catch (err) {
    console.error('Error al guardar shift template:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Delete shift template
app.delete('/api/shift-templates/:name', (req, res) => {
  try {
    const { name } = req.params;
    db.prepare('DELETE FROM shift_templates WHERE name = ?').run(name);
    res.json({ message: 'Turno eliminado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Get attendance for a specific date
app.get('/api/attendance', (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ error: 'Se requiere el parámetro date.' });
    }

    cleanupExpiredRules();

    const allRecords = db.prepare('SELECT * FROM attendance').all();
    const workers = db.prepare('SELECT * FROM workers').all();
    const rules = db.prepare('SELECT * FROM shift_rules').all();

    const workersMap = new Map();
    const defaultFallback = getDefaultTemplateName();

    workers.forEach((w) => {
      workersMap.set(w.no, { ...w, defaultTurno: w.default_turno || defaultFallback, rules: [] });
    });
    rules.forEach((r) => {
      if (workersMap.has(r.worker_no)) {
        workersMap.get(r.worker_no).rules.push(r);
      }
    });

    const workerTimesMap = new Map();

    allRecords.forEach((r) => {
      const d = new Date(r.timestamp);
      if (isNaN(d.getTime())) return;
      const dateKey = formatDateKey(d);
      if (dateKey !== date) return;

      const no = r.worker_no;
      if (!workerTimesMap.has(no)) {
        workerTimesMap.set(no, []);
      }
      workerTimesMap.get(no).push(d);
    });

    const summaries = [];
    workerTimesMap.forEach((times, no) => {
      times.sort((a, b) => a.getTime() - b.getTime());

      const workerObj = workersMap.get(no);
      const nombre = workerObj ? workerObj.nombre : 'Desconocido';
      const defaultTurno = workerObj ? workerObj.defaultTurno : defaultFallback;
      const workerRules = workerObj ? workerObj.rules : [];
      const turno = getTurnoOnDate(defaultTurno, workerRules, date);

      const dateObj = new Date(date + 'T00:00:00');
      const dayNum = dateObj.getDate();
      const dayIndex = (dayNum - 1) % 31;
      const yearMonth = date.substring(0, 7); // "YYYY-MM"

      // Check unique shift distribution for specific month with BASE fallback
      const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(turno);
      let templateMarkDir = 'entrada';

      if (templateRow) {
        let dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateRow.id, yearMonth);
        if (!dist) {
          dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateRow.id, 'BASE');
        }
        if (dist && dist.days_json) {
          try {
            const daysArr = JSON.parse(dist.days_json);
            const dayItem = daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
            if (dayItem) {
              const markDir = Array.isArray(dayItem) ? dayItem[1] : dayItem.markDirection;
              if (markDir) templateMarkDir = markDir;
            }
          } catch (e) {}
        }
      }

      let ruleFirstMarkDir = templateMarkDir;
      for (const r of workerRules) {
        if (r.type === 'total' && date >= r.start_date) {
          if (r.first_mark_direction) ruleFirstMarkDir = r.first_mark_direction;
        } else if (r.type === 'parcial') {
          const end = r.end_date || r.start_date;
          if (date >= r.start_date && date <= end) {
            if (r.first_mark_direction) ruleFirstMarkDir = r.first_mark_direction;
          }
        }
      }

      const cleanedTimes = filterDuplicatePunches(times);
      const classified = classifyPunches(cleanedTimes, turno, ruleFirstMarkDir);

      summaries.push({
        no,
        nombre,
        marca1: classified.marca1,
        marca2: classified.marca2,
        entradaMañana: classified.entradaMañana,
        salidaMañana: classified.salidaMañana,
        entradaTarde: classified.entradaTarde,
        salidaTarde: classified.salidaTarde,
        turno,
      });
    });

    summaries.sort((a, b) => {
      const numA = Number(a.no);
      const numB = Number(b.no);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.no.localeCompare(b.no);
    });

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});
