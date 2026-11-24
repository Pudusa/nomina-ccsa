const XLSX = require('xlsx');
const db = require('../database.cjs');
const attendanceService = require('../services/attendance.service.cjs');
const internalApi = require('../services/internal-api.cjs');
const zkDevicesService = require('../services/zk-devices.service.cjs');
const attendanceStatus = require('../../shared/attendance-status.cjs');

function uploadAttendance(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true, dense: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const { added, skipped } = attendanceService.importAttendanceRows(rows, XLSX, db);

    res.json({
      message: 'Archivo procesado con éxito bajo política de auditoría.',
      totalRowsInFile: rows.length,
      newRecordsAdded: added,
      duplicatesSkipped: skipped,
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

async function getAttendanceByDate(req, res) {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ error: 'Se requiere el parámetro date.' });
    }

    const dayRecords = db.prepare('SELECT * FROM attendance WHERE date = ?').all(date);
    const authHeader = req.headers.authorization;
    const workerRows = await internalApi.getWorkers(authHeader, date);

    const workersMap = new Map();
    workerRows.forEach((w) => {
      workersMap.set(w.no, { ...w, defaultTurno: w.default_turno || 'Sin turno', rules: w.rules || [] });
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

    const yearMonth = date.substring(0, 7);
    const dateObj = new Date(date + 'T00:00:00');
    const dayNum = dateObj.getDate();
    const dayIndex = (dayNum - 1) % 31;

    const { templates, distributions } = await internalApi.getShiftData(authHeader, yearMonth);
    const templatesMap = {};
    templates.forEach(t => { templatesMap[t.name] = t.id; });

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
      let templateHours = '8';

      const templateId = templatesMap[turno];
      const dist = distributions.find(d => d.shift_id === templateId);
      if (dist && dist.days_json) {
        try {
          const daysArr = JSON.parse(dist.days_json);
          const dayItem = daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
          if (dayItem) {
            const markDir = Array.isArray(dayItem) ? dayItem[1] : dayItem.markDirection;
            if (markDir) templateMarkDir = markDir;
            const numMarks = Array.isArray(dayItem) ? dayItem[3] : dayItem.numMarcas;
            if (numMarks !== undefined) templateNumMarks = Number(numMarks) || 2;
            const dayHours = Array.isArray(dayItem) ? dayItem[0] : dayItem.hours;
            if (dayHours !== undefined) templateHours = dayHours;
          }
        } catch (e) {}
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
      const evaluated = attendanceStatus.evaluateAttendanceDay({
        date,
        turno,
        hours: templateHours,
        numMarcas: templateNumMarks,
        marcas: cleanedTimes,
        today: attendanceStatus.todayDateString(),
      });

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
        status: evaluated.status,
        isRestDay: evaluated.isRestDay,
        expectedNumMarcas: evaluated.expectedNumMarcas,
        workedHours: evaluated.workedHours,
        overtimeHours: evaluated.overtimeHours,
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

function getAnomaliaCategoria(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('fuera') || t.includes('turno') || t.includes('comisión') || t.includes('campo') || t.includes('comision')) {
    return 'Fuera de turno';
  }
  if (t.includes('olvido') || t.includes('biométrico') || t.includes('biometrico') || t.includes('salida') || t.includes('entrada') || t.includes('falta salida') || t.includes('falta entrada')) {
    return 'Falta marca';
  }
  return 'Ausencia';
}

async function getIncidents(req, res) {
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

    const justificationsRows = db.prepare('SELECT worker_no, date, tipo, descripcion FROM incident_justifications').all();
    const justificationsMap = new Map();
    justificationsRows.forEach(j => {
      justificationsMap.set(`${j.worker_no}_${j.date}`, { tipo: j.tipo, descripcion: j.descripcion });
    });

    const authHeader = req.headers.authorization;
    let rangeStart = startDate;
    let rangeEnd = endDate;
    if (!rangeStart || !rangeEnd) {
      if (month) {
        rangeStart = `${month}-01`;
        const [y, m] = month.split('-').map(Number);
        const lastDay = new Date(y || 2026, m || 10, 0).getDate();
        rangeEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
      } else {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        rangeStart = `${y}-${m}-01`;
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        rangeEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    const workerRows = await internalApi.getWorkers(authHeader, rangeEnd);
    const workersMap = new Map();
    workerRows.forEach((w) => {
      workersMap.set(w.no, { ...w, defaultTurno: w.default_turno || 'Sin turno', rules: w.rules || [] });
    });

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

    // Pedir las distribuciones de cada mes del rango: el endpoint ya aplica
    // el fallback mes -> BASE -> primer mes disponible por turno.
    const monthsInRange = [...new Set(datesInRange.map(d => d.substring(0, 7)))];
    const { templates, distributions } = await internalApi.getShiftData(authHeader, monthsInRange);
    const templatesMap = {};
    const distsByShiftMonth = new Map();
    templates.forEach(t => { templatesMap[t.name] = t.id; });
    distributions.forEach(d => {
      distsByShiftMonth.set(`${d.shift_id}_${d.year_month}`, d.days_json);
    });

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
        const templateId = templatesMap[turno];
        if (templateId) {
          const daysJson = distsByShiftMonth.get(`${templateId}_${yearMonth}`) ||
                           distsByShiftMonth.get(`${templateId}_BASE`);
          if (daysJson) {
            try {
              const parsed = typeof daysJson === 'string' ? JSON.parse(daysJson) : daysJson;
              const daysArr = Array.isArray(parsed) ? parsed : [];
              const dayItem = daysArr[dayIndex] || daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
              if (dayItem) {
                if (Array.isArray(dayItem)) {
                  hoursVal = dayItem[0] !== undefined ? String(dayItem[0]) : '8';
                  expectedNumMarcas = dayItem[3] !== undefined ? Number(dayItem[3]) : 2;
                } else {
                  hoursVal = String(dayItem.hours !== undefined ? dayItem.hours : '8');
                  expectedNumMarcas = dayItem.numMarks !== undefined ? Number(dayItem.numMarks) : 2;
                }
              }
            } catch (e) {}
          }
        }

        const key = `${workerNo}_${date}`;
        const recordEntry = workerDateMap.get(key);
        const rawTimes = recordEntry && recordEntry.times ? recordEntry.times : [];
        const filteredTimes = attendanceService.filterDuplicatePunches(rawTimes);

        const pushAnomaly = (defaultTipo, forcedCategoria) => {
          if (!incidentsByWorker.has(workerNo)) {
            incidentsByWorker.set(workerNo, { no: workerNo, nombre, anomalias: [] });
          }
          const jKey = `${workerNo}_${date}`;
          const savedJ = justificationsMap.get(jKey);
          const tipo = savedJ ? savedJ.tipo : defaultTipo;
          const descripcion = savedJ ? savedJ.descripcion : '';
          const categoria = forcedCategoria || getAnomaliaCategoria(tipo);

          const marcas = filteredTimes.map(t => {
            const hh = String(t.getHours()).padStart(2, '0');
            const mm = String(t.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          });

          incidentsByWorker.get(workerNo).anomalias.push({
            id: anomalyIdCounter++,
            categoria,
            tipo,
            descripcion,
            fecha: date,
            marcas
          });
        };

        const evaluated = attendanceStatus.evaluateAttendanceDay({
          date,
          turno,
          hours: hoursVal,
          numMarcas: expectedNumMarcas,
          marcas: filteredTimes,
          today: attendanceStatus.todayDateString(),
        });

        if (evaluated.incidencia) {
          pushAnomaly(evaluated.incidencia, evaluated.categoria);
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

function saveIncidentJustification(req, res) {
  try {
    const { workerNo, date, tipo, descripcion } = req.body;
    if (!workerNo || !date) {
      return res.status(400).json({ error: 'workerNo and date are required' });
    }
    const stmt = db.prepare(`
      INSERT INTO incident_justifications (worker_no, date, tipo, descripcion, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(worker_no, date) DO UPDATE SET
        tipo = excluded.tipo,
        descripcion = excluded.descripcion,
        updated_at = datetime('now')
    `);
    stmt.run(String(workerNo), String(date), String(tipo || 'Falta injustificada'), String(descripcion || ''));
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving justification:', err);
    res.status(500).json({ error: err.message });
  }
}

async function syncZkDevices(req, res) {
  try {
    const results = await zkDevicesService.syncAllDevices({ source: 'manual' });
    res.json({ success: true, results });
  } catch (err) {
    console.error('Error al sincronizar relojes ZK:', err);
    res.status(500).json({ error: 'Error al sincronizar los relojes ZK' });
  }
}

function getZkHistory(req, res) {
  try {
    res.json(zkDevicesService.getHistory(50));
  } catch (err) {
    console.error('Error al leer el historial ZK:', err);
    res.status(500).json({ error: 'Error al leer el historial' });
  }
}

function getZkConfig(req, res) {
  try {
    res.json(zkDevicesService.getConfig());
  } catch (err) {
    console.error('Error al leer la configuración ZK:', err);
    res.status(500).json({ error: 'Error al leer la configuración de relojes' });
  }
}

function isValidIp(ip) {
  if (typeof ip !== 'string') return false;
  const parts = ip.split('.');
  return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function saveZkConfig(req, res) {
  const { hour, minute, enabled, devices } = req.body || {};
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return res.status(400).json({ error: 'La hora debe estar entre 0 y 23 y el minuto entre 0 y 59' });
  }
  if (!Array.isArray(devices) || devices.some(d => !d || !isValidIp(d.ip))) {
    return res.status(400).json({ error: 'Cada reloj necesita una IP IPv4 válida' });
  }
  try {
    res.json(zkDevicesService.saveConfig({ hour, minute, enabled, devices }));
  } catch (err) {
    console.error('Error al guardar la configuración ZK:', err);
    res.status(500).json({ error: 'Error al guardar la configuración de relojes' });
  }
}

module.exports = {
  getDates,
  getAttendanceByDate,
  getAttendanceByRange,
  uploadAttendance,
  getIncidents,
  saveIncidentJustification,
  syncZkDevices,
  getZkConfig,
  saveZkConfig,
  getZkHistory
};
