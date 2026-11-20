import { describe, it, expect } from 'vitest';
import { parseAttendanceRecord } from '../services/attendance.service.cjs';
import XLSX from 'xlsx';

// REGLA DE NEGOCIO: la hora del archivo se copia exactamente como la dio el
// servidor al equipo de marcaje. No se convierte entre zonas horarias.
describe('parseAttendanceRecord — 10 casos', () => {
    // --- 5 que ACEPTAN ---
    it('acepta ISO YYYY-MM-DD con hora', () => {
        expect(parseAttendanceRecord('2026-10-29 08:30:15')).toMatchObject({
            dateStr: '2026-10-29', timeStr: '08:30:15', timestampStr: '2026-10-29 08:30:15',
        });
    });

    it('acepta ISO con slash', () => {
        expect(parseAttendanceRecord('2026/10/29 09:00')).toMatchObject({
            dateStr: '2026-10-29', timeStr: '09:00:00',
        });
    });

    it('acepta DD/MM/YYYY con año de 2 dígitos', () => {
        expect(parseAttendanceRecord('29/10/26 17:05')).toMatchObject({
            dateStr: '2026-10-29', timeStr: '17:05:00',
        });
    });

    it('acepta DD/MM/YYYY con año de 4 dígitos', () => {
        expect(parseAttendanceRecord('29/10/2026 07:00')).toMatchObject({
            dateStr: '2026-10-29', timeStr: '07:00:00',
        });
    });

    it('conserva EXACTAMENTE la hora del archivo sin importar la zona horaria (Date UTC)', () => {
        // El servidor registró 08:00. El objeto Date viene en UTC; getUTC* mantiene 8.
        const marcaje = new Date('2026-10-29T08:00:00Z');
        const r = parseAttendanceRecord(marcaje);
        expect(r.timeStr).toBe('08:00:00');
        expect(r.dateStr).toBe('2026-10-29');
        // Y el dateObj resultante, una vez reconstruido, sigue marcando la hora original.
        expect(r.dateObj.getHours()).toBe(8);
    });

    // --- 5 que RECHAZAN (devuelven null) ---
    it('rechaza cadena vacía', () => {
        expect(parseAttendanceRecord('')).toBeNull();
    });

    it('rechaza null', () => {
        expect(parseAttendanceRecord(null)).toBeNull();
    });

    it('rechaza undefined', () => {
        expect(parseAttendanceRecord(undefined)).toBeNull();
    });

    it('rechaza texto que no es fecha', () => {
        expect(parseAttendanceRecord('no es una fecha')).toBeNull();
    });

    it('rechaza un número sin XLSX (no puede interpretar el serial)', () => {
        expect(parseAttendanceRecord(45000)).toBeNull();
    });
});
