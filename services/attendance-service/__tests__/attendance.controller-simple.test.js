import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DB_PATH = path.join(os.tmpdir(), `att-controller-${Date.now()}.sqlite`);
});

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import XLSX from 'xlsx';
import db from '../database.cjs';
import attendanceRoutes from '../routes/attendance.routes.cjs';

const TOKEN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
const auth = { Authorization: `Bearer ${TOKEN}` };

// Rutas reales con un JWT válido (auth se prueba en su propio archivo).
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.headers.authorization = `Bearer ${TOKEN}`; next(); });
app.use('/api', attendanceRoutes);

function seedRow(workerNo, date, time) {
    db.prepare('INSERT INTO attendance (worker_no, date, time, timestamp, location_id, verification) VALUES (?, ?, ?, ?, ?, ?)')
        .run(workerNo, date, time, `${date} ${time}`, 'L1', 'V1');
}

function excelBuffer(rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

beforeAll(() => {
    db.exec('DELETE FROM attendance; DELETE FROM incident_justifications;');
    seedRow('123', '2026-10-29', '08:00:00');
    seedRow('123', '2026-10-29', '17:00:00');
    seedRow('456', '2026-10-30', '09:00:00');
});

afterAll(() => {
    db.close();
    setTimeout(() => {
        try { require('fs').unlinkSync(process.env.DB_PATH); } catch {}
    }, 100);
});

describe('getDates — 10 casos', () => {
    it('1: devuelve las fechas distintas ordenadas', async () => {
        const r = await request(app).get('/api/dates');
        expect(r.status).toBe(200);
        expect(r.body).toEqual(['2026-10-29', '2026-10-30']);
    });
    it('2: devuelve array', async () => {
        const r = await request(app).get('/api/dates');
        expect(Array.isArray(r.body)).toBe(true);
    });
    it('3: sin duplicados', async () => {
        const r = await request(app).get('/api/dates');
        expect(new Set(r.body).size).toBe(r.body.length);
    });
    it('4: formato YYYY-MM-DD', async () => {
        const r = await request(app).get('/api/dates');
        r.body.forEach(d => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    });
    it('5: tras insertar una fecha nueva aparece', async () => {
        seedRow('999', '2026-11-01', '08:00:00');
        const r = await request(app).get('/api/dates');
        expect(r.body).toContain('2026-11-01');
    });
    it('6: ignora timestamps malos (longitud distinta de 10)', async () => {
        db.prepare('INSERT INTO attendance (worker_no, date, time, timestamp) VALUES (?, ?, ?, ?)').run('1', 'x', 'y', 'bad');
        const r = await request(app).get('/api/dates');
        expect(r.body).not.toContain('bad');
    });
    it('7: response 200', async () => {
        expect((await request(app).get('/api/dates')).status).toBe(200);
    });
    it('8: incluye la primera fecha sembrada', async () => {
        expect((await request(app).get('/api/dates')).body).toContain('2026-10-29');
    });
    it('9: incluye la ultima fecha sembrada', async () => {
        expect((await request(app).get('/api/dates')).body).toContain('2026-10-30');
    });
    it('10: orden ascendente', async () => {
        const r = await request(app).get('/api/dates');
        expect(r.body).toEqual([...r.body].sort());
    });
});

describe('getAttendanceByRange — 10 casos', () => {
    it('1: rango con registros', async () => {
        const r = await request(app).get('/api/attendance/range?startDate=2026-10-29&endDate=2026-10-30');
        expect(r.status).toBe(200);
        expect(r.body.length).toBeGreaterThan(0);
    });
    it('2: filtra por worker', async () => {
        const r = await request(app).get('/api/attendance/range?startDate=2026-10-29&endDate=2026-10-30');
        expect(r.body.every(x => x.worker_no === '123' || x.worker_no === '456')).toBe(true);
    });
    it('3: rango vacio', async () => {
        const r = await request(app).get('/api/attendance/range?startDate=2020-01-01&endDate=2020-01-02');
        expect(r.body).toEqual([]);
    });
    it('4: sin startDate -> 400', async () => {
        const r = await request(app).get('/api/attendance/range?endDate=2026-10-30');
        expect(r.status).toBe(400);
    });
    it('5: sin endDate -> 400', async () => {
        const r = await request(app).get('/api/attendance/range?startDate=2026-10-29');
        expect(r.status).toBe(400);
    });
    it('6: sin parametros -> 400', async () => {
        expect((await request(app).get('/api/attendance/range')).status).toBe(400);
    });
    it('7: end exclusivo (timestamp < endDate)', async () => {
        const r = await request(app).get('/api/attendance/range?startDate=2026-10-29 00:00:00&endDate=2026-10-29 00:00:00');
        expect(r.body).toEqual([]);
    });
    it('8: devuelve array', async () => {
        expect(Array.isArray((await request(app).get('/api/attendance/range?startDate=2026-10-29&endDate=2026-11-01')).body)).toBe(true);
    });
    it('9: mensaje de error presente en 400', async () => {
        expect((await request(app).get('/api/attendance/range')).body).toHaveProperty('error');
    });
    it('10: longitud correcta para un dia', async () => {
        const r = await request(app).get('/api/attendance/range?startDate=2026-10-29 00:00:00&endDate=2026-10-30 00:00:00');
        expect(r.body.length).toBe(2);
    });
});

describe('saveIncidentJustification — 10 casos', () => {
    it('1: inserta una justificacion nueva', async () => {
        const r = await request(app).put('/api/incidents/justify').send({ workerNo: '123', date: '2026-10-29', tipo: 'Incapacidad', descripcion: 'Folio 1' });
        expect(r.status).toBe(200);
        expect(r.body.success).toBe(true);
    });
    it('2: la guarda en BD', async () => {
        const row = db.prepare('SELECT * FROM incident_justifications WHERE worker_no=? AND date=?').get('123', '2026-10-29');
        expect(row.tipo).toBe('Incapacidad');
    });
    it('3: actualiza una existente (upsert)', async () => {
        await request(app).put('/api/incidents/justify').send({ workerNo: '123', date: '2026-10-29', tipo: 'Vacaciones', descripcion: 'Folio 2' });
        const row = db.prepare('SELECT * FROM incident_justifications WHERE worker_no=? AND date=?').get('123', '2026-10-29');
        expect(row.tipo).toBe('Vacaciones');
    });
    it('4: no crea duplicados', async () => {
        const c = db.prepare('SELECT COUNT(*) c FROM incident_justifications WHERE worker_no=? AND date=?').get('123', '2026-10-29').c;
        expect(c).toBe(1);
    });
    it('5: sin workerNo -> 400', async () => {
        expect((await request(app).put('/api/incidents/justify').send({ date: '2026-10-29' })).status).toBe(400);
    });
    it('6: sin date -> 400', async () => {
        expect((await request(app).put('/api/incidents/justify').send({ workerNo: '123' })).status).toBe(400);
    });
    it('7: cuerpo vacio -> 400', async () => {
        expect((await request(app).put('/api/incidents/justify').send({})).status).toBe(400);
    });
    it('8: tipo por defecto si falta', async () => {
        await request(app).put('/api/incidents/justify').send({ workerNo: '777', date: '2026-10-29' });
        const row = db.prepare('SELECT * FROM incident_justifications WHERE worker_no=? AND date=?').get('777', '2026-10-29');
        expect(row.tipo).toBe('Falta injustificada');
    });
    it('9: descripcion por defecto vacia', async () => {
        const row = db.prepare('SELECT * FROM incident_justifications WHERE worker_no=? AND date=?').get('777', '2026-10-29');
        expect(row.descripcion).toBe('');
    });
    it('10: error tiene mensaje', async () => {
        const r = await request(app).put('/api/incidents/justify').send({});
        expect(r.body).toHaveProperty('error');
    });
});

describe('uploadAttendance — 10 casos', () => {
    it('1: sube un Excel y reporta 1 nuevo', async () => {
        const buf = excelBuffer([{ 'No.': 555, 'Fecha/Hora': '2026-10-29 10:00:00', 'Location ID': 'L1', 'Verificación': 'V1' }]);
        const r = await request(app).post('/api/upload').attach('file', buf, 'a.xlsx');
        expect(r.status).toBe(200);
        expect(r.body.newRecordsAdded).toBe(1);
    });
    it('2: el registro queda en BD', async () => {
        expect(db.prepare('SELECT COUNT(*) c FROM attendance WHERE worker_no=?').get('555').c).toBe(1);
    });
    it('3: re-subir el mismo archivo da 0 nuevos y 1 duplicado', async () => {
        const buf = excelBuffer([{ 'No.': 555, 'Fecha/Hora': '2026-10-29 10:00:00', 'Location ID': 'L1', 'Verificación': 'V1' }]);
        const r = await request(app).post('/api/upload').attach('file', buf, 'a.xlsx');
        expect(r.body.newRecordsAdded).toBe(0);
        expect(r.body.duplicatesSkipped).toBe(1);
    });
    it('4: sin archivo -> 400', async () => {
        expect((await request(app).post('/api/upload')).status).toBe(400);
    });
    it('5: error tiene mensaje', async () => {
        expect((await request(app).post('/api/upload')).body).toHaveProperty('error');
    });
    it('6: reporta totalRowsInFile', async () => {
        const buf = excelBuffer([{ 'No.': 556, 'Fecha/Hora': '2026-10-29 11:00:00' }, { 'No.': 557, 'Fecha/Hora': '2026-10-29 12:00:00' }]);
        const r = await request(app).post('/api/upload').attach('file', buf, 'b.xlsx');
        expect(r.body.totalRowsInFile).toBe(2);
    });
    it('7: omite filas sin No.', async () => {
        const buf = excelBuffer([{ 'Fecha/Hora': '2026-10-29 11:00:00' }]);
        const r = await request(app).post('/api/upload').attach('file', buf, 'c.xlsx');
        expect(r.body.newRecordsAdded).toBe(0);
    });
    it('8: omite filas con fecha invalida', async () => {
        const buf = excelBuffer([{ 'No.': 558, 'Fecha/Hora': 'no fecha' }]);
        const r = await request(app).post('/api/upload').attach('file', buf, 'd.xlsx');
        expect(r.body.newRecordsAdded).toBe(0);
    });
    it('9: multiple filas nuevas', async () => {
        const buf = excelBuffer([
            { 'No.': 560, 'Fecha/Hora': '2026-10-29 13:00:00' },
            { 'No.': 561, 'Fecha/Hora': '2026-10-29 14:00:00' },
        ]);
        const r = await request(app).post('/api/upload').attach('file', buf, 'e.xlsx');
        expect(r.body.newRecordsAdded).toBe(2);
    });
    it('10: mensaje de exito presente', async () => {
        const buf = excelBuffer([{ 'No.': 562, 'Fecha/Hora': '2026-10-29 15:00:00' }]);
        const r = await request(app).post('/api/upload').attach('file', buf, 'f.xlsx');
        expect(r.body.message).toContain('éxito');
    });
});
