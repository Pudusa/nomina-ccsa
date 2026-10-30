const db = require('../database.cjs');
const workersService = require('../services/workers.service.cjs');
const attendanceService = require('../services/attendance.service.cjs');

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

    const workers = db.prepare('SELECT * FROM workers').all();
    const rules = db.prepare('SELECT * FROM shift_rules').all();
    const rulesMap = {};
    rules.forEach((r) => {
      if (!rulesMap[r.worker_no]) rulesMap[r.worker_no] = [];
      rulesMap[r.worker_no].push(r);
    });
    const defaultFallback = workersService.getDefaultTemplateName();

    const statsMap = {};

    for (const worker of workers) {
      let singleMarks = 0;
      let absences = 0;
      const workerRules = rulesMap[worker.no] || [];
      const defaultTurno = worker.default_turno || defaultFallback;

      for (let idx = 0; idx < dateStrs.length; idx++) {
        const dateStr = dateStrs[idx];
        const dayNum = startDay + idx;
        const dayIndex = (dayNum - 1) % 31;
        const turno = workersService.getTurnoOnDate(defaultTurno, workerRules, dateStr);

        const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(turno);
        let hoursVal = '8';
        let expectedNumMarcas = 2;

        if (templateRow) {
          let dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateRow.id, monthYear);
          if (!dist) {
            dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateRow.id, 'BASE');
          }
          if (dist && dist.days_json) {
            try {
              const daysArr = JSON.parse(dist.days_json);
              const dayItem = daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
              if (dayItem) {
                const h = Array.isArray(dayItem) ? dayItem[0] : dayItem.hours;
                if (h !== undefined) hoursVal = String(h);
                const numMarks = Array.isArray(dayItem) ? dayItem[3] : dayItem.numMarcas;
                if (numMarks !== undefined) expectedNumMarcas = Number(numMarks) || 2;
              }
            } catch (e) {}
          }
        }

        const isRestDay = hoursVal === 'P' || hoursVal === 'p' || hoursVal === '0' || hoursVal === '0.00' || hoursVal === '';
        if (isRestDay) continue;

        const records = db.prepare('SELECT * FROM attendance WHERE worker_no = ? AND timestamp LIKE ?').all(worker.no, dateStr + '%');
        const validTimes = attendanceService.filterDuplicatePunches(records.map(r => new Date(r.timestamp)));

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

    const rules = db.prepare('SELECT * FROM shift_rules WHERE worker_no = ?').all(workerNo);
    const defaultFallback = workersService.getDefaultTemplateName();
    const defaultTurno = worker.default_turno || defaultFallback;

    const statusMap = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${monthYear}-${dStr}`;
      const dayIndex = (d - 1) % 31;
      const turno = workersService.getTurnoOnDate(defaultTurno, rules, dateStr);

      const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(turno);
      let hoursVal = '8';
      let expectedNumMarcas = 2;

      if (templateRow) {
        let dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateRow.id, monthYear);
        if (!dist) {
          dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(templateRow.id, 'BASE');
        }
        if (dist && dist.days_json) {
          try {
            const daysArr = JSON.parse(dist.days_json);
            const dayItem = daysArr.find(item => (Array.isArray(item) ? item[2] === dayIndex : item.dayIndex === dayIndex));
            if (dayItem) {
              const h = Array.isArray(dayItem) ? dayItem[0] : dayItem.hours;
              if (h !== undefined) hoursVal = String(h);
              const numMarks = Array.isArray(dayItem) ? dayItem[3] : dayItem.numMarcas;
              if (numMarks !== undefined) expectedNumMarcas = Number(numMarks) || 2;
            }
          } catch (e) {}
        }
      }

      const isRestDay = hoursVal === 'P' || hoursVal === 'p' || hoursVal === '0' || hoursVal === '0.00' || hoursVal === '';

      if (dateStr > yesterdayStr || isRestDay) {
        statusMap[dateStr] = 'gris';
        continue;
      }

      const records = db.prepare('SELECT * FROM attendance WHERE worker_no = ? AND timestamp LIKE ?').all(workerNo, dateStr + '%');
      const validTimes = attendanceService.filterDuplicatePunches(records.map(r => new Date(r.timestamp)));

      if (validTimes.length === 0) {
        statusMap[dateStr] = 'rojo';
      } else if (validTimes.length === 1) {
        if (expectedNumMarcas === 1) {
          statusMap[dateStr] = 'verde';
        } else {
          statusMap[dateStr] = 'amarillo';
        }
      } else {
        statusMap[dateStr] = 'verde';
      }
    }

    res.json(statusMap);
  } catch (err) {
    console.error('Error in /api/workers/calendar:', err);
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
  addWorkerRule,
  deleteRule,
};
