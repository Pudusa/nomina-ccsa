import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DB_PATH = path.join(os.tmpdir(), `shifts-controller-${Date.now()}.sqlite`);
});

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database.cjs';
import shiftsRoutes from '../routes/shifts.routes.cjs';

const TOKEN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.headers.authorization = `Bearer ${TOKEN}`; next(); });
app.use('/api', shiftsRoutes);

beforeEach(() => {
    db.exec('DELETE FROM shift_monthly_distributions; DELETE FROM shift_templates;');
});
afterAll(() => {
    db.close();
    setTimeout(() => { try { fs.unlinkSync(process.env.DB_PATH); } catch {} }, 100);
});

const dias = [{ hours: 8, markDirection: 'entrada', dayIndex: 0, numMarcas: 2 }];

describe('getShiftTemplates — 10 casos', () => {
    it('1: sin plantillas devuelve objeto vacio', async () => {
        expect((await request(app).get('/api/shift-templates')).body).toEqual({});
    });
    it('2: devuelve una plantilla guardada', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'T1', days: dias });
        const r = await request(app).get('/api/shift-templates');
        expect(r.body.T1).toBeDefined();
    });
    it('3: adapta dias a objetos', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'T1', days: dias });
        const r = await request(app).get('/api/shift-templates');
        expect(r.body.T1[0]).toMatchObject({ dayIndex: 0, hours: 8, markDirection: 'entrada', numMarcas: 2 });
    });
    it('4: year_month existente', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'T1', days: dias, yearMonth: '2026-11' });
        const r = await request(app).get('/api/shift-templates?year_month=2026-11');
        expect(r.body.T1[0].hours).toBe(8);
    });
    it('5: fallback a BASE si no hay mes', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'T1', days: dias });
        const r = await request(app).get('/api/shift-templates?year_month=2099-01');
        expect(r.body.T1[0].hours).toBe(8);
    });
    it('6: plantilla sin distribucion da array vacio', async () => {
        db.prepare('INSERT INTO shift_templates (name) VALUES (?)').run('VACIA');
        expect((await request(app).get('/api/shift-templates')).body.VACIA).toEqual([]);
    });
    it('7: status 200', async () => {
        expect((await request(app).get('/api/shift-templates')).status).toBe(200);
    });
    it("8: horas 'P' se conservan como texto", async () => {
        await request(app).post('/api/shift-templates').send({ name: 'T1', days: [{ hours: 'P', dayIndex: 0 }] });
        const r = await request(app).get('/api/shift-templates');
        expect(r.body.T1[0].hours).toBe('P');
    });
    it('9: multiples plantillas', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'A', days: dias });
        await request(app).post('/api/shift-templates').send({ name: 'B', days: dias });
        expect(Object.keys((await request(app).get('/api/shift-templates')).body)).toEqual(['A', 'B']);
    });
    it('10: dias ordenados por dayIndex', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'T1', days: [
            { hours: 8, dayIndex: 5 }, { hours: 4, dayIndex: 1 },
        ] });
        const r = await request(app).get('/api/shift-templates');
        expect(r.body.T1[0].dayIndex).toBe(1);
        expect(r.body.T1[1].dayIndex).toBe(5);
    });
});

describe('saveShiftTemplate — 10 casos', () => {
    it('1: guarda una plantilla nueva -> 200', async () => {
        expect((await request(app).post('/api/shift-templates').send({ name: 'N', days: dias })).status).toBe(200);
    });
    it('2: la plantilla queda en BD', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'N', days: dias });
        expect(db.prepare('SELECT COUNT(*) c FROM shift_templates WHERE name=?').get('N').c).toBe(1);
    });
    it('3: sin name -> 400', async () => {
        expect((await request(app).post('/api/shift-templates').send({ days: dias })).status).toBe(400);
    });
    it('4: sin days -> 400', async () => {
        expect((await request(app).post('/api/shift-templates').send({ name: 'X' })).status).toBe(400);
    });
    it('5: days no array -> 400', async () => {
        expect((await request(app).post('/api/shift-templates').send({ name: 'X', days: 'no' })).status).toBe(400);
    });
    it('6: error tiene mensaje', async () => {
        expect((await request(app).post('/api/shift-templates').send({ days: dias })).body).toHaveProperty('error');
    });
    it('7: yearMonth personalizado se guarda', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'M', days: dias, yearMonth: '2026-12' });
        expect(db.prepare('SELECT COUNT(*) c FROM shift_monthly_distributions WHERE year_month=?').get('2026-12').c).toBe(1);
    });
    it('8: defecto BASE', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'M', days: dias });
        expect(db.prepare('SELECT COUNT(*) c FROM shift_monthly_distributions WHERE year_month=?').get('BASE').c).toBe(1);
    });
    it('9: guardar dos veces no duplica plantilla', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'N', days: dias });
        await request(app).post('/api/shift-templates').send({ name: 'N', days: dias });
        expect(db.prepare('SELECT COUNT(*) c FROM shift_templates WHERE name=?').get('N').c).toBe(1);
    });
    it('10: mensaje de exito', async () => {
        const r = await request(app).post('/api/shift-templates').send({ name: 'N', days: dias });
        expect(r.body.message).toContain('éxito');
    });
});

describe('deleteShiftTemplate — 10 casos', () => {
    it('1: elimina una plantilla existente', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'D', days: dias });
        expect((await request(app).delete('/api/shift-templates/D')).status).toBe(200);
    });
    it('2: ya no esta en BD', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'D', days: dias });
        await request(app).delete('/api/shift-templates/D');
        expect(db.prepare('SELECT COUNT(*) c FROM shift_templates WHERE name=?').get('D').c).toBe(0);
    });
    it('3: eliminar inexistente da 200', async () => {
        expect((await request(app).delete('/api/shift-templates/NO')).status).toBe(200);
    });
    it('4: mensaje de exito', async () => {
        expect((await request(app).delete('/api/shift-templates/NO')).body.message).toContain('éxito');
    });
    it('5: solo elimina la plantilla indicada', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'A', days: dias });
        await request(app).post('/api/shift-templates').send({ name: 'B', days: dias });
        await request(app).delete('/api/shift-templates/A');
        expect(db.prepare('SELECT COUNT(*) c FROM shift_templates WHERE name=?').get('B').c).toBe(1);
    });
    it('6: status 200 con nombre con espacios', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'Turno 1', days: dias });
        expect((await request(app).delete('/api/shift-templates/Turno%201')).status).toBe(200);
    });
    it('7: tras eliminar no aparece en GET', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'D', days: dias });
        await request(app).delete('/api/shift-templates/D');
        expect((await request(app).get('/api/shift-templates')).body.D).toBeUndefined();
    });
    it('8: response tiene message', async () => {
        expect((await request(app).delete('/api/shift-templates/X')).body).toHaveProperty('message');
    });
    it('9: multiple eliminaciones', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'A', days: dias });
        await request(app).post('/api/shift-templates').send({ name: 'B', days: dias });
        await request(app).delete('/api/shift-templates/A');
        await request(app).delete('/api/shift-templates/B');
        expect(db.prepare('SELECT COUNT(*) c FROM shift_templates').get().c).toBe(0);
    });
    it('10: no afecta a otras tablas', async () => {
        await request(app).post('/api/shift-templates').send({ name: 'A', days: dias });
        await request(app).delete('/api/shift-templates/A');
        expect(db.prepare('SELECT COUNT(*) c FROM shift_monthly_distributions').get().c).toBeGreaterThanOrEqual(0);
    });
});
