const db = require('../database.cjs');
const Database = require('better-sqlite3');
const path = require('path');

function getNominaDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../workers.sqlite');
  const nominaPath = path.join(path.dirname(dbPath), 'nomina.db');
  if (require('fs').existsSync(nominaPath)) {
    return new Database(nominaPath, { readonly: true });
  }
  return null;
}

function formatDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function filterDuplicatePunches(dates) {
  if (!dates || dates.length === 0) return [];
  const sorted = [...dates].sort((a, b) => a - b);
  const filtered = [];
  let lastTime = null;
  for (const d of sorted) {
    if (!lastTime || (d - lastTime) >= 3 * 60 * 1000) {
      filtered.push(d);
      lastTime = d;
    }
  }
  return filtered;
}

function getDefaultTemplateName() {
  return 'Sin turno';
}

function normalizeWorkerTurnos() {
  try {
    const workers = db.prepare('SELECT no, default_turno FROM workers').all();
    const updateStmt = db.prepare('UPDATE workers SET default_turno = ? WHERE no = ?');
    for (const w of workers) {
      if (!w.default_turno || w.default_turno.trim() === '' || w.default_turno.trim().toLowerCase() === 'sin turno') {
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
    const todayStr = formatDateKey(new Date());

    const activeTotalRules = db.prepare(`
      SELECT * FROM shift_rules WHERE type = 'total' AND start_date <= ?
    `).all(todayStr);

    const updateDefaultTurno = db.prepare('UPDATE workers SET default_turno = ? WHERE no = ?');
    const deleteRule = db.prepare('DELETE FROM shift_rules WHERE id = ?');

    for (const r of activeTotalRules) {
      updateDefaultTurno.run(r.turno, r.worker_no);
      deleteRule.run(r.id);
    }
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
  getNominaDb,
  formatDateKey,
  filterDuplicatePunches,
  getDefaultTemplateName,
  normalizeWorkerTurnos,
  cleanupExpiredRules,
  getTurnoOnDate,
};
