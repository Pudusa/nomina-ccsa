const db = require('../database.cjs');

function getShiftTemplates(req, res) {
  try {
    const { year_month } = req.query;
    const targetMonth = year_month || 'BASE';
    
    // Pre-fetch all templates
    const templates = db.prepare('SELECT * FROM shift_templates').all();
    
    // Pre-fetch all distributions for robust fallback across past/future months
    const allDistributions = db.prepare(`
      SELECT shift_id, year_month, days_json 
      FROM shift_monthly_distributions
    `).all();

    // Group distributions by shift_id
    const distMap = {};
    allDistributions.forEach(d => {
      if (!distMap[d.shift_id]) distMap[d.shift_id] = {};
      distMap[d.shift_id][d.year_month] = d.days_json;
    });

    const result = {};

    templates.forEach((t) => {
      const shiftDists = distMap[t.id] || {};
      let days_json = shiftDists[targetMonth] || shiftDists['BASE'];
      if (!days_json) {
        const availableMonths = Object.keys(shiftDists);
        if (availableMonths.length > 0) {
          days_json = shiftDists[availableMonths[0]];
        }
      }

      if (days_json) {
        try {
          const parsed = JSON.parse(days_json);
          if (Array.isArray(parsed)) {
            parsed.sort((a, b) => {
              const dayA = Array.isArray(a) ? (a[2] !== undefined ? a[2] : 0) : (a.dayIndex !== undefined ? a.dayIndex : 0);
              const dayB = Array.isArray(b) ? (b[2] !== undefined ? b[2] : 0) : (b.dayIndex !== undefined ? b.dayIndex : 0);
              return dayA - dayB;
            });
          }
          result[t.name] = parsed.map(item => {
            const hours = Array.isArray(item) ? item[0] : item.hours;
            const markDirection = Array.isArray(item) ? item[1] : item.markDirection;
            const dayIndex = Array.isArray(item) ? item[2] : (item.dayIndex !== undefined ? item.dayIndex : 0);
            const numMarcas = Array.isArray(item) ? item[3] : (item.numMarcas !== undefined ? item.numMarcas : 2);
            return {
              dayIndex,
              hours: isNaN(Number(hours)) ? hours : Number(hours),
              markDirection: markDirection || 'entrada',
              numMarcas: numMarcas !== undefined ? Number(numMarcas) : 2,
            };
          });
        } catch (e) {
          result[t.name] = [];
        }
      } else {
        result[t.name] = [];
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function saveShiftTemplate(req, res) {
  try {
    const { name, days, yearMonth } = req.body;
    if (!name || !days || !Array.isArray(days)) {
      return res.status(400).json({ error: 'Nombre y días del turno son requeridos.' });
    }

    const ym = yearMonth || 'BASE';

    const insertOrIgnore = db.prepare('INSERT OR IGNORE INTO shift_templates (name) VALUES (?)');
    insertOrIgnore.run(name);

    const templateRow = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(name);
    const shiftId = templateRow.id;

    const tuples = days.map((d, idx) => {
      const item = d || {};
      return [
        item.hours !== undefined ? item.hours : 'P',
        item.markDirection || 'entrada',
        item.dayIndex !== undefined ? item.dayIndex : idx,
        item.numMarcas !== undefined ? Number(item.numMarcas) : 2
      ];
    });

    const existing = db.prepare('SELECT id FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ?').get(shiftId, ym);
    if (existing) {
      db.prepare('UPDATE shift_monthly_distributions SET days_json = ? WHERE id = ?').run(JSON.stringify(tuples), existing.id);
    } else {
      db.prepare('INSERT INTO shift_monthly_distributions (shift_id, year_month, days_json) VALUES (?, ?, ?)').run(shiftId, ym, JSON.stringify(tuples));
    }

    res.json({ message: 'Turno guardado con éxito en la base de datos.' });
  } catch (err) {
    console.error('Error al guardar shift template:', err);
    res.status(500).json({ error: err.message });
  }
}

function deleteShiftTemplate(req, res) {
  try {
    const { name } = req.params;
    db.prepare('DELETE FROM shift_templates WHERE name = ?').run(name);
    res.json({ message: 'Turno eliminado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function assignShift(req, res) {
  try {
    const { worker_nos, shift_name, assignment_type, start_date, end_date, reason } = req.body;
    if (!worker_nos || !shift_name || !assignment_type || !start_date) {
      return res.status(400).json({ error: 'worker_nos, shift_name, assignment_type y start_date son requeridos.' });
    }

    const workers = Array.isArray(worker_nos) ? worker_nos : [worker_nos];
    const template = db.prepare('SELECT id FROM shift_templates WHERE name = ?').get(shift_name);
    if (!template) {
      return res.status(404).json({ error: `Turno '${shift_name}' no encontrado.` });
    }
    const shiftId = template.id;
    const performedBy = req.user?.username || req.user?.email || 'admin';

    const insertAssignment = db.prepare(`
      INSERT INTO shift_assignments (worker_no, shift_id, assignment_type, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertAudit = db.prepare(`
      INSERT INTO shift_audit_history (worker_no, previous_shift_id, new_shift_id, assignment_type, effective_start_date, effective_end_date, reason, performed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (const wNo of workers) {
        const prevActive = db.prepare(`
          SELECT shift_id FROM shift_assignments 
          WHERE worker_no = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
          ORDER BY start_date DESC LIMIT 1
        `).get(wNo, start_date, start_date);

        const prevShiftId = prevActive ? prevActive.shift_id : null;

        insertAssignment.run(wNo, shiftId, assignment_type, start_date, end_date || null);
        insertAudit.run(wNo, prevShiftId, shiftId, assignment_type, start_date, end_date || null, reason || 'Asignación de turno', performedBy);
      }
    });

    tx();
    res.json({ message: 'Asignación y auditoría de turno registrada con éxito.' });
  } catch (err) {
    console.error('Error al asignar turno:', err);
    res.status(500).json({ error: err.message });
  }
}

function getShiftAssignments(req, res) {
  try {
    const { worker_no } = req.query;
    let query = 'SELECT sa.*, st.name as shift_name FROM shift_assignments sa JOIN shift_templates st ON sa.shift_id = st.id';
    let params = [];
    if (worker_no) {
      query += ' WHERE sa.worker_no = ?';
      params.push(worker_no);
    }
    query += ' ORDER BY sa.start_date DESC';
    const assignments = db.prepare(query).all(...params);

    let auditQuery = 'SELECT sah.*, st_prev.name as previous_shift_name, st_new.name as new_shift_name FROM shift_audit_history sah LEFT JOIN shift_templates st_prev ON sah.previous_shift_id = st_prev.id JOIN shift_templates st_new ON sah.new_shift_id = st_new.id';
    let auditParams = [];
    if (worker_no) {
      auditQuery += ' WHERE sah.worker_no = ?';
      auditParams.push(worker_no);
    }
    auditQuery += ' ORDER BY sah.registered_at DESC LIMIT 100';
    const auditLogs = db.prepare(auditQuery).all(...auditParams);

    res.json({ assignments, auditLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getShiftTemplates,
  saveShiftTemplate,
  deleteShiftTemplate,
  assignShift,
  getShiftAssignments,
};
