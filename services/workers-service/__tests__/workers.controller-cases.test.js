import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DB_PATH = path.join(os.tmpdir(), `workers-controller-${Date.now()}.sqlite`);
});

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database.cjs';
import workersRoutes from '../routes/workers.routes.cjs';

const TOKEN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.headers.authorization = `Bearer ${TOKEN}`; next(); });
app.use('/api', workersRoutes);

beforeEach(() => {
    db.exec('DELETE FROM shift_rules; DELETE FROM workers;');
    db.prepare('INSERT INTO workers (no, nombre, default_turno, departamento) VALUES (?, ?, ?, ?)')
        .run('123', 'Juan', 'TURNO 1', 'General');
    db.prepare('INSERT INTO workers (no, nombre, default_turno, departamento) VALUES (?, ?, ?, ?)')
        .run('456', 'Ana', 'TURNO 2', 'Admin');
});
afterAll(() => {
    db.close();
    setTimeout(() => { try { fs.unlinkSync(process.env.DB_PATH); } catch {} }, 100);
});

describe('getWorkers — 10 casos', () => {
    it('1: devuelve los workers', async () => {
        expect((await request(app).get('/api/workers')).body.length).toBe(2);
    });
    it('2: status 200', async () => {
        expect((await request(app).get('/api/workers')).status).toBe(200);
    });
    it('3: cada worker trae rules', async () => {
        const r = await request(app).get('/api/workers');
        expect(Array.isArray(r.body[0].rules)).toBe(true);
    });
    it('4: defaultTurno se mapea desde default_turno', async () => {
        const r = await request(app).get('/api/workers');
        expect(r.body.find(w => w.no === '123').defaultTurno).toBe('TURNO 1');
    });
    it('5: departamento por defecto', async () => {
        const r = await request(app).get('/api/workers');
        expect(r.body.find(w => w.no === '123').departamento).toBe('General');
    });
    it('6: orden por numero', async () => {
        const r = await request(app).get('/api/workers');
        expect(r.body[0].no).toBe('123');
    });
    it('7: reglas se asocian al worker correcto', async () => {
        db.prepare('INSERT INTO shift_rules (worker_no,type,turno,start_date) VALUES (?,?,?,?)')
            .run('123', 'parcial', 'TURNO 3', '2026-11-01');
        const r = await request(app).get('/api/workers');
        expect(r.body.find(w => w.no === '123').rules.length).toBe(1);
        expect(r.body.find(w => w.no === '456').rules.length).toBe(0);
    });
    it('8: worker sin turno usa fallback', async () => {
        db.prepare("UPDATE workers SET default_turno='' WHERE no='123'").run();
        const r = await request(app).get('/api/workers');
        expect(r.body.find(w => w.no === '123').defaultTurno).toBe('Sin turno');
    });
    it('9: sin workers devuelve array vacio', async () => {
        db.exec('DELETE FROM workers;');
        expect((await request(app).get('/api/workers')).body).toEqual([]);
    });
    it('10: respuesta es array', async () => {
        expect(Array.isArray((await request(app).get('/api/workers')).body)).toBe(true);
    });
});

describe('addWorkerRule — 10 casos', () => {
    it('1: regla parcial se agrega -> 200', async () => {
        expect((await request(app).post('/api/workers/123/rules').send({ type: 'parcial', turno: 'TURNO 3', startDate: '2026-11-01' })).status).toBe(200);
    });
    it('2: la regla queda en BD', async () => {
        await request(app).post('/api/workers/123/rules').send({ type: 'parcial', turno: 'TURNO 3', startDate: '2026-11-01' });
        expect(db.prepare('SELECT COUNT(*) c FROM shift_rules WHERE worker_no=?').get('123').c).toBe(1);
    });
    it('3: endDate por defecto es startDate', async () => {
        await request(app).post('/api/workers/123/rules').send({ type: 'parcial', turno: 'TURNO 3', startDate: '2026-11-01' });
        expect(db.prepare('SELECT end_date FROM shift_rules WHERE worker_no=?').get('123').end_date).toBe('2026-11-01');
    });
    it('4: tipo total actualiza default_turno', async () => {
        await request(app).post('/api/workers/123/rules').send({ type: 'total', turno: 'TURNO 9', startDate: '2026-11-01' });
        expect(db.prepare('SELECT default_turno FROM workers WHERE no=?').get('123').default_turno).toBe('TURNO 9');
    });
    it('5: tipo total borra reglas previas', async () => {
        db.prepare('INSERT INTO shift_rules (worker_no,type,turno,start_date) VALUES (?,?,?,?)').run('123','parcial','TURNO 3','2026-11-01');
        await request(app).post('/api/workers/123/rules').send({ type: 'total', turno: 'TURNO 9', startDate: '2026-11-01' });
        expect(db.prepare('SELECT COUNT(*) c FROM shift_rules WHERE worker_no=?').get('123').c).toBe(0);
    });
    it('6: sin type -> 400', async () => {
        expect((await request(app).post('/api/workers/123/rules').send({ turno: 'T', startDate: '2026-11-01' })).status).toBe(400);
    });
    it('7: sin turno -> 400', async () => {
        expect((await request(app).post('/api/workers/123/rules').send({ type: 'parcial', startDate: '2026-11-01' })).status).toBe(400);
    });
    it('8: sin startDate -> 400', async () => {
        expect((await request(app).post('/api/workers/123/rules').send({ type: 'parcial', turno: 'T' })).status).toBe(400);
    });
    it('9: mensaje de exito', async () => {
        const r = await request(app).post('/api/workers/123/rules').send({ type: 'parcial', turno: 'T', startDate: '2026-11-01' });
        expect(r.body.message).toContain('éxito');
    });
    it('10: endDate explicito se conserva', async () => {
        await request(app).post('/api/workers/123/rules').send({ type: 'parcial', turno: 'T', startDate: '2026-11-01', endDate: '2026-11-30' });
        expect(db.prepare('SELECT end_date FROM shift_rules WHERE worker_no=?').get('123').end_date).toBe('2026-11-30');
    });
});

describe('deleteRule — 10 casos', () => {
    const add = () => db.prepare('INSERT INTO shift_rules (worker_no,type,turno,start_date) VALUES (?,?,?,?)').run('123','parcial','T','2026-11-01').lastInsertRowid;

    it('1: elimina una regla existente', async () => {
        const id = add();
        expect((await request(app).delete(`/api/rules/${id}`)).status).toBe(200);
    });
    it('2: ya no esta en BD', async () => {
        const id = add();
        await request(app).delete(`/api/rules/${id}`);
        expect(db.prepare('SELECT COUNT(*) c FROM shift_rules WHERE id=?').get(id).c).toBe(0);
    });
    it('3: eliminar inexistente da 200', async () => {
        expect((await request(app).delete('/api/rules/9999')).status).toBe(200);
    });
    it('4: mensaje de exito', async () => {
        expect((await request(app).delete('/api/rules/9999')).body.message).toContain('éxito');
    });
    it('5: solo elimina la indicada', async () => {
        const id1 = add();
        const id2 = add();
        await request(app).delete(`/api/rules/${id1}`);
        expect(db.prepare('SELECT COUNT(*) c FROM shift_rules WHERE id=?').get(id2).c).toBe(1);
    });
    it('6: response tiene message', async () => {
        expect((await request(app).delete('/api/rules/9999')).body).toHaveProperty('message');
    });
    it('7: multiple eliminaciones', async () => {
        const id1 = add();
        const id2 = add();
        await request(app).delete(`/api/rules/${id1}`);
        await request(app).delete(`/api/rules/${id2}`);
        expect(db.prepare('SELECT COUNT(*) c FROM shift_rules').get().c).toBe(0);
    });
    it('8: no afecta a workers', async () => {
        const id = add();
        await request(app).delete(`/api/rules/${id}`);
        expect(db.prepare('SELECT COUNT(*) c FROM workers').get().c).toBe(2);
    });
    it('9: id no numerico da 200 (SQLite lo ignora)', async () => {
        expect((await request(app).delete('/api/rules/abc')).status).toBe(200);
    });
    it('10: tras eliminar GET no la muestra', async () => {
        const id = add();
        await request(app).delete(`/api/rules/${id}`);
        const r = await request(app).get('/api/workers');
        expect(r.body.find(w => w.no === '123').rules.length).toBe(0);
    });
});
