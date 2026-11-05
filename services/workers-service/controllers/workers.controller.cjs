const db = require('../database.cjs');
const workersService = require('../services/workers.service.cjs');

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
      rules: rulesMap[w.no] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getWorkersStats(req, res) {
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
    const nominaDb = workersService.getNominaDb();
    
    // Pre-fetch everything from nominaDb if available
    const templatesMap = {};
    const distMap = {};
    const attendanceMap = {};

    if (nominaDb) {
      const templates = nominaDb.prepare('SELECT id, name FROM shift_templates').all();
      templates.forEach(t => { templatesMap[t.name] = t.id; });

      const distributions = nominaDb.prepare("SELECT shift_id, year_month, days_json FROM shift_monthly_distributions WHERE year_month = ? OR year_month = 'BASE'").all(monthYear);
      distributions.forEach(d => {
        if (!distMap[d.shift_id]) distMap[d.shift_id] = {};
        try {
          distMap[d.shift_id][d.year_month] = JSON.parse(d.days_json);
        } catch (e) {
          distMap[d.shift_id][d.year_month] = [];
        }
      });

      const nextMaxDateObj = new Date(maxDate + 'T00:00:00');
      nextMaxDateObj.setDate(nextMaxDateObj.getDate() + 1);
      const nextMaxDate = nextMaxDateObj.toISOString().split('T')[0];

      const allAttendance = nominaDb.prepare('SELECT worker_no, timestamp FROM attendance WHERE timestamp >= ? AND timestamp < ?').all(minDate, nextMaxDate);
      allAttendance.forEach(att => {
        const dStr = att.timestamp.split(' ')[0];
        const sNo = String(att.worker_no);
        if (!attendanceMap[sNo]) attendanceMap[sNo] = {};
        if (!attendanceMap[sNo][dStr]) attendanceMap[sNo][dStr] = [];
        attendanceMap[sNo][dStr].push(new Date(att.timestamp));
      });
    }

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

        const templateId = templatesMap[turno];
        if (templateId) {
          const workerDist = distMap[templateId] || {};
          const daysArr = workerDist[monthYear] || workerDist['BASE'];
          if (daysArr) {
            const dayItem = daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
            if (dayItem) {
              const h = Array.isArray(dayItem) ? dayItem[0] : dayItem.hours;
              if (h !== undefined) hoursVal = String(h);
              const numMarks = Array.isArray(dayItem) ? dayItem[3] : dayItem.numMarcas;
              if (numMarks !== undefined) expectedNumMarcas = Number(numMarks) || 2;
            }
          }
        }

        const isRestDay = hoursVal === 'P' || hoursVal === 'p' || hoursVal === '0' || hoursVal === '0.00' || hoursVal === '';
        if (isRestDay) continue;

        const times = workerAttendance[dateStr] || [];
        const validTimes = workersService.filterDuplicatePunches(times);

        if (validTimes.length === 0) {
          absences++;
        } else if (validTimes.length === 1) {
          singleMarks++;
        }
      }
      statsMap[worker.nombre] = { singleMarks, absences };
    }

    if (nominaDb) nominaDb.close();
    res.json(statsMap);
  } catch (err) {
    console.error('Error in /api/workers/stats:', err);
    res.status(500).json({ error: err.message });
  }
}

function getWorkerCalendar(req, res) {
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

    const nominaDb = workersService.getNominaDb();
    
    // Pre-fetch
    const templatesMap = {};
    const distMap = {};
    const attendanceByDate = {};

    if (nominaDb) {
      const templates = nominaDb.prepare('SELECT id, name FROM shift_templates').all();
      templates.forEach(t => { templatesMap[t.name] = t.id; });

      const distributions = nominaDb.prepare("SELECT shift_id, year_month, days_json FROM shift_monthly_distributions WHERE year_month = ? OR year_month = 'BASE'").all(monthYear);
      distributions.forEach(d => {
        const sShiftId = String(d.shift_id);
        if (!distMap[sShiftId]) distMap[sShiftId] = {};
        try {
          distMap[sShiftId][d.year_month] = JSON.parse(d.days_json);
        } catch (e) {
          distMap[sShiftId][d.year_month] = [];
        }
      });

      const minDate = `${monthYear}-01`;
      const maxDate = `${monthYear}-${String(daysInMonth).padStart(2, '0')}`;
      const nextMaxDateObj = new Date(maxDate + 'T00:00:00');
      nextMaxDateObj.setDate(nextMaxDateObj.getDate() + 1);
      const nextMaxDate = nextMaxDateObj.toISOString().split('T')[0];

      const allAttendance = nominaDb.prepare('SELECT timestamp FROM attendance WHERE worker_no = ? AND timestamp >= ? AND timestamp < ?').all(String(workerNo), minDate, nextMaxDate);
      allAttendance.forEach(att => {
        const dStr = att.timestamp.split(' ')[0];
        if (!attendanceByDate[dStr]) attendanceByDate[dStr] = [];
        attendanceByDate[dStr].push(new Date(att.timestamp));
      });
    }

    const statusMap = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${monthYear}-${dStr}`;
      const dayIndex = (d - 1) % 31;
      const turno = workersService.getTurnoOnDate(defaultTurno, rules, dateStr);

      let hoursVal = '8';
      let expectedNumMarcas = 2;

      const templateId = templatesMap[turno];
      if (templateId) {
        const workerDist = distMap[templateId] || {};
        const daysArr = workerDist[monthYear] || workerDist['BASE'];
        if (daysArr) {
          const dayItem = daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
          if (dayItem) {
            const h = Array.isArray(dayItem) ? dayItem[0] : dayItem.hours;
            if (h !== undefined) hoursVal = String(h);
            const numMarks = Array.isArray(dayItem) ? dayItem[3] : dayItem.numMarcas;
            if (numMarks !== undefined) expectedNumMarcas = Number(numMarks) || 2;
          }
        }
      }

      const isRestDay = hoursVal === 'P' || hoursVal === 'p' || hoursVal === '0' || hoursVal === '0.00' || hoursVal === '';

      if (dateStr > yesterdayStr || isRestDay) {
        statusMap[dateStr] = 'gris';
        continue;
      }

      const times = attendanceByDate[dateStr] || [];
      const validTimes = workersService.filterDuplicatePunches(times);

      if (validTimes.length === 0) {
        statusMap[dateStr] = 'rojo';
      } else if (validTimes.length === 1) {
        statusMap[dateStr] = 'amarillo';
      } else {
        statusMap[dateStr] = 'verde';
      }
    }

    if (nominaDb) nominaDb.close();
    res.json(statusMap);
  } catch (err) {
    console.error('Error in /api/workers/calendar:', err);
    res.status(500).json({ error: err.message });
  }
}

function getWorkersIncidents(req, res) {
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
    const nominaDb = workersService.getNominaDb();
    
    const templatesMap = {};
    const distMap = {};
    const attendanceMap = {};

    if (nominaDb) {
      const templates = nominaDb.prepare('SELECT id, name FROM shift_templates').all();
      templates.forEach(t => { templatesMap[t.name] = t.id; });

      const distributions = nominaDb.prepare("SELECT shift_id, year_month, days_json FROM shift_monthly_distributions WHERE year_month = ? OR year_month = 'BASE'").all(monthYear);
      distributions.forEach(d => {
        if (!distMap[d.shift_id]) distMap[d.shift_id] = {};
        try {
          distMap[d.shift_id][d.year_month] = JSON.parse(d.days_json);
        } catch (e) {
          distMap[d.shift_id][d.year_month] = [];
        }
      });

      const nextMaxDateObj = new Date(maxDate + 'T00:00:00');
      nextMaxDateObj.setDate(nextMaxDateObj.getDate() + 1);
      const nextMaxDate = nextMaxDateObj.toISOString().split('T')[0];

      const allAttendance = nominaDb.prepare('SELECT worker_no, timestamp FROM attendance WHERE timestamp >= ? AND timestamp < ?').all(minDate, nextMaxDate);
      allAttendance.forEach(att => {
        const dStr = att.timestamp.split(' ')[0];
        if (!attendanceMap[att.worker_no]) attendanceMap[att.worker_no] = {};
        if (!attendanceMap[att.worker_no][dStr]) attendanceMap[att.worker_no][dStr] = [];
        attendanceMap[att.worker_no][dStr].push(new Date(att.timestamp));
      });
    }

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

        const templateId = templatesMap[turno];
        if (templateId) {
          const workerDist = distMap[templateId] || {};
          const daysArr = workerDist[monthYear] || workerDist['BASE'];
          if (daysArr) {
            const dayItem = daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
            if (dayItem) {
              const h = Array.isArray(dayItem) ? dayItem[0] : dayItem.hours;
              if (h !== undefined) hoursVal = String(h);
              const numMarks = Array.isArray(dayItem) ? dayItem[3] : dayItem.numMarcas;
              if (numMarks !== undefined) expectedNumMarcas = Number(numMarks) || 2;
            }
          }
        }

        const isRestDay = hoursVal === 'P' || hoursVal === 'p' || hoursVal === '0' || hoursVal === '0.00' || hoursVal === '';
        if (isRestDay) continue;

        const times = workerAttendance[dateStr] || [];
        const validTimes = workersService.filterDuplicatePunches(times);

        if (validTimes.length === 0) {
          incidents.push({
            workerNo: worker.no,
            workerNombre: worker.nombre,
            date: dateStr,
            type: 'Ausencia'
          });
        } else if (validTimes.length === 1) {
          incidents.push({
            workerNo: worker.no,
            workerNombre: worker.nombre,
            date: dateStr,
            type: 'Una sola marca'
          });
        }
      }
    }

    if (nominaDb) nominaDb.close();
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
