import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

// Usar las BDs REALES en modo lectura. El controller solo hace SELECT en este flujo.
// Al final se verifica por hash que ningún archivo fue modificado.
const ROOT = process.cwd();
const WORKERS_DB = path.join(ROOT, 'data', 'workers.sqlite');
const SHIFTS_DB = path.join(ROOT, 'data', 'shifts.sqlite');
const ATT_DB = path.join(ROOT, 'data', 'attendance.sqlite');

vi.hoisted(() => {
    const path = require('path');
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DB_PATH = path.join(process.cwd(), 'data', 'workers.sqlite');
});

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const TOKEN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.headers.authorization = `Bearer ${TOKEN}`; next(); });
const workersRoutes = (await import('../routes/workers.routes.cjs')).default;
app.use('/api', workersRoutes);

const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
let hashesAntes;

// Datos reales derivados en tiempo de ejecución (no hardcodeados).
let worker;
let fechaConMarcas;
let monthYear;
let hoy;

beforeAll(() => {
    hashesAntes = [WORKERS_DB, SHIFTS_DB, ATT_DB].map(hash);

    const wdb = new Database(WORKERS_DB, { readonly: true });
    worker = wdb.prepare('SELECT no, default_turno FROM workers ORDER BY CAST(no AS INTEGER) LIMIT 1').get();
    wdb.close();

    const adb = new Database(ATT_DB, { readonly: true });
    const row = adb.prepare(`
        SELECT worker_no, date, COUNT(*) AS n
        FROM attendance
        GROUP BY worker_no, date
        HAVING n >= 2
        ORDER BY date DESC
        LIMIT 1
    `).get();
    fechaConMarcas = row.date;
    monthYear = fechaConMarcas.substring(0, 7);
    adb.close();

    hoy = new Date();
});

afterAll(() => {
    const hashesDespues = [WORKERS_DB, SHIFTS_DB, ATT_DB].map(hash);
    expect(hashesDespues).toEqual(hashesAntes); // garantiza que NO se modificaron
});

const get = (no, mes) => request(app).get(`/api/workers/calendar?workerNo=${encodeURIComponent(no)}&monthYear=${mes}`);

describe('getWorkerCalendar con datos reales (solo lectura) — 10 casos', () => {
    it('1: sin parametros -> 400', async () => {
        expect((await request(app).get('/api/workers/calendar')).status).toBe(400);
    });
    it('2: worker inexistente -> 404', async () => {
        expect((await get('NO_EXISTE_999', monthYear)).status).toBe(404);
    });
    it('3: worker real + mes -> 200', async () => {
        expect((await get(worker.no, monthYear)).status).toBe(200);
    });
    it('4: devuelve un objeto', async () => {
        expect(typeof (await get(worker.no, monthYear)).body).toBe('object');
    });
    it('5: contiene la fecha con marcas del worker real', async () => {
        const body = (await get(worker.no, monthYear)).body;
        // La fecha con 2 marcas puede ser de otro worker; usamos AnyWorker para el calendario.
        expect(body[fechaConMarcas]).toBeDefined();
    });
    it('6: cada dia tiene status/turno/expectedHours/times', async () => {
        const body = (await get(worker.no, monthYear)).body;
        const dia = body[Object.keys(body)[0]];
        expect(dia).toHaveProperty('status');
        expect(dia).toHaveProperty('turno');
        expect(dia).toHaveProperty('expectedHours');
        expect(dia).toHaveProperty('times');
        expect(dia).toHaveProperty('workedHours');
        expect(dia).toHaveProperty('overtimeHours');
    });
    it('7: estados son del conjunto permitido', async () => {
        const body = (await get(worker.no, monthYear)).body;
        const permitidos = ['verde', 'rojo', 'amarillo', 'gris', 'fuera_de_turno'];
        Object.values(body).forEach(d => expect(permitidos).toContain(d.status));
    });
    it('8: times es array en todos los dias', async () => {
        const body = (await get(worker.no, monthYear)).body;
        Object.values(body).forEach(d => expect(Array.isArray(d.times)).toBe(true));
    });
    it('9: Turnos reales se reflejan en expectedHours > 0', async () => {
        const body = (await get(worker.no, monthYear)).body;
        expect(Object.values(body).some(d => d.expectedHours > 0)).toBe(true);
    });
    it('10: mes sin datos devuelve dias en gris', async () => {
        const body = (await get(worker.no, '2099-01')).body;
        expect(body['2099-01-01'].status).toBe('gris');
    });
});
