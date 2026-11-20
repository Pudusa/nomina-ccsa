import { describe, it, expect } from 'vitest';
import {
    parseToDate,
    parseAttendanceRecord,
    formatDateKey,
    formatDateTime,
    filterDuplicatePunches,
    classifyPunches,
} from '../services/attendance.service.cjs';

describe('Attendance Service Unit Tests (Microservice)', () => {
    describe('formatDateKey', () => {
        it('formats date correctly into YYYY-MM-DD', () => {
            const date = new Date(2026, 9, 29); // October 29, 2026
            expect(formatDateKey(date)).toBe('2026-10-29');
        });
    });

    describe('filterDuplicatePunches', () => {
        it('returns empty array or single element unchanged', () => {
            expect(filterDuplicatePunches([])).toEqual([]);
            const d = new Date();
            expect(filterDuplicatePunches([d])).toEqual([d]);
        });

        it('filters out punches within 30 minutes gap', () => {
            const t1 = new Date('2026-10-29T08:00:00Z');
            const t2 = new Date('2026-10-29T08:15:00Z'); // 15 mins later (filtered out)
            const t3 = new Date('2026-10-29T12:00:00Z'); // 4 hours later (kept)

            const filtered = filterDuplicatePunches([t1, t2, t3]);
            expect(filtered).toEqual([t1, t3]);
        });
    });

    describe('classifyPunches', () => {
        it('classifies morning entry and exit correctly with 2 expected marks', () => {
            const times = [
                new Date('2026-10-29T08:00:00Z'),
                new Date('2026-10-29T17:00:00Z')
            ];
            const result = classifyPunches(times, 'Turno 1', 'entrada', 2);
            expect(result.entradaMañana).toBeDefined();
            expect(result.salidaTarde).toBeDefined();
        });

        it('clasifica la entrada de un turno de salida primero como entradaTarde', () => {
            // Turno nocturno: salida 08:00 y entrada 14:00 (salida primero).
            const times = [
                new Date(2026, 10, 29, 8, 0, 0),
                new Date(2026, 10, 29, 14, 0, 0)
            ];
            const result = classifyPunches(times, 'Turno 2', 'salida', 2);
            expect(result.salidaMañana).toBeDefined();
            expect(result.entradaTarde).toBeDefined();
            expect(result.salidaTarde).toBeNull();
        });

        it('una sola marca antes de las 12:30 es entradaMañana', () => {
            const times = [new Date(2026, 10, 29, 8, 15, 0)];
            const result = classifyPunches(times, 'Turno 1', 'entrada', 1);
            expect(result.entradaMañana).toBeDefined();
            expect(result.salidaTarde).toBeNull();
        });

        it('una sola marca de salida primero antes de las 12:30 es salidaMañana', () => {
            const times = [new Date(2026, 10, 29, 8, 15, 0)];
            const result = classifyPunches(times, 'Turno 2', 'salida', 1);
            expect(result.salidaMañana).toBeDefined();
            expect(result.entradaMañana).toBeNull();
        });

        it('sin marcas devuelve todos los campos en null', () => {
            const result = classifyPunches([], 'Turno 1', 'entrada', 2);
            expect(result).toEqual({
                entradaMañana: null, salidaMañana: null,
                entradaTarde: null, salidaTarde: null,
                marca1: null, marca2: null,
            });
        });
    });

    describe('parseAttendanceRecord', () => {
        it('parsea una fecha ISO con hora', () => {
            const r = parseAttendanceRecord('2026-10-29 08:30:15');
            expect(r).toMatchObject({ dateStr: '2026-10-29', timeStr: '08:30:15' });
        });

        it('parsea DD/MM/YYYY con año de 2 dígitos', () => {
            const r = parseAttendanceRecord('29/10/26 17:00');
            expect(r).toMatchObject({ dateStr: '2026-10-29', timeStr: '17:00:00' });
        });

        it('aplica AM/PM correctamente', () => {
            expect(parseAttendanceRecord('2026-10-29 03:00:00 PM').timeStr).toBe('15:00:00');
            expect(parseAttendanceRecord('2026-10-29 12:00:00 AM').timeStr).toBe('00:00:00');
        });

        it('devuelve null para entradas inválidas o vacías', () => {
            expect(parseAttendanceRecord('')).toBeNull();
            expect(parseAttendanceRecord('no es una fecha')).toBeNull();
            expect(parseAttendanceRecord(null)).toBeNull();
        });

        it('parsea DD/MM/YYYY con año de 4 dígitos', () => {
            const r = parseAttendanceRecord('29/10/2026 09:45');
            expect(r).toMatchObject({ dateStr: '2026-10-29', timeStr: '09:45:00' });
        });

        it('parsea un número serial de Excel cuando se pasa XLSX', () => {
            // 29 oct 2026 00:00 en serial de Excel (base 1899-12-30).
            const XLSX = require('xlsx');
            const serial = (Date.UTC(2026, 9, 29) - Date.UTC(1899, 11, 30)) / 86400000;
            const r = parseAttendanceRecord(serial, XLSX);
            expect(r.dateStr).toBe('2026-10-29');
        });
    });

    describe('formatDateTime', () => {
        it('formatea una fecha local y devuelve null para inválida', () => {
            expect(formatDateTime(new Date(2026, 9, 29, 8, 5, 3))).toBe('2026-10-29 08:05:03');
            expect(formatDateTime(new Date('invalid'))).toBeNull();
            expect(formatDateTime(null)).toBeNull();
        });
    });
});
