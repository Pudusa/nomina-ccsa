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

// Helper to get first available shift template dynamically (avoiding hardcoded names)
function getDefaultTemplateName() {
  const t = db.prepare('SELECT name FROM shift_templates LIMIT 1').get();
  return t ? t.name : 'TURNO 1';
}

// Seed default shift templates if none exist
function seedDefaultTemplates() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM shift_templates').get().cnt;
  if (count === 0) {
    const defaultTemplates = {
      'TURNO 1': [8, 'P', 'P', 'P', 12, 12, 4, 12, 8, 'P', 'P', 'P', 12, 12, 4, 12, 8, 'P', 'P', 'P', 12, 12, 4, 12, 8, 'P', 'P', 'P', 12, 12, 4],
      'TURNO 2': ['P', 'P', 12, 12, 4, 12, 8, 'P', 'P', 'P', 12, 12, 4, 12, 8, 'P', 'P', 'P', 12, 12, 4, 12, 8, 'P', 'P', 'P', 12, 12, 4, 12, 8],
      'T.FIJO': [8.8, 8.8, 'P', 'P', 8.8, 8.8, 8.8, 8.8, 8.8, 'P', 'P', 8.8, 8.8, 8.8, 8.8, 8.8, 8.8, 'P', 'P', 8.8, 8.8, 8.8, 8.8, 8.8, 'P', 'P', 8.8, 8.8, 8.8, 8.8, 8.8],
    };

    const insertTemplate = db.prepare('INSERT INTO shift_templates (name) VALUES (?)');
    const insertDay = db.prepare('INSERT INTO shift_template_days (shift_template_id, day_index, hours, mark_direction) VALUES (?, ?, ?, ?)');

    for (const [name, days] of Object.entries(defaultTemplates)) {
      const info = insertTemplate.run(name);
      const templateId = info.lastInsertRowid;
      days.forEach((h, idx) => {
        insertDay.run(templateId, idx, String(h), 'entrada');
      });
    }
  }
}
seedDefaultTemplates();

// Helper to normalize worker turnos to match available database shift templates
function normalizeWorkerTurnos() {
  try {
    const templates = db.prepare('SELECT name FROM shift_templates').all().map(t => t.name);
    if (templates.length === 0) return;
    const defaultT = templates[0];
    const secondT = templates[1] || defaultT;

    const workers = db.prepare('SELECT no, default_turno FROM workers').all();
    const updateStmt = db.prepare('UPDATE workers SET default_turno = ? WHERE no = ?');

    for (const w of workers) {
      if (!templates.includes(w.default_turno)) {
        let mapped = defaultT;
        if (w.default_turno && (w.default_turno.toLowerCase().includes('vespertino') || w.default_turno.toLowerCase().includes('nocturno'))) {
          mapped = secondT;
        }
        updateStmt.run(mapped, w.no);
      }
    }
  } catch (err) {
    console.error('Error normalizing worker turnos:', err);
  }
}

// Helper to cleanup fulfilled/expired rules: total rules expire when applied (start_date <= today), partial rules expire when deadline passes (end_date < today)
function cleanupExpiredRules() {
  try {
    normalizeWorkerTurnos();

    const todayStr = formatDateKey(new Date());

    // 1. Total rules expire when applied (start_date <= today) -> update default_turno and remove rule
    const activeTotalRules = db.prepare(`
      SELECT * FROM shift_rules WHERE type = 'total' AND start_date <= ?
    `).all(todayStr);

    const updateDefaultTurno = db.prepare('UPDATE workers SET default_turno = ? WHERE no = ?');
    const deleteRule = db.prepare('DELETE FROM shift_rules WHERE id = ?');

    for (const r of activeTotalRules) {
      updateDefaultTurno.run(r.turno, r.worker_no);
      deleteRule.run(r.id);
    }

    // 2. Partial rules expire when deadline culminates (end_date < today) -> remove rule
    db.prepare(`
      DELETE FROM shift_rules
      WHERE type = 'parcial' AND end_date < ?
    `).run(todayStr);
  } catch (err) {
    console.error('Error cleaning up expired rules:', err);
  }
}

// 1. Upload and process Excel file (Auditable & Non-Destructive Appending)
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

        if (!workerHoursMap.has(no)) {
          workerHoursMap.set(no, []);
        }
        workerHoursMap.get(no).push(d.getHours());
      }

      // Optionally adjust default turno based on hours if needed, or keep default
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

// Helper to filter out duplicate/accidental double punches within a 30-minute window (keeping only the first mark)
function filterDuplicatePunches(times) {
  if (!times || times.length <= 1) return times;
  const filtered = [times[0]];
  const MIN_GAP_MS = 30 * 60 * 1000; // 30 minutes

  for (let i = 1; i < times.length; i++) {
    const lastAccepted = filtered[filtered.length - 1];
    const current = times[i];
    if (current.getTime() - lastAccepted.getTime() >= MIN_GAP_MS) {
      filtered.push(current);
    }
  }
  return filtered;
}

// Helper to classify punches into morning/afternoon entries and exits based on shift type and punch time
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

  const morningTimes = [];
  const afternoonTimes = [];

  times.forEach((t) => {
    const hour = t.getHours();
    const minute = t.getMinutes();
    const timeDecimal = hour + minute / 60;
    if (timeDecimal < 12.5) {
      morningTimes.push(t);
    } else {
      afternoonTimes.push(t);
    }
  });

  // At most ONE mark in the morning
  if (morningTimes.length > 0) {
    const mTime = morningTimes[0].toISOString();
    if (isSalidaFirst) {
      salidaMañana = mTime;
    } else {
      entradaMañana = mTime;
    }
  }

  // At most ONE mark in the afternoon
  if (afternoonTimes.length > 0) {
    if (isNightOrAfternoon) {
      entradaTarde = afternoonTimes[0].toISOString();
    } else {
      salidaTarde = afternoonTimes[afternoonTimes.length - 1].toISOString();
    }
  }

  const marca1 = entradaMañana || entradaTarde || null;
  const marca2 = salidaTarde || salidaMañana || null;

  return {
    entradaMañana,
    salidaMañana,
    entradaTarde,
    salidaTarde,
    marca1,
    marca2,
  };
}

// 3. Get all workers with their rules (and cleanup expired rules first)
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

// 4. Add shift rule for worker (Ensuring only ONE active rule exists at a time per worker)
app.post('/api/workers/:no/rules', (req, res) => {
  try {
    const { no } = req.params;
    const { type, turno, startDate, endDate, first_mark_direction } = req.body;

    if (!type || !turno || !startDate) {
      return res.status(400).json({ error: 'Faltan datos requeridos (type, turno, startDate).' });
    }

    const transaction = db.transaction(() => {
      // Remove any existing rules so only ONE rule exists at a time per worker
      db.prepare('DELETE FROM shift_rules WHERE worker_no = ?').run(no);

      const stmt = db.prepare(`
        INSERT INTO shift_rules (worker_no, type, turno, start_date, end_date, first_mark_direction)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      return stmt.run(no, type, turno, startDate, endDate || startDate, first_mark_direction || 'entrada');
    });

    const info = transaction();

    res.json({ message: 'Regla de turno guardada con éxito (regla única activa).', id: info.lastInsertRowid });
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

// 6. Get shift templates
app.get('/api/shift-templates', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM shift_templates').all();
    const days = db.prepare('SELECT * FROM shift_template_days ORDER BY day_index ASC').all();

    const daysMap = {};
    days.forEach((d) => {
      if (!daysMap[d.shift_template_id]) daysMap[d.shift_template_id] = [];
      daysMap[d.shift_template_id].push({
        hours: isNaN(Number(d.hours)) ? d.hours : Number(d.hours),
        markDirection: d.mark_direction || 'entrada',
      });
    });

    const result = {};
    templates.forEach((t) => {
      result[t.name] = daysMap[t.id] || [];
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Create or update shift template
app.post('/api/shift-templates', (req, res) => {
  try {
    const { name, days } = req.body; // days is array of { hours, markDirection }
    if (!name || !days || !Array.isArray(days)) {
      return res.status(400).json({ error: 'Nombre y días del turno son requeridos.' });
    }

    const insertOrReplaceTemplate = db.prepare('INSERT OR REPLACE INTO shift_templates (name) VALUES (?)');
    const info = insertOrReplaceTemplate.run(name);

    // Get template id
    const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(name);
    const templateId = templateRow.id;

    // Clear existing days for this template
    db.prepare('DELETE FROM shift_template_days WHERE shift_template_id = ?').run(templateId);

    const insertDay = db.prepare('INSERT INTO shift_template_days (shift_template_id, day_index, hours, mark_direction) VALUES (?, ?, ?, ?)');
    days.forEach((d, idx) => {
      insertDay.run(templateId, idx, String(d.hours), d.markDirection || 'entrada');
    });

    res.json({ message: 'Turno guardado con éxito en la base de datos.' });
  } catch (err) {
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

// 8b. Get shift monthly overrides
app.get('/api/shift-monthly-overrides', (req, res) => {
  try {
    const { year_month, shift_name } = req.query;
    let query = 'SELECT * FROM shift_monthly_overrides WHERE 1=1';
    const params = [];
    if (year_month) {
      query += ' AND year_month = ?';
      params.push(year_month);
    }
    if (shift_name) {
      query += ' AND shift_name = ?';
      params.push(shift_name);
    }
    const rows = db.prepare(query).all(params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8c. Save or update shift monthly override
app.post('/api/shift-monthly-overrides', (req, res) => {
  try {
    const { shiftName, yearMonth, dayIndex, hours, markDirection } = req.body;
    if (!shiftName || !yearMonth || dayIndex === undefined || hours === undefined) {
      return res.status(400).json({ error: 'Faltan datos requeridos (shiftName, yearMonth, dayIndex, hours).' });
    }

    const stmt = db.prepare(`
      INSERT INTO shift_monthly_overrides (shift_name, year_month, day_index, hours, mark_direction)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(shift_name, year_month, day_index)
      DO UPDATE SET hours = excluded.hours, mark_direction = excluded.mark_direction
    `);
    stmt.run(shiftName, yearMonth, dayIndex, String(hours), markDirection || 'entrada');

    res.json({ message: 'Ajuste mensual guardado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Get attendance for a specific date (cleanup expired rules first)
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

      // Determine day index in template (day of month 1-31 -> index 0-30)
      const dateObj = new Date(date + 'T00:00:00');
      const dayNum = dateObj.getDate();
      const dayIndex = (dayNum - 1) % 31;
      const yearMonth = date.substring(0, 7); // "YYYY-MM"

      // Check monthly override first
      const monthlyOverride = db.prepare('SELECT hours, mark_direction FROM shift_monthly_overrides WHERE shift_name = ? AND year_month = ? AND day_index = ?').get(turno, yearMonth, dayIndex);

      let templateMarkDir = 'entrada';
      if (monthlyOverride && monthlyOverride.mark_direction) {
        templateMarkDir = monthlyOverride.mark_direction;
      } else {
        const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(turno);
        if (templateRow) {
          const tDay = db.prepare('SELECT mark_direction FROM shift_template_days WHERE shift_template_id = ? AND day_index = ?').get(templateRow.id, dayIndex);
          if (tDay && tDay.mark_direction) {
            templateMarkDir = tDay.mark_direction;
          }
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
