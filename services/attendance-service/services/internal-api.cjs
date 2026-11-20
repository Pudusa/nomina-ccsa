// Cliente HTTP interno: el attendance-service pide datos a los servicios dueños
// en vez de leer sus bases de datos directamente.
const WORKERS_URL = process.env.WORKERS_SERVICE_URL || 'http://workers-service:3002';
const SHIFTS_URL = process.env.SHIFTS_SERVICE_URL || 'http://shifts-service:3004';

async function getJson(url, authHeader) {
  const headers = {};
  if (authHeader) headers.Authorization = authHeader;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al consultar ${url}`);
  }
  return res.json();
}

async function getWorkers(authHeader) {
  const data = await getJson(`${WORKERS_URL}/api/workers`, authHeader);
  // GET /api/workers devuelve [{ no, nombre, defaultTurno, departamento, rules: [...] }]
  return data.map((w) => ({
    no: String(w.no),
    nombre: w.nombre,
    default_turno: w.defaultTurno,
    rules: w.rules || [],
  }));
}

async function getShiftData(authHeader, yearMonths) {
  // yearMonths puede ser un string, un array de meses, o vacío (=> BASE).
  const months = Array.isArray(yearMonths) ? yearMonths : [yearMonths || 'BASE'];
  const templates = [];
  const distributions = [];
  const idsByName = new Map();

  for (const month of months) {
    const url = `${SHIFTS_URL}/api/shift-templates?year_month=${encodeURIComponent(month)}`;
    const data = await getJson(url, authHeader);
    // GET /api/shift-templates devuelve { [nombre]: [{ dayIndex, hours, markDirection, numMarcas }] }
    // Ordenamos por nombre para que los ids sintéticos sean iguales en todas las llamadas.
    const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, days] of entries) {
      if (!idsByName.has(name)) {
        const shiftId = idsByName.size + 1;
        idsByName.set(name, shiftId);
        templates.push({ id: shiftId, name });
      }
      const tuples = days.map((d) => [d.hours, d.markDirection, d.dayIndex, d.numMarcas]);
      distributions.push({ shift_id: idsByName.get(name), year_month: month, days_json: JSON.stringify(tuples) });
    }
  }
  return { templates, distributions };
}

module.exports = { getWorkers, getShiftData };
