import { describe, it, expect } from 'vitest';
import { evaluateAttendanceDay, statusToWorkerStatus, STATUS } from '../attendance-status.cjs';

const PAST = '2026-11-13';
const TODAY = '2026-11-20';
const at = (h, m = 0) => new Date(2026, 10, 20, h, m);
const base = (overrides = {}) => ({
  date: PAST,
  turno: 'TURNO FIJO',
  hours: 8,
  numMarcas: 2,
  marcas: [],
  today: TODAY,
  ...overrides,
});

describe('evaluateAttendanceDay — 10 casos de aceptación', () => {
  it('1: dos marcas en día laborable = presente', () => {
    const r = evaluateAttendanceDay(base({ marcas: [at(8), at(17)] }));
    expect(r.status).toBe(STATUS.PRESENTE);
    expect(r.hasMark).toBe(true);
    expect(r.incidencia).toBeNull();
  });

  it('2: cero marcas en día laborable pasado = ausente con incidencia', () => {
    const r = evaluateAttendanceDay(base());
    expect(r.status).toBe(STATUS.AUSENTE);
    expect(r.incidencia).toBe('Falta injustificada');
    expect(r.categoria).toBe('Ausencia');
  });

  it('3: una marca por la mañana = incompleto, falta salida', () => {
    const r = evaluateAttendanceDay(base({ marcas: [at(8, 30)] }));
    expect(r.status).toBe(STATUS.INCOMPLETO);
    expect(r.incidencia).toBe('Falta salida injustificada');
    expect(r.categoria).toBe('Falta marca');
  });

  it('4: una marca por la tarde = incompleto, falta entrada', () => {
    const r = evaluateAttendanceDay(base({ marcas: [at(14)] }));
    expect(r.status).toBe(STATUS.INCOMPLETO);
    expect(r.incidencia).toBe('Falta entrada injustificada');
  });

  it('5: horas P = descanso sin incidencia', () => {
    const r = evaluateAttendanceDay(base({ hours: 'P' }));
    expect(r.status).toBe(STATUS.DESCANSO);
    expect(r.isRestDay).toBe(true);
    expect(r.incidencia).toBeNull();
  });

  it('6: marcas en día de descanso = fuera de turno', () => {
    const r = evaluateAttendanceDay(base({ hours: 'P', marcas: [at(10)] }));
    expect(r.status).toBe(STATUS.FUERA_DE_TURNO);
    expect(r.incidencia).toBe('Fuera de turno');
    expect(r.categoria).toBe('Fuera de turno');
  });

  it('7: hoy sin marcas = pendiente, no ausente', () => {
    const r = evaluateAttendanceDay(base({ date: TODAY }));
    expect(r.status).toBe(STATUS.PENDIENTE);
    expect(r.incidencia).toBeNull();
  });

  it('8: una marca esperada con una marca = presente', () => {
    const r = evaluateAttendanceDay(base({ numMarcas: 1, marcas: [at(9)] }));
    expect(r.status).toBe(STATUS.PRESENTE);
  });

  it('9: más marcas de las esperadas = fuera de turno', () => {
    const r = evaluateAttendanceDay(base({ numMarcas: 1, marcas: [at(8), at(17)] }));
    expect(r.status).toBe(STATUS.FUERA_DE_TURNO);
  });

  it('10: calcula horas trabajadas y horas extra', () => {
    const r = evaluateAttendanceDay(base({ hours: 8, marcas: [at(8), at(18)] }));
    expect(r.workedHours).toBe(10);
    expect(r.overtimeHours).toBe(2);
    expect(r.expectedHours).toBe(8);
  });
});

describe('evaluateAttendanceDay — 10 casos de rechazo / robustez', () => {
  it('11: marcas ausentes no lanza y cuenta cero', () => {
    const r = evaluateAttendanceDay(base({ marcas: undefined }));
    expect(r.status).toBe(STATUS.AUSENTE);
    expect(r.hasMark).toBe(false);
  });

  it('12: marcas inválidas se descartan', () => {
    const r = evaluateAttendanceDay(base({ marcas: [null, 'x', at(8)] }));
    expect(r.status).toBe(STATUS.INCOMPLETO);
  });

  it('13: numMarcas no numérico usa 2 por defecto', () => {
    const r = evaluateAttendanceDay(base({ numMarcas: 'abc' }));
    expect(r.expectedNumMarcas).toBe(2);
  });

  it('14: numMarcas negativo usa 2 por defecto', () => {
    const r = evaluateAttendanceDay(base({ numMarcas: -1 }));
    expect(r.expectedNumMarcas).toBe(2);
  });

  it('15: horas ausentes no lanzan y se tratan como descanso', () => {
    const r = evaluateAttendanceDay(base({ hours: undefined }));
    expect(r.status).toBe(STATUS.DESCANSO);
  });

  it('16: turno nulo = descanso', () => {
    expect(evaluateAttendanceDay(base({ turno: null })).status).toBe(STATUS.DESCANSO);
  });

  it('17: turno vacío = descanso', () => {
    expect(evaluateAttendanceDay(base({ turno: '   ' })).status).toBe(STATUS.DESCANSO);
  });

  it('18: turno "sin turno" = descanso', () => {
    expect(evaluateAttendanceDay(base({ turno: 'Sin Turno' })).status).toBe(STATUS.DESCANSO);
  });

  it('19: fechas inválidas no lanzan', () => {
    const r = evaluateAttendanceDay(base({ date: undefined, today: undefined }));
    expect(r.status).toBe(STATUS.AUSENTE);
  });

  it('20: objeto vacío no lanza', () => {
    const r = evaluateAttendanceDay();
    expect(r.status).toBe(STATUS.DESCANSO);
  });
});

describe('regresión de las inconsistencias detectadas', () => {
  it('21: domingo con plantilla de 8h es laborable (la plantilla manda)', () => {
    const r = evaluateAttendanceDay(base({ date: '2026-11-15' })); // domingo
    expect(r.isRestDay).toBe(false);
    expect(r.status).toBe(STATUS.AUSENTE);
  });

  it('22: turno "VACACIONES" con horas ya no es descanso automático', () => {
    const r = evaluateAttendanceDay(base({ turno: 'VACACIONES' }));
    expect(r.isRestDay).toBe(false);
    expect(r.status).toBe(STATUS.AUSENTE);
  });

  it('23: sábado con horas "8" es laborable', () => {
    const r = evaluateAttendanceDay(base({ date: '2026-11-14', hours: '8' })); // sábado
    expect(r.isRestDay).toBe(false);
  });

  it('24: una marca deja de ser "presente" y mapea a amarillo en el calendario', () => {
    const r = evaluateAttendanceDay(base({ marcas: [at(8)] }));
    expect(r.status).toBe(STATUS.INCOMPLETO);
    expect(statusToWorkerStatus(r.status)).toBe('amarillo');
  });
});
