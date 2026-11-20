import { describe, it, expect, vi, afterEach } from 'vitest';

const { getWorkers, getShiftData } = await import('../services/internal-api.cjs');

describe('Cliente HTTP interno', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('getWorkers adapta defaultTurno y rules del microservicio', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { no: 123, nombre: 'Juan', defaultTurno: 'Turno 1', departamento: 'A', rules: [{ id: 1, type: 'parcial' }] },
            ],
        }));

        const workers = await getWorkers('Bearer token');
        expect(workers).toEqual([{
            no: '123',
            nombre: 'Juan',
            default_turno: 'Turno 1',
            rules: [{ id: 1, type: 'parcial' }],
        }]);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/workers'),
            expect.objectContaining({ headers: { Authorization: 'Bearer token' } })
        );
    });

    it('getShiftData convierte el objeto de dias a tuplas y propaga el year_month', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                'Turno 1': [{ dayIndex: 0, hours: 8, markDirection: 'entrada', numMarcas: 2 }],
            }),
        }));

        const { templates, distributions } = await getShiftData('Bearer token', '2026-11');
        expect(templates).toEqual([{ id: 1, name: 'Turno 1' }]);
        expect(distributions[0].year_month).toBe('2026-11');
        expect(JSON.parse(distributions[0].days_json)).toEqual([[8, 'entrada', 0, 2]]);
    });

    it('propaga el error si el microservicio responde fallo', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        await expect(getWorkers('Bearer token')).rejects.toThrow('Error 500');
    });
});
