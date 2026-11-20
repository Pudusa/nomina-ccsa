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

module.exports = {
  getShiftTemplates,
  saveShiftTemplate,
  deleteShiftTemplate,
};
