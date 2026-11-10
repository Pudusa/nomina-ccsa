const db = require('../database.cjs');
const workersService = require('../services/workers.service.cjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function loadShiftTemplates(monthYear) {
  const shiftsDbPath = fs.existsSync(path.join(__dirname, '../../../data/shifts.sqlite'))
    ? path.join(__dirname, '../../../data/shifts.sqlite')
    : (fs.existsSync(path.join(__dirname, '../../shifts-service/shifts.sqlite'))
      ? path.join(__dirname, '../../shifts-service/shifts.sqlite')
      : path.join(process.cwd(), 'data/shifts.sqlite'));

  const shiftTemplates = {};
  if (fs.existsSync(shiftsDbPath)) {
    const shiftsDb = new Database(shiftsDbPath, { readonly: true });
    try {
      const templates = shiftsDb.prepare('SELECT * FROM shift_templates').all();
      templates.forEach(t => {
        const dist = shiftsDb.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ?').get(t.id, monthYear) ||
                     shiftsDb.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ?').get(t.id, 'BASE');
        if (dist && dist.days_json) {
          const parsed = JSON.parse(dist.days_json);
          shiftTemplates[t.name] = parsed.map((item, idx) => ({
            dayIndex: Array.isArray(item) ? item[2] : idx,
            hours: Array.isArray(item) ? item[0] : (item.hours !== undefined ? item.hours : '8'),
            numMarcas: Array.isArray(item) ? item[3] : (item.numMarcas !== undefined ? item.numMarcas : 2)
          }));
        }
      });
    } catch (e) {
      console.error('Error loading shift templates directly:', e);
    } finally {
      shiftsDb.close();
    }
  }
  return shiftTemplates;
}

function loadAttendanceRange(minDate, nextMaxDate) {
  const attDbPath = fs.existsSync(path.join(__dirname, '../../../data/attendance.sqlite'))
    ? path.join(__dirname, '../../../data/attendance.sqlite')
    : (fs.existsSync(path.join(__dirname, '../../attendance-service/attendance.sqlite'))
      ? path.join(__dirname, '../../attendance-service/attendance.sqlite')
      : path.join(process.cwd(), 'data/attendance.sqlite'));

  const allAttendance = [];
  if (fs.existsSync(attDbPath)) {
    const attDb = new Database(attDbPath, { readonly: true });
    try {
      const records = attDb.prepare('SELECT * FROM attendance WHERE timestamp >= ? AND timestamp < ?').all(minDate, nextMaxDate);
      allAttendance.push(...records);
    } catch (e) {
      console.error('Error loading attendance directly:', e);
    } finally {
      attDb.close();
    }
  }
  return allAttendance;
}

function getWorkers(req, res) {
  try {
    workersService.cleanupExpiredRules();

    const workers = db.prepare('SELECT * FROM workers ORDER BY CAST(no AS INTEGER) ASC, no ASC').all();
    const rules = db.prepare('SELECT * FROM shift_rules').all();

    const rulesMap = {};
    rules.forEach((r) => {
      if (!rulesMap[r.worker_no]) rulesMap[r.worker_no] = [];
      rulesMap[r.worker_no].push(r);
    });

    const defaultFallback = workersService.getDefaultTemplateName();

    const result = workers.map((w) => ({
      no: w.no,
      nombre: w.nombre,
      defaultTurno: w.default_turno || defaultFallback,
      departamento: w.departamento || 'General',
      rules: rulesMap[w.no] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getWorkersStats(req, res) {
  try {
    const { monthYear, period } = req.query;
    if (!monthYear) {
      return res.status(400).json({ error: 'Se requiere el parámetro monthYear (YYYY-MM).' });
    }

    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    let startDay = 1;
    let endDay = daysInMonth;
    if (period === 'Q1') {
      startDay = 1;
      endDay = Math.min(15, daysInMonth);
    } else if (period === 'Q2') {
      startDay = 16;
      endDay = daysInMonth;
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yYyyy = yesterday.getFullYear();
    const yMm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYyyy}-${yMm}-${yDd}`;

    const dateStrs = [];
    for (let d = startDay; d <= endDay; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${monthYear}-${dStr}`;
      if (dateStr <= yesterdayStr) {
        dateStrs.push(dateStr);
      }
    }

    if (dateStrs.length === 0) return res.json({});

    const minDate = dateStrs[0];
    const maxDate = dateStrs[dateStrs.length - 1];

    const workers = db.prepare('SELECT * FROM workers').all();
    const rules = db.prepare('SELECT * FROM shift_rules').all();
    const rulesMap = {};
    rules.forEach((r) => {
      if (!rulesMap[r.worker_no]) rulesMap[r.worker_no] = [];
      rulesMap[r.worker_no].push(r);
    });

    const defaultFallback = workersService.getDefaultTemplateName();

    const shiftTemplates = loadShiftTemplates(monthYear);

    // Fetch attendance from attendance-service
    const nextMaxDateObj = new Date(maxDate + 'T00:00:00');
    nextMaxDateObj.setDate(nextMaxDateObj.getDate() + 1);
    const nextMaxDate = nextMaxDateObj.toISOString().split('T')[0];

    const allAttendance = loadAttendanceRange(minDate, nextMaxDate);

    const attendanceMap = {};
    allAttendance.forEach(att => {
      const dStr = att.timestamp.split(' ')[0];
      const sNo = String(att.worker_no);
      if (!attendanceMap[sNo]) attendanceMap[sNo] = {};
      if (!attendanceMap[sNo][dStr]) attendanceMap[sNo][dStr] = [];
      attendanceMap[sNo][dStr].push(new Date(att.timestamp));
    });

    const statsMap = {};

    for (const worker of workers) {
      let singleMarks = 0;
      let absences = 0;
      const sNo = String(worker.no);
      const workerRules = rulesMap[sNo] || [];
      const defaultTurno = worker.default_turno || defaultFallback;
      const workerAttendance = attendanceMap[sNo] || {};

      for (const dateStr of dateStrs) {
        const dNum = parseInt(dateStr.split('-')[2], 10);
        const dayIndex = (dNum - 1) % 31;
        const turno = workersService.getTurnoOnDate(defaultTurno, workerRules, dateStr);

        let hoursVal = '8';
        let expectedNumMarcas = 2;

        const daysArr = shiftTemplates[turno];
        if (daysArr && daysArr[dayIndex]) {
          const dayItem = daysArr[dayIndex];
          hoursVal = String(dayItem.hours !== undefined ? dayItem.hours : '8');
          expectedNumMarcas = dayItem.numMarcas !== undefined ? Number(dayItem.numMarcas) : 2;
        }

      const dateObj = new Date(dateStr + 'T00:00:00');
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
        if (isRestDay) continue;

        const times = workerAttendance[dateStr] || [];
        const validTimes = workersService.filterDuplicatePunches(times);

        if (validTimes.length === 0) {
          absences++;
        } else if (validTimes.length === 1) {
          if (expectedNumMarcas === 2) {
            singleMarks++;
          }
        }
      }
      statsMap[worker.nombre] = { singleMarks, absences };
    }

    res.json(statsMap);
  } catch (err) {
    console.error('Error in /api/workers/stats:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getWorkerCalendar(req, res) {
  try {
    const { workerNo, monthYear } = req.query;
    if (!workerNo || !monthYear) {
      return res.status(400).json({ error: 'Se requieren workerNo y monthYear (YYYY-MM).' });
    }

    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yYyyy = yesterday.getFullYear();
    const yMm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYyyy}-${yMm}-${yDd}`;

    const worker = db.prepare('SELECT * FROM workers WHERE no = ?').get(workerNo);
    if (!worker) {
      return res.status(404).json({ error: 'Trabajador no encontrado.' });
    }

    const rules = db.prepare('SELECT * FROM shift_rules WHERE worker_no = ?').all(String(workerNo));
    const defaultFallback = workersService.getDefaultTemplateName();
    const defaultTurno = worker.default_turno || defaultFallback;

    const shiftTemplates = loadShiftTemplates(monthYear);

    const minDate = `${monthYear}-01`;
    const maxDate = `${monthYear}-${String(daysInMonth).padStart(2, '0')}`;
    const nextMaxDateObj = new Date(maxDate + 'T00:00:00');
    nextMaxDateObj.setDate(nextMaxDateObj.getDate() + 1);
    const nextMaxDate = nextMaxDateObj.toISOString().split('T')[0];

    // Fetch attendance from attendance-service
    const allAttendance = loadAttendanceRange(minDate, nextMaxDate);

    const attendanceByDate = {};
    allAttendance.forEach(att => {
      if (String(att.worker_no) === String(workerNo)) {
        const dStr = att.timestamp.split(' ')[0];
        if (!attendanceByDate[dStr]) attendanceByDate[dStr] = [];
        attendanceByDate[dStr].push(new Date(att.timestamp));
      }
    });

    const statusMap = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${monthYear}-${dStr}`;
      const dayIndex = (d - 1) % 31;
      const turno = workersService.getTurnoOnDate(defaultTurno, rules, dateStr);

      let hoursVal = '8';
      let expectedNumMarcas = 2;

      const daysArr = shiftTemplates[turno];
      if (daysArr && daysArr[dayIndex]) {
        const dayItem = daysArr[dayIndex];
        hoursVal = String(dayItem.hours !== undefined ? dayItem.hours : '8');
        expectedNumMarcas = dayItem.numMarcas !== undefined ? Number(dayItem.numMarcas) : 2;
      }

      const dateObj = new Date(dateStr + 'T00:00:00');
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

      const times = attendanceByDate[dateStr] || [];
      const validTimes = workersService.filterDuplicatePunches(times);

      let formattedTimes = validTimes.map(t => {
        const h = String(t.getHours()).padStart(2, '0');
        const m = String(t.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      });

      let workedHours = 0;
      if (validTimes.length >= 2) {
        const diffMs = validTimes[validTimes.length - 1].getTime() - validTimes[0].getTime();
        workedHours = Math.max(0, diffMs / (1000 * 60 * 60));
      }

      const numExpected = parseFloat(hoursVal) || 8;
      let overtimeHours = 0;
      if (!isRestDay && workedHours > numExpected) {
        overtimeHours = Math.round((workedHours - numExpected) * 10) / 10;
      }

      let status = 'gris';

      if (dateStr > yesterdayStr) {
        status = 'gris';
      } else if (isRestDay) {
        if (validTimes.length > 0) {
          status = 'fuera_de_turno';
        } else {
          status = 'gris';
        }
      } else {
        if (validTimes.length === 0) {
          status = 'rojo';
        } else if (validTimes.length === 1) {
          status = (expectedNumMarcas === 1) ? 'verde' : 'amarillo';
        } else if (validTimes.length >= 2 && expectedNumMarcas === 1) {
          status = 'fuera_de_turno';
        } else {
          status = 'verde';
        }
      }

      statusMap[dateStr] = {
        status,
        turno,
        expectedHours: numExpected,
        times: formattedTimes,
        workedHours: Math.round(workedHours * 10) / 10,
        overtimeHours
      };
    }

    res.json(statusMap);
  } catch (err) {
    console.error('Error in /api/workers/calendar:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getWorkersIncidents(req, res) {
  try {
    const { monthYear } = req.query;
    if (!monthYear) {
      return res.status(400).json({ error: 'Se requiere el parámetro monthYear (YYYY-MM).' });
    }

    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yYyyy = yesterday.getFullYear();
    const yMm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYyyy}-${yMm}-${yDd}`;

    const dateStrs = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${monthYear}-${dStr}`;
      if (dateStr <= yesterdayStr) {
        dateStrs.push(dateStr);
      }
    }

    if (dateStrs.length === 0) return res.json([]);

    const minDate = dateStrs[0];
    const maxDate = dateStrs[dateStrs.length - 1];

    const workers = db.prepare('SELECT * FROM workers').all();
    const rules = db.prepare('SELECT * FROM shift_rules').all();
    const rulesMap = {};
    rules.forEach((r) => {
      if (!rulesMap[r.worker_no]) rulesMap[r.worker_no] = [];
      rulesMap[r.worker_no].push(r);
    });

    const defaultFallback = workersService.getDefaultTemplateName();

    const shiftTemplates = loadShiftTemplates(monthYear);

    const nextMaxDateObj = new Date(maxDate + 'T00:00:00');
    nextMaxDateObj.setDate(nextMaxDateObj.getDate() + 1);
    const nextMaxDate = nextMaxDateObj.toISOString().split('T')[0];

    // Fetch attendance from attendance-service
    const allAttendance = loadAttendanceRange(minDate, nextMaxDate);

    const attendanceMap = {};
    allAttendance.forEach(att => {
      const dStr = att.timestamp.split(' ')[0];
      const sNo = String(att.worker_no);
      if (!attendanceMap[sNo]) attendanceMap[sNo] = {};
      if (!attendanceMap[sNo][dStr]) attendanceMap[sNo][dStr] = [];
      attendanceMap[sNo][dStr].push(new Date(att.timestamp));
    });

    const incidents = [];

    for (const worker of workers) {
      const workerRules = rulesMap[worker.no] || [];
      const defaultTurno = worker.default_turno || defaultFallback;
      const workerAttendance = attendanceMap[worker.no] || {};

      for (const dateStr of dateStrs) {
        const dNum = parseInt(dateStr.split('-')[2], 10);
        const dayIndex = (dNum - 1) % 31;
        const turno = workersService.getTurnoOnDate(defaultTurno, workerRules, dateStr);

        let hoursVal = '8';
        let expectedNumMarcas = 2;

        const daysArr = shiftTemplates[turno];
        if (daysArr && daysArr[dayIndex]) {
          const dayItem = daysArr[dayIndex];
          hoursVal = String(dayItem.hours !== undefined ? dayItem.hours : '8');
          expectedNumMarcas = dayItem.numMarcas !== undefined ? Number(dayItem.numMarcas) : 2;
        }

      const dateObj = new Date(dateStr + 'T00:00:00');
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

        const times = workerAttendance[dateStr] || [];
        const validTimes = workersService.filterDuplicatePunches(times);

        if (isRestDay) {
          if (validTimes.length > 0) {
            incidents.push({
              workerNo: worker.no,
              workerNombre: worker.nombre,
              date: dateStr,
              type: 'Fuera de turno'
            });
          }
        } else {
          if (validTimes.length === 0) {
            incidents.push({
              workerNo: worker.no,
              workerNombre: worker.nombre,
              date: dateStr,
              type: 'Ausencia'
            });
          } else if (validTimes.length === 1) {
            if (expectedNumMarcas === 2) {
              const hour = validTimes[0].getHours();
              // Antes de las 12pm se considera Entrada (mañana), por lo que falta la Salida.
              // Después de las 12pm se considera Salida (tarde), por lo que falta la Entrada.
              const falta = (hour < 12) ? 'Falta salida por marcar' : 'Falta entrada por marcar';
              incidents.push({
                workerNo: worker.no,
                workerNombre: worker.nombre,
                date: dateStr,
                type: falta
              });
            }
          } else if (validTimes.length === 2) {
            if (expectedNumMarcas === 1) {
              incidents.push({
                workerNo: worker.no,
                workerNombre: worker.nombre,
                date: dateStr,
                type: 'Fuera de turno'
              });
            }
          }
        }
      }
    }

    res.json(incidents);
  } catch (err) {
    console.error('Error in /api/workers/incidents:', err);
    res.status(500).json({ error: err.message });
  }
}

function addWorkerRule(req, res) {
  try {
    const { no } = req.params;
    const { type, turno, startDate, endDate } = req.body;

    console.log(`[workers-service] Adding rule for worker ${no}:`, { type, turno, startDate, endDate });

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
    console.error('[workers-service] Error in addWorkerRule:', err);
    res.status(500).json({ error: err.message });
  }
}

function deleteRule(req, res) {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM shift_rules WHERE id = ?').run(id);
    res.json({ message: 'Regla eliminada con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getWorkers,
  getWorkersStats,
  getWorkerCalendar,
  getWorkersIncidents,
  addWorkerRule,
  deleteRule,
};
