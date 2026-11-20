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

async function getShiftData(authHeader, yearMonth) {
  const url = yearMonth
    ? `${SHIFTS_URL}/api/shift-templates?year_month=${encodeURIComponent(yearMonth)}`
    : `${SHIFTS_URL}/api/shift-templates`;
  const data = await getJson(url, authHeader);
  // GET /api/shift-templates devuelve { [nombre]: [{ dayIndex, hours, markDirection, numMarcas }] }
  // Lo adaptamos al formato de tuplas [hours, markDirection, dayIndex, numMarcas] que usa el controlador.
  const templates = [];
  const distributions = [];
  let id = 1;
  for (const [name, days] of Object.entries(data)) {
    const shiftId = id++;
    templates.push({ id: shiftId, name });
    const tuples = days.map((d) => [
      d.hours,
      d.markDirection,
      d.dayIndex,
      d.numMarcas,
    ]);
    distributions.push({ shift_id: shiftId, year_month: yearMonth || 'BASE', days_json: JSON.stringify(tuples) });
  }
  return { templates, distributions };
}

module.exports = { getWorkers, getShiftData };
