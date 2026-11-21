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

    const asOf = req.query.asOf || null;
    const workers = asOf
      ? db.prepare(`
          SELECT * FROM workers
          WHERE fecha_baja IS NULL OR fecha_baja = '' OR fecha_baja > ?
          ORDER BY CAST(no AS INTEGER) ASC, no ASC
        `).all(asOf)
      : db.prepare('SELECT * FROM workers ORDER BY CAST(no AS INTEGER) ASC, no ASC').all();
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
      fechaBaja: w.fecha_baja || null,
      rules: rulesMap[w.no] || [],
    }));

    res.json(result);
  } catch (err) {
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

function setWorkerBaja(req, res) {
  const { no } = req.params;
  const { fechaBaja } = req.body || {};
  if (fechaBaja !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fechaBaja || '')) {
    return res.status(400).json({ error: 'fechaBaja debe ser YYYY-MM-DD o null' });
  }
  try {
    const info = db.prepare('UPDATE workers SET fecha_baja = ? WHERE no = ?')
      .run(fechaBaja || null, no);
    if (!info.changes) return res.status(404).json({ error: 'Trabajador no encontrado' });
    res.json({ message: 'Baja registrada con éxito.', no, fechaBaja: fechaBaja || null });
  } catch (err) {
    console.error('[workers-service] Error in setWorkerBaja:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getWorkers,
  getWorkerCalendar,
  addWorkerRule,
  deleteRule,
  setWorkerBaja,
};
