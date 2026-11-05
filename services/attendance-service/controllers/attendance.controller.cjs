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

    const defaultTurnoName = 'Sin turno';

    const checkExistingAttendance = db.prepare(`
      SELECT id FROM attendance
      WHERE worker_no = ? AND timestamp = ? AND location_id = ? AND verification = ?
    `);

    const insertAttendance = db.prepare(`
      INSERT INTO attendance (worker_no, timestamp, location_id, verification)
      VALUES (?, ?, ?, ?)
    `);

    let newRecordsCount = 0;
    let duplicateRecordsCount = 0;

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const no = String(row['No.'] || '').trim();
        const rawDate = row['Fecha/Hora'];
        const locationId = String(row['Location ID'] || '');
        const verification = String(row['Verificación'] || '');

        const d = attendanceService.parseToDate(rawDate, XLSX);
        if (!no || !d) continue;

        const timestampStr = attendanceService.formatDateTime(d);
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
    const rows = db.prepare('SELECT DISTINCT substr(timestamp, 1, 10) as date FROM attendance ORDER BY date ASC').all();
    const dates = rows.map(r => r.date).filter(d => d && d.length === 10);
    res.json(dates);
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

    const nextDateObj = new Date(date + 'T00:00:00');
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDate = nextDateObj.toISOString().split('T')[0];

    const dayRecords = db.prepare('SELECT * FROM attendance WHERE timestamp >= ? AND timestamp < ?').all(date, nextDate);
    
    const workersDb = attendanceService.getWorkersDb();
    let workers = [];
    let rules = [];
    if (workersDb) {
      workers = workersDb.prepare('SELECT * FROM workers').all();
      rules = workersDb.prepare('SELECT * FROM shift_rules').all();
      workersDb.close();
    }

    const workersMap = new Map();
    workers.forEach((w) => {
      const sNo = String(w.no);
      workersMap.set(sNo, { ...w, defaultTurno: w.default_turno || 'Sin turno', rules: [] });
    });
    rules.forEach((r) => {
      const sNo = String(r.worker_no);
      if (workersMap.has(sNo)) {
        workersMap.get(sNo).rules.push(r);
      }
    });

    const workerTimesMap = new Map();
    dayRecords.forEach((r) => {
      const sNo = String(r.worker_no);
      const d = new Date(r.timestamp);
      if (isNaN(d.getTime())) return;
      if (!workerTimesMap.has(sNo)) {
        workerTimesMap.set(sNo, []);
      }
      workerTimesMap.get(sNo).push(d);
    });

    const nominaDb = attendanceService.getNominaDb();
    const yearMonth = date.substring(0, 7);
    const dateObj = new Date(date + 'T00:00:00');
    const dayNum = dateObj.getDate();
    const dayIndex = (dayNum - 1) % 31;

    const templatesMap = {};
    if (nominaDb) {
      const templates = nominaDb.prepare('SELECT id, name FROM shift_templates').all();
      templates.forEach(t => { templatesMap[t.name] = t.id; });
    }

    const summaries = [];
    workersMap.forEach((workerObj, sNo) => {
      const nombre = workerObj.nombre || 'Desconocido';
      const defaultTurno = workerObj.defaultTurno;
      const workerRules = workerObj.rules;

      let turno = defaultTurno;
      if (workerRules && workerRules.length > 0) {
        const sorted = [...workerRules].sort((a, b) => a.start_date.localeCompare(b.start_date));
        for (const rule of sorted) {
          if (rule.type === 'total') {
            if (date >= rule.start_date) turno = rule.turno;
          } else if (rule.type === 'parcial') {
            const end = rule.end_date || rule.start_date;
            if (date >= rule.start_date && date <= end) turno = rule.turno;
          }
        }
      }

      const times = workerTimesMap.get(sNo) || [];
      times.sort((a, b) => a.getTime() - b.getTime());

      let templateMarkDir = 'entrada';
      let templateNumMarks = 2;

      const templateId = templatesMap[turno];
      if (templateId && nominaDb) {
        let dist = nominaDb.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateId, yearMonth);   
        if (!dist) {
          dist = nominaDb.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateId, 'BASE');        
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
        no: sNo,
        nombre,
        marca1: classified.marca1,
        marca2: classified.marca2,
        entradaMañana: classified.entradaMañana,
        salidaMañana: classified.salidaMañana,
        entradaTarde: classified.entradaTarde,
        salidaTarde: classified.salidaTarde,
        turno,
        totalPunches: cleanedTimes.length,
      });
    });

    if (nominaDb) nominaDb.close();

    summaries.sort((a, b) => {
      const numA = Number(a.no);
      const numB = Number(b.no);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.no.localeCompare(b.no);
    });

    res.json(summaries);
  } catch (err) {
    console.error('Error in /api/attendance:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getDates,
  getAttendanceByDate,
  uploadAttendance
};
