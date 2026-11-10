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
      INSERT INTO attendance (worker_no, date, time, timestamp, location_id, verification)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let newRecordsCount = 0;
    let duplicateRecordsCount = 0;

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const no = String(row['No.'] || '').trim();
        const rawDate = row['Fecha/Hora'];
        const locationId = String(row['Location ID'] || '');
        const verification = String(row['Verificación'] || '');

        const parsedRec = attendanceService.parseAttendanceRecord(rawDate, XLSX);
        if (!no || !parsedRec) continue;

        const { dateStr, timeStr, timestampStr } = parsedRec;

        const existing = checkExistingAttendance.get(no, timestampStr, locationId, verification);

        if (!existing) {
          insertAttendance.run(no, dateStr, timeStr, timestampStr, locationId, verification);
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

    const dayRecords = db.prepare('SELECT * FROM attendance WHERE date = ?').all(date);
    
    const workersDb = attendanceService.getWorkersDb();
    let workers = [];
    let rules = [];
    if (workersDb) {
      try {
        workers = workersDb.prepare('SELECT * FROM workers').all();
        rules = workersDb.prepare('SELECT * FROM shift_rules').all();
      } catch (e) {
        console.error('Error querying workersDb:', e);
      } finally {
        workersDb.close();
      }
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
      const d = attendanceService.parseToDate(r.timestamp);
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
        if (!dist) {
          dist = nominaDb.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? ORDER BY year_month DESC LIMIT 1').get(templateId);
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

function getAttendanceByRange(req, res) {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate.' });
    }
    const records = db.prepare('SELECT * FROM attendance WHERE timestamp >= ? AND timestamp < ?').all(startDate, endDate);
    res.json(records);
  } catch (err) {
    console.error('Error in /api/attendance/range:', err);
    res.status(500).json({ error: err.message });
  }
}

function getIncidents(req, res) {
  try {
    const { startDate, endDate, month } = req.query;
    
    let query = 'SELECT * FROM attendance';
    let params = [];
    if (startDate && endDate) {
      query += ' WHERE date >= ? AND date <= ?';
      params = [startDate, endDate];
    } else if (month) {
      query += ' WHERE substr(date, 1, 7) = ?';
      params = [month];
    }
    query += ' ORDER BY date ASC, timestamp ASC';

    const records = db.prepare(query).all(...params);

    const workersDb = attendanceService.getWorkersDb();
    let workers = [];
    let rules = [];
    if (workersDb) {
      try {
        workers = workersDb.prepare('SELECT * FROM workers').all();
        rules = workersDb.prepare('SELECT * FROM shift_rules').all();
      } catch (e) {
        console.error('Error querying workersDb:', e);
      } finally {
        workersDb.close();
      }
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

    const nominaDb = attendanceService.getNominaDb();
    const templatesMap = {};
    const distsByShiftMonth = new Map();
    const distsByShiftBase = new Map();
    const distsByShiftFallback = new Map();

    if (nominaDb) {
      try {
        const templates = nominaDb.prepare('SELECT id, name FROM shift_templates').all();
        templates.forEach(t => { templatesMap[t.name] = t.id; });

        const allDists = nominaDb.prepare('SELECT shift_id, year_month, days_json FROM shift_monthly_distributions').all();
        allDists.forEach(d => {
          distsByShiftMonth.set(`${d.shift_id}_${d.year_month}`, d.days_json);
          if (d.year_month === 'BASE') {
            distsByShiftBase.set(d.shift_id, d.days_json);
          }
          if (!distsByShiftFallback.has(d.shift_id)) {
            distsByShiftFallback.set(d.shift_id, d.days_json);
          }
        });
      } catch (e) {
        console.error('Error pre-loading distributions:', e);
      } finally {
        nominaDb.close();
      }
    }

    let rangeStart = startDate;
    let rangeEnd = endDate;
    if (!rangeStart || !rangeEnd) {
      if (month) {
        rangeStart = `${month}-01`;
        const [y, m] = month.split('-').map(Number);
        const lastDay = new Date(y || 2026, m || 10, 0).getDate();
        rangeEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
      } else {
        rangeStart = '2026-10-01';
        rangeEnd = '2026-10-31';
      }
    }

    const datesInRange = [];
    let curr = new Date(rangeStart + 'T00:00:00');
    const end = new Date(rangeEnd + 'T00:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      datesInRange.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }

    const workerDateMap = new Map();
    records.forEach((r) => {
      const sNo = String(r.worker_no);
      const date = r.date;
      const key = `${sNo}_${date}`;
      if (!workerDateMap.has(key)) {
        workerDateMap.set(key, { workerNo: sNo, date, times: [] });
      }
      const parsedTime = attendanceService.parseToDate(r.timestamp);
      if (parsedTime && !isNaN(parsedTime.getTime())) {
        workerDateMap.get(key).times.push(parsedTime);
      }
    });

    const incidentsByWorker = new Map();
    let anomalyIdCounter = 1;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yYyyy = yesterday.getFullYear();
    const yMm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYyyy}-${yMm}-${yDd}`;

    workersMap.forEach((workerObj, workerNo) => {
      const nombre = workerObj.nombre || 'Desconocido';
      const defaultTurno = workerObj.defaultTurno;
      const workerRules = workerObj.rules;

      datesInRange.forEach(date => {
        if (date > yesterdayStr) return;
        let turno = defaultTurno;
        if (workerRules && workerRules.length > 0) {
          const sorted = [...workerRules].sort((a, b) => a.start_date.localeCompare(b.start_date));
          for (const rule of sorted) {
            if (rule.type === 'total') {
              if (date >= rule.start_date) turno = rule.turno;
            } else if (rule.type === 'parcial') {
              const ruleEnd = rule.end_date || rule.start_date;
              if (date >= rule.start_date && date <= ruleEnd) turno = rule.turno;
            }
          }
        }

        const yearMonth = date.substring(0, 7);
        const dateObj = new Date(date + 'T00:00:00');
        const dayNum = dateObj.getDate();
        const dayIndex = (dayNum - 1) % 31;

        let hoursVal = '8';
        let expectedNumMarcas = 2;
        let templateMarkDir = 'entrada';
        const templateId = templatesMap[turno];
        if (templateId) {
          let daysJson = distsByShiftMonth.get(`${templateId}_${yearMonth}`) || 
                         distsByShiftBase.get(templateId) || 
                         distsByShiftFallback.get(templateId);
          if (daysJson) {
            try {
              const parsed = typeof daysJson === 'string' ? JSON.parse(daysJson) : daysJson;
              const daysArr = Array.isArray(parsed) ? parsed : [];
              const dayItem = daysArr[dayIndex] || daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
              if (dayItem) {
                if (Array.isArray(dayItem)) {
                  hoursVal = dayItem[0] !== undefined ? String(dayItem[0]) : '8';
                  expectedNumMarcas = dayItem[3] !== undefined ? Number(dayItem[3]) : 2;
                  if (dayItem[1]) templateMarkDir = dayItem[1];
                } else {
                  hoursVal = String(dayItem.hours !== undefined ? dayItem.hours : '8');
                  expectedNumMarcas = dayItem.numMarks !== undefined ? Number(dayItem.numMarks) : 2;
                  if (dayItem.markDirection) templateMarkDir = dayItem.markDirection;
                }
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

        const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
        const isSunday = (dayOfWeek === 0);
        const isSaturday = (dayOfWeek === 6);

        const turnoLower = (turno || '').trim().toLowerCase();
        const isTurnoRest = turnoLower.includes('descanso') || 
                            turnoLower.includes('libre') || 
                            turnoLower.includes('domingo') || 
                            turnoLower.includes('festivo') || 
                            turnoLower.includes('feriado') || 
                            turnoLower.includes('vacaciones') || 
                            turnoLower.includes('incapacidad') || 
                            turnoLower.includes('permiso') ||
                            turnoLower === 'd' || 
                            turnoLower === 'p' || 
                            turnoLower === '0';
        const isSinTurno = !turno || turnoLower === '' || turnoLower === 'sin turno';
        const hStr = String(hoursVal || '').trim().toLowerCase();
        const isRestDay = isSinTurno || isTurnoRest || isSunday || (isSaturday && (hStr === '8' || hStr === '' || hStr === '0')) || hStr === 'p' || hStr === 'd' || hStr === 'descanso' || hStr === 'libre' || hStr === '0' || hStr === '0.00' || hStr === '' || expectedNumMarcas === 0;

        const key = `${workerNo}_${date}`;
        const recordEntry = workerDateMap.get(key);
        const rawTimes = recordEntry && recordEntry.times ? recordEntry.times : [];
        const filteredTimes = attendanceService.filterDuplicatePunches(rawTimes);

        if (isRestDay) {
          if (filteredTimes.length > 0) {
            if (!incidentsByWorker.has(workerNo)) {
              incidentsByWorker.set(workerNo, { no: workerNo, nombre, anomalias: [] });
            }
            incidentsByWorker.get(workerNo).anomalias.push({
              id: anomalyIdCounter++,
              tipo: 'Fuera de turno',
              fecha: date
            });
          }
        } else {
          if (filteredTimes.length === 0) {
            if (!incidentsByWorker.has(workerNo)) {
              incidentsByWorker.set(workerNo, { no: workerNo, nombre, anomalias: [] });
            }
            incidentsByWorker.get(workerNo).anomalias.push({
              id: anomalyIdCounter++,
              tipo: 'Ausencia',
              fecha: date
            });
          } else if (filteredTimes.length === 1) {
            if (expectedNumMarcas === 2) {
              if (!incidentsByWorker.has(workerNo)) {
                incidentsByWorker.set(workerNo, { no: workerNo, nombre, anomalias: [] });
              }
              const hour = filteredTimes[0].getHours();
              // Antes de las 12pm se considera Entrada (mañana), por lo que falta la Salida.
              // Después de las 12pm se considera Salida (tarde), por lo que falta la Entrada.
              const falta = (hour < 12) ? 'Falta salida por marcar' : 'Falta entrada por marcar';
              incidentsByWorker.get(workerNo).anomalias.push({
                id: anomalyIdCounter++,
                tipo: falta,
                fecha: date
              });
            }
          } else if (filteredTimes.length >= 2) {
            if (expectedNumMarcas === 1) {
              if (!incidentsByWorker.has(workerNo)) {
                incidentsByWorker.set(workerNo, { no: workerNo, nombre, anomalias: [] });
              }
              incidentsByWorker.get(workerNo).anomalias.push({
                id: anomalyIdCounter++,
                tipo: 'Fuera de turno',
                fecha: date
              });
            }
          }
        }
      });
    });

    // Ordenar anomalias cronológicamente por fecha para cada trabajador
    incidentsByWorker.forEach((worker) => {
      worker.anomalias.sort((a, b) => a.fecha.localeCompare(b.fecha));
    });

    const result = Array.from(incidentsByWorker.values()).filter(w => w.anomalias.length > 0);

    res.json(result);
  } catch (err) {
    console.error('Error in /api/incidents:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getDates,
  getAttendanceByDate,
  getAttendanceByRange,
  uploadAttendance,
  getIncidents
};
