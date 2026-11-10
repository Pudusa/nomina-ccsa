import { describe, it, expect } from 'vitest';
import {
    parseToDate,
    formatDateKey,
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
    });
});
