const db = require('../database.cjs');

function getShiftTemplates(req, res) {
  try {
    const { year_month } = req.query;
    const targetMonth = year_month || 'BASE';
    const templates = db.prepare('SELECT * FROM shift_templates').all();
    const result = {};

    templates.forEach((t) => {
      let dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(t.id, targetMonth);
      if (!dist && targetMonth !== 'BASE') {
        dist = db.prepare('SELECT days_json FROM shift_monthly_distributions WHERE shift_id = ? AND year_month = ? ORDER BY id DESC').get(t.id, 'BASE');
      }

      if (dist && dist.days_json) {
        try {
          const parsed = JSON.parse(dist.days_json);
          result[t.name] = parsed.map(item => {
            const hours = Array.isArray(item) ? item[0] : item.hours;
            const markDirection = Array.isArray(item) ? item[1] : item.markDirection;
            const numMarcas = Array.isArray(item) ? item[3] : (item.numMarcas !== undefined ? item.numMarcas : 2);
            return {
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
