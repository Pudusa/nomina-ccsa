// Única fuente de verdad para decidir el estado de asistencia de un trabajador
// en un día. Lo consumen attendance-service, workers-service y el frontend
// (a través de los endpoints), de modo que las tres vistas coincidan siempre.

const STATUS = Object.freeze({
  DESCANSO: 'descanso',
  PENDIENTE: 'pendiente',
  AUSENTE: 'ausente',
  INCOMPLETO: 'incompleto',
  PRESENTE: 'presente',
  FUERA_DE_TURNO: 'fuera_de_turno',
});

const REST_HOUR_CODES = new Set(['', 'p', 'd', 'descanso', 'libre', '0', '0.00']);

const CATEGORY_BY_INCIDENCE = Object.freeze({
  'Falta injustificada': 'Ausencia',
  'Falta salida injustificada': 'Falta marca',
  'Falta entrada injustificada': 'Falta marca',
  'Fuera de turno': 'Fuera de turno',
});

function isRestHourCode(value) {
  return REST_HOUR_CODES.has(String(value ?? '').trim().toLowerCase());
}

function hasNoTurno(turno) {
  const t = String(turno ?? '').trim().toLowerCase();
  return t === '' || t === 'sin turno';
}

function validMarks(marcas) {
  if (!Array.isArray(marcas)) return [];
  return marcas.filter((m) => m instanceof Date && !isNaN(m.getTime()));
}

function evaluateAttendanceDay({
  date = '',
  turno = '',
  hours,
  numMarcas = 2,
  marcas = [],
  today = '',
} = {}) {
  const marks = validMarks(marcas);
  const count = marks.length;

  const parsedNum = Number(numMarcas);
  const expectedNumMarcas = Number.isFinite(parsedNum) && parsedNum >= 0
    ? Math.trunc(parsedNum)
    : 2;

  const parsedHours = parseFloat(hours);
  const expectedHours = Number.isFinite(parsedHours) ? parsedHours : 0;

  // La plantilla manda: domingo/sábado y palabras como "vacaciones" no cuentan.
  const isRestDay = hasNoTurno(turno) || isRestHourCode(hours) || expectedNumMarcas === 0;

  let workedHours = 0;
  if (count >= 2) {
    workedHours = Math.max(0, (marks[count - 1].getTime() - marks[0].getTime()) / 3600000);
  }
  const overtimeHours = !isRestDay && workedHours > expectedHours
    ? Math.round((workedHours - expectedHours) * 10) / 10
    : 0;

  let status;
  let incidencia = null;

  if (isRestDay) {
    if (count > 0) {
      status = STATUS.FUERA_DE_TURNO;
      incidencia = 'Fuera de turno';
    } else {
      status = STATUS.DESCANSO;
    }
  } else if (count === 0 && today && String(date) >= String(today)) {
    status = STATUS.PENDIENTE;
  } else if (count === 0) {
    status = STATUS.AUSENTE;
    incidencia = 'Falta injustificada';
  } else if (count < expectedNumMarcas) {
    status = STATUS.INCOMPLETO;
    incidencia = marks[0].getHours() < 12
      ? 'Falta salida injustificada'
      : 'Falta entrada injustificada';
  } else if (count > expectedNumMarcas) {
    status = STATUS.FUERA_DE_TURNO;
    incidencia = 'Fuera de turno';
  } else {
    status = STATUS.PRESENTE;
  }

  return {
    status,
    isRestDay,
    hasMark: count > 0,
    expectedNumMarcas,
    expectedHours,
    workedHours: Math.round(workedHours * 10) / 10,
    overtimeHours,
    incidencia,
    categoria: incidencia ? CATEGORY_BY_INCIDENCE[incidencia] || null : null,
  };
}

function todayDateString(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function statusToWorkerStatus(status) {
  const map = {
    [STATUS.PRESENTE]: 'verde',
    [STATUS.INCOMPLETO]: 'amarillo',
    [STATUS.AUSENTE]: 'rojo',
    [STATUS.PENDIENTE]: 'gris',
    [STATUS.DESCANSO]: 'gris',
    [STATUS.FUERA_DE_TURNO]: 'fuera_de_turno',
  };
  return map[status] || 'gris';
}

module.exports = {
  STATUS,
  evaluateAttendanceDay,
  statusToWorkerStatus,
  isRestHourCode,
  todayDateString,
};
