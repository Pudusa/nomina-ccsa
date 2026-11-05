const XLSX = require('xlsx');
const db = require('../database.cjs');
const attendanceService = require('../services/attendance.service.cjs');
const workersService = require('../services/workers.service.cjs');

function uploadAttendance(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true, dense: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const defaultTurnoName = workersService.getDefaultTemplateName();

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

        const d = attendanceService.parseToDate(rawDate, XLSX);
        if (!no || !d) continue;

        const timestampStr = attendanceService.formatDateTime(d);

        insertOrIgnoreWorker.run(no, nombre, defaultTurnoName);
        updateWorkerName.run(nombre, no);

        const existing = checkExistingAttendance.get(no, timestampStr, locationId, verification);

        if (!existing) {
          insertAttendance.run(no, timestampStr, locationId, verification);
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
}

function getDates(req, res) {
  try {
    const rows = db.prepare('SELECT timestamp FROM attendance').all();
    const datesSet = new Set();
    rows.forEach((r) => {
      const d = new Date(r.timestamp);
      if (!isNaN(d.getTime())) {
        datesSet.add(attendanceService.formatDateKey(d));
      }
    });
    const sortedDates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));
    res.json(sortedDates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getAttendanceByDate(req, res) {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ error: 'Se requiere el parámetro date.' });
    }

    workersService.cleanupExpiredRules();

    const allRecords = db.prepare('SELECT * FROM attendance').all();
    const workers = db.prepare('SELECT * FROM workers').all();
    const rules = db.prepare('SELECT * FROM shift_rules').all();

    const workersMap = new Map();
    const defaultFallback = workersService.getDefaultTemplateName();

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
      const dateKey = attendanceService.formatDateKey(d);
      if (dateKey !== date) return;

      const no = r.worker_no;
      if (!workerTimesMap.has(no)) {
        workerTimesMap.set(no, []);
      }
      workerTimesMap.get(no).push(d);
    });

    const summaries = [];
    workersMap.forEach((workerObj, no) => {
      const nombre = workerObj.nombre || 'Desconocido';
      const defaultTurno = workerObj.defaultTurno;
      const workerRules = workerObj.rules;
      const turno = workersService.getTurnoOnDate(defaultTurno, workerRules, date);

      const times = workerTimesMap.get(no) || [];
      times.sort((a, b) => a.getTime() - b.getTime());

      const dateObj = new Date(date + 'T00:00:00');
      const dayNum = dateObj.getDate();
      const dayIndex = (dayNum - 1) % 31;
      const yearMonth = date.substring(0, 7); // "YYYY-MM"

      const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(turno);
      let templateMarkDir = 'entrada';
      let templateNumMarks = 2;

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
              const numMarks = Array.isArray(dayItem) ? dayItem[3] : dayItem.numMarcas;
              if (numMarks !== undefined) templateNumMarks = Number(numMarks) || 2;
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

      const cleanedTimes = attendanceService.filterDuplicatePunches(times);
      const classified = attendanceService.classifyPunches(cleanedTimes, turno, ruleFirstMarkDir, templateNumMarks);

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
        numMarcas: templateNumMarks,
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
}

module.exports = {
  uploadAttendance,
  getDates,
  getAttendanceByDate,
};
