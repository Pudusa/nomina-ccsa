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

    it('getShiftData mantiene una distribución distinta por mes (regresión)', async () => {
        const horasPorMes = {
            '2026-10': 8,
            '2026-11': 6,
        };
        vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
            const mes = new URL(url).searchParams.get('year_month');
            return Promise.resolve({
                ok: true,
                json: async () => ({
                    'Turno 1': [{ dayIndex: 0, hours: horasPorMes[mes], markDirection: 'entrada', numMarcas: 2 }],
                }),
            });
        }));

        const { templates, distributions } = await getShiftData('Bearer token', ['2026-10', '2026-11']);
        expect(templates).toEqual([{ id: 1, name: 'Turno 1' }]);
        expect(distributions).toHaveLength(2);
        // Mismo turno, ids iguales, pero horas distintas: noviembre NO hereda octubre.
        expect(distributions.find(d => d.year_month === '2026-10').shift_id).toBe(1);
        expect(distributions.find(d => d.year_month === '2026-11').shift_id).toBe(1);
        expect(JSON.parse(distributions.find(d => d.year_month === '2026-10').days_json)[0][0]).toBe(8);
        expect(JSON.parse(distributions.find(d => d.year_month === '2026-11').days_json)[0][0]).toBe(6);
    });

    it('propaga el error si el microservicio responde fallo', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        await expect(getWorkers('Bearer token')).rejects.toThrow('Error 500');
    });

    // getWorkers — casos restantes (total 5)
    it('getWorkers convierte no a string', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ no: 7, defaultTurno: 'T' }] }));
        const w = await getWorkers('Bearer');
        expect(w[0].no).toBe('7');
    });
    it('getWorkers por defecto rules vacio y sin header', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ no: 8, defaultTurno: 'T' }] }));
        const w = await getWorkers();
        expect(w[0].rules).toEqual([]);
        expect(fetch).toHaveBeenCalledWith(expect.anything(), { headers: {} });
    });
    it('getWorkers con array vacio', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
        expect(await getWorkers('Bearer')).toEqual([]);
    });

    // getShiftData — casos restantes (total 5)
    it('getShiftData sin meses usa BASE', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ 'T': [{ dayIndex: 0, hours: 8, markDirection: 'entrada', numMarcas: 2 }] }) }));
        const { distributions } = await getShiftData('Bearer');
        expect(distributions[0].year_month).toBe('BASE');
        expect(fetch.mock.calls[0][0]).toContain('year_month=BASE');
    });
    it('getShiftData ordena plantillas por nombre e ids estables', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
            'Zeta': [{ dayIndex: 0, hours: 8, markDirection: 'entrada', numMarcas: 2 }],
            'Alfa': [{ dayIndex: 0, hours: 8, markDirection: 'entrada', numMarcas: 2 }],
        }) }));
        const { templates, distributions } = await getShiftData('Bearer', '2026-11');
        expect(templates).toEqual([{ id: 1, name: 'Alfa' }, { id: 2, name: 'Zeta' }]);
        expect(distributions.find(d => d.year_month === '2026-11' && d.shift_id === 1)).toBeDefined();
    });
    it('getShiftData propaga error HTTP', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
        await expect(getShiftData('Bearer', '2026-11')).rejects.toThrow('Error 503');
    });
});
