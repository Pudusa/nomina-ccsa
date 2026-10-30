const db = require('../database.cjs');
const attendanceService = require('./attendance.service.cjs');

function getDefaultTemplateName() {
  return 'Sin turno';
}

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

function cleanupExpiredRules() {
  try {
    normalizeWorkerTurnos();
    const todayStr = attendanceService.formatDateKey(new Date());

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

module.exports = {
  getDefaultTemplateName,
  normalizeWorkerTurnos,
  cleanupExpiredRules,
  getTurnoOnDate,
};
