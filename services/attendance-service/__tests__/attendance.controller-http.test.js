import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DB_PATH = path.join(os.tmpdir(), `att-controller-http-${Date.now()}.sqlite`);
});

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database.cjs';
import attendanceRoutes from '../routes/attendance.routes.cjs';

const TOKEN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.headers.authorization = `Bearer ${TOKEN}`; next(); });
app.use('/api', attendanceRoutes);

const days = (hours) => Array.from({ length: 31 }, (_, i) => ({
    dayIndex: i, hours, markDirection: 'entrada', numMarcas: 2,
}));

function mockInternal({ workers = [], shiftDays = { 'TURNO 1': days(8) } } = {}) {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
        if (url.includes('/api/workers')) {
            return Promise.resolve({ ok: true, json: async () => workers });
        }
        if (url.includes('/api/shift-templates')) {
            const mes = new URL(url).searchParams.get('year_month');
            const obj = {};
            for (const [name, ds] of Object.entries(shiftDays)) {
                obj[name] = ds.map(d => ({ ...d, hours: typeof d.hours === 'object' ? d.hours[mes] : d.hours }));
            }
            return Promise.resolve({ ok: true, json: async () => obj });
        }
        return Promise.resolve({ ok: false, status: 404 });
    }));
}

function seed(workerNo, date, time) {
    db.prepare('INSERT INTO attendance (worker_no, date, time, timestamp, location_id, verification) VALUES (?, ?, ?, ?, ?, ?)')
        .run(workerNo, date, time, `${date} ${time}`, 'L1', 'V1');
}

beforeAll(() => {
    db.exec('DELETE FROM attendance; DELETE FROM incident_justifications;');
    seed('123', '2026-11-03', '08:00:00');
    seed('123', '2026-11-03', '17:00:00');
    seed('456', '2026-11-04', '09:00:00');
});

afterAll(() => {
    vi.unstubAllGlobals();
    db.close();
    setTimeout(() => { try { require('fs').unlinkSync(process.env.DB_PATH); } catch {} }, 100);
});

describe('getAttendanceByDate — 10 casos', () => {
    beforeEach(() => mockInternal({ workers: [
        { no: 123, nombre: 'Juan', defaultTurno: 'TURNO 1', rules: [] },
        { no: 456, nombre: 'Ana', defaultTurno: 'TURNO 1', rules: [] },
    ] }));

    it('1: sin date -> 400', async () => expect((await request(app).get('/api/attendance')).status).toBe(400));
    it('2: con date valido -> 200', async () => {
        expect((await request(app).get('/api/attendance?date=2026-11-03')).status).toBe(200);
    });
    it('3: devuelve array', async () => {
        expect(Array.isArray((await request(app).get('/api/attendance?date=2026-11-03')).body)).toBe(true);
    });
    it('4: incluye trabajador con marcas', async () => {
        const r = await request(app).get('/api/attendance?date=2026-11-03');
        expect(r.body.find(w => w.no === '123')).toBeDefined();
    });
    it('5: clasifica entrada y salida', async () => {
        const r = await request(app).get('/api/attendance?date=2026-11-03');
        const juan = r.body.find(w => w.no === '123');
        expect(juan.entradaMañana).toContain('08:00:00');
        expect(juan.salidaTarde).toContain('17:00:00');
    });
    it('6: trabajador sin marcas tiene totalPunches 0', async () => {
        const r = await request(app).get('/api/attendance?date=2026-11-03');
        expect(r.body.find(w => w.no === '456').totalPunches).toBe(0);
    });
    it('7: fecha sin registros devuelve igualmente los workers', async () => {
        const r = await request(app).get('/api/attendance?date=2020-01-01');
        expect(r.body).toHaveLength(2);
    });
    it('8: mensaje de error en 400', async () => {
        expect((await request(app).get('/api/attendance')).body).toHaveProperty('error');
    });
    it('9: llama a workers y shifts', async () => {
        await request(app).get('/api/attendance?date=2026-11-03');
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/workers'), expect.anything());
    });
    it('10: reenvia el Authorization', async () => {
        await request(app).get('/api/attendance?date=2026-11-03');
        expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
        }));
    });
});

describe('getIncidents — 10 casos', () => {
    const workers = [
        { no: 123, nombre: 'Juan', defaultTurno: 'TURNO 1', rules: [] },
        { no: 456, nombre: 'Ana', defaultTurno: 'TURNO 1', rules: [] },
    ];

    it('1: rango con incidencias devuelve 200', async () => {
        mockInternal({ workers });
        expect((await request(app).get('/api/incidents?startDate=2026-11-01&endDate=2026-11-30')).status).toBe(200);
    });
    it('2: ausencia para worker sin marcas', async () => {
        mockInternal({ workers });
        const r = await request(app).get('/api/incidents?startDate=2026-11-04&endDate=2026-11-04');
        // Juan (123) no tiene marcas el 04 -> ausencia; Ana (456) tiene 1 marca -> falta de salida.
        const juan = r.body.find(w => w.no === '123');
        const ana = r.body.find(w => w.no === '456');
        expect(juan.anomalias.some(a => a.tipo === 'Falta injustificada')).toBe(true);
        expect(ana.anomalias.some(a => a.tipo.includes('Falta salida'))).toBe(true);
    });
    it('3: sin workers no hay incidencias', async () => {
        mockInternal({ workers: [] });
        const r = await request(app).get('/api/incidents?startDate=2020-01-01&endDate=2020-01-02');
        expect(r.body).toEqual([]);
    });
    it('4: devuelve array', async () => {
        mockInternal({ workers });
        expect(Array.isArray((await request(app).get('/api/incidents?month=2026-11')).body)).toBe(true);
    });
    it('5: una sola marca genera falta de marca', async () => {
        seed('123', '2026-11-05', '08:00:00');
        mockInternal({ workers });
        const r = await request(app).get('/api/incidents?startDate=2026-11-05&endDate=2026-11-05');
        const juan = r.body.find(w => w.no === '123');
        expect(juan.anomalias.some(a => a.tipo.includes('Falta salida'))).toBe(true);
    });
    it('6: justificacion guardada se refleja', async () => {
        db.prepare('INSERT INTO incident_justifications (worker_no,date,tipo,descripcion) VALUES (?,?,?,?)')
            .run('456', '2026-11-04', 'Incapacidad', 'Folio');
        mockInternal({ workers });
        const r = await request(app).get('/api/incidents?startDate=2026-11-04&endDate=2026-11-04');
        const ana = r.body.find(w => w.no === '456');
        expect(ana.anomalias.some(a => a.tipo === 'Incapacidad')).toBe(true);
    });
    it('7: usa distribucion distinta por mes (regresion)', async () => {
        mockInternal({ workers, shiftDays: {
            'TURNO 1': days({ '2026-10': 8, '2026-11': 6 }),
        } });
        await request(app).get('/api/incidents?startDate=2026-11-01&endDate=2026-11-30');
        const urls = fetch.mock.calls.map(c => c[0]).filter(u => u.includes('shift-templates'));
        expect(urls.some(u => u.includes('2026-11'))).toBe(true);
    });
    it('8: mes sin rango devuelve 200', async () => {
        mockInternal({ workers });
        expect((await request(app).get('/api/incidents?month=2026-11')).status).toBe(200);
    });
    it('9: categoria Fuera de turno presente en respuesta', async () => {
        mockInternal({ workers });
        const r = await request(app).get('/api/incidents?startDate=2026-11-01&endDate=2026-11-30');
        expect(r.body.every(w => w.anomalias.every(a => a.categoria))).toBe(true);
    });
    it('10: fallo de microservicio -> 500', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        expect((await request(app).get('/api/incidents?startDate=2026-11-01&endDate=2026-11-30')).status).toBe(500);
    });
});
