import { describe, it, expect } from 'vitest';
import {
    classifyPunches,
    filterDuplicatePunches,
    formatDateTime,
    formatDateKey,
} from '../services/attendance.service.cjs';

const at = (h, m = 0) => new Date(2026, 9, 29, h, m, 0);

describe('classifyPunches — 10 casos', () => {
    it('1: sin marcas -> todos null', () => {
        expect(classifyPunches([], 'Turno 1', 'entrada', 2)).toEqual({
            entradaMañana: null, salidaMañana: null, entradaTarde: null, salidaTarde: null, marca1: null, marca2: null,
        });
    });
    it('2: una marca entrada mañana (numMarcas=1)', () => {
        const r = classifyPunches([at(8)], 'Turno 1', 'entrada', 1);
        expect(r.entradaMañana).toBe('2026-10-29 08:00:00');
        expect(r.entradaTarde).toBeNull();
    });
    it('3: una marca entrada tarde (numMarcas=1)', () => {
        const r = classifyPunches([at(14)], 'Turno 1', 'entrada', 1);
        expect(r.entradaTarde).toBe('2026-10-29 14:00:00');
        expect(r.entradaMañana).toBeNull();
    });
    it('4: una marca salida mañana (salida primero)', () => {
        const r = classifyPunches([at(8)], 'Turno 2', 'salida', 1);
        expect(r.salidaMañana).toBe('2026-10-29 08:00:00');
        expect(r.entradaMañana).toBeNull();
    });
    it('5: dos marcas normales mañana/tarde', () => {
        const r = classifyPunches([at(8), at(17)], 'Turno 1', 'entrada', 2);
        expect(r.entradaMañana).toBe('2026-10-29 08:00:00');
        expect(r.salidaTarde).toBe('2026-10-29 17:00:00');
        expect(r.marca2).toBe('2026-10-29 17:00:00');
    });
    it('6: salida primero con entrada tarde (bug del turno nocturno)', () => {
        const r = classifyPunches([at(8), at(14)], 'Turno 2', 'salida', 2);
        expect(r.salidaMañana).toBe('2026-10-29 08:00:00');
        expect(r.entradaTarde).toBe('2026-10-29 14:00:00');
        expect(r.salidaTarde).toBeNull();
    });
    it('7: turno nocturno por nombre aunque markDir diga entrada', () => {
        const r = classifyPunches([at(8), at(14)], 'Nocturno', 'entrada', 2);
        expect(r.salidaMañana).toBe('2026-10-29 08:00:00');
        expect(r.entradaTarde).toBe('2026-10-29 14:00:00');
    });
    it('8: marca2 es null cuando numMarcas=1 aunque haya 2 marcas', () => {
        const r = classifyPunches([at(8), at(17)], 'Turno 1', 'entrada', 1);
        expect(r.marca1).toBe('2026-10-29 08:00:00');
        expect(r.marca2).toBeNull();
    });
    it('9: marca a las 12:30 se considera tarde (frontera)', () => {
        const r = classifyPunches([at(12, 30)], 'Turno 1', 'entrada', 1);
        expect(r.entradaTarde).toBe('2026-10-29 12:30:00');
    });
    it('10: marca a las 12:29 se considera mañana (frontera)', () => {
        const r = classifyPunches([at(12, 29)], 'Turno 1', 'entrada', 1);
        expect(r.entradaMañana).toBe('2026-10-29 12:29:00');
    });
});

describe('filterDuplicatePunches — 10 casos', () => {
    it('1: array vacio', () => expect(filterDuplicatePunches([])).toEqual([]));
    it('2: una sola marca intacta', () => expect(filterDuplicatePunches([at(8)])).toEqual([at(8)]));
    it('3: dos marcas a 15 min -> se descarta la segunda', () => {
        expect(filterDuplicatePunches([at(8, 0), at(8, 15)])).toEqual([at(8, 0)]);
    });
    it('4: dos marcas a 29 min -> se descarta', () => {
        expect(filterDuplicatePunches([at(8, 0), at(8, 29)])).toEqual([at(8, 0)]);
    });
    it('5: dos marcas a 30 min exactos -> se conservan', () => {
        expect(filterDuplicatePunches([at(8, 0), at(8, 30)])).toEqual([at(8, 0), at(8, 30)]);
    });
    it('6: tres marcas 0/15/60 -> conserva 0 y 60', () => {
        expect(filterDuplicatePunches([at(8, 0), at(8, 15), at(9, 0)])).toEqual([at(8, 0), at(9, 0)]);
    });
    it('7: marcas identicas -> conserva una', () => {
        expect(filterDuplicatePunches([at(8), at(8), at(8)])).toEqual([at(8)]);
    });
    it('8: todas separadas -> conserva todas', () => {
        expect(filterDuplicatePunches([at(8), at(9), at(10)])).toEqual([at(8), at(9), at(10)]);
    });
    it('9: null se devuelve tal cual', () => expect(filterDuplicatePunches(null)).toBeNull());
    it('10: gap acumulado desde el ultimo aceptado (0/20/50) -> conserva 0 y 50', () => {
        expect(filterDuplicatePunches([at(8, 0), at(8, 20), at(8, 50)])).toEqual([at(8, 0), at(8, 50)]);
    });
});

describe('formatDateTime — 10 casos', () => {
    it('1: fecha con ceros a la izquierda', () => expect(formatDateTime(at(8, 5))).toBe('2026-10-29 08:05:00'));
    it('2: medianoche', () => expect(formatDateTime(at(0, 0))).toBe('2026-10-29 00:00:00'));
    it('3: final del dia', () => expect(formatDateTime(new Date(2026, 9, 29, 23, 59, 59))).toBe('2026-10-29 23:59:59'));
    it('4: primer dia del mes', () => expect(formatDateTime(new Date(2026, 0, 1, 1, 2, 3))).toBe('2026-01-01 01:02:03'));
    it('5: ultimo dia del ano', () => expect(formatDateTime(new Date(2026, 11, 31, 12, 0, 0))).toBe('2026-12-31 12:00:00'));
    it('6: null', () => expect(formatDateTime(null)).toBeNull());
    it('7: undefined', () => expect(formatDateTime(undefined)).toBeNull());
    it('8: fecha invalida', () => expect(formatDateTime(new Date('no'))).toBeNull());
    it('9: string no es Date', () => expect(formatDateTime('2026-10-29')).toBeNull());
    it('10: numero', () => expect(formatDateTime(123)).toBeNull());
});

describe('formatDateKey — 10 casos', () => {
    it('1: fecha normal', () => expect(formatDateKey(new Date(2026, 9, 29))).toBe('2026-10-29'));
    it('2: enero', () => expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05'));
    it('3: diciembre', () => expect(formatDateKey(new Date(2026, 11, 31))).toBe('2026-12-31'));
    it('4: dia single digit', () => expect(formatDateKey(new Date(2026, 8, 2))).toBe('2026-09-02'));
    it('5: ano bisiesto', () => expect(formatDateKey(new Date(2024, 1, 29))).toBe('2024-02-29'));
    it('6: con hora no altera la fecha', () => expect(formatDateKey(new Date(2026, 9, 29, 23, 59))).toBe('2026-10-29'));
    it('7: medianoche', () => expect(formatDateKey(new Date(2026, 9, 29, 0, 0))).toBe('2026-10-29'));
    it('8: ano 2000', () => expect(formatDateKey(new Date(2000, 0, 1))).toBe('2000-01-01'));
    it('9: primer dia del mes', () => expect(formatDateKey(new Date(2026, 5, 1))).toBe('2026-06-01'));
    it('10: ultimo dia de febrero no bisiesto', () => expect(formatDateKey(new Date(2026, 1, 28))).toBe('2026-02-28'));
});
