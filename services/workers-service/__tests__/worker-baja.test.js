import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DB_PATH = path.join(os.tmpdir(), `workers-baja-${Date.now()}.sqlite`);
});

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database.cjs';
import workersRoutes from '../routes/workers.routes.cjs';

const ADMIN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
const EDITOR = jwt.sign({ id: 2, username: 'editor', role: 'editor' }, process.env.JWT_SECRET);
const VIEWER = jwt.sign({ id: 3, username: 'viewer', role: 'viewer' }, process.env.JWT_SECRET);
const app = express();
app.use(express.json());
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

describe('baja de trabajadores — 10 casos', () => {
    it('1: admin puede dar de baja desde una fecha', async () => {
        const res = await request(app)
            .put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '2026-11-21' });
        expect(res.status).toBe(200);
        expect(res.body.fechaBaja).toBe('2026-11-21');
        expect(db.prepare('SELECT fecha_baja FROM workers WHERE no = ?').get('123').fecha_baja).toBe('2026-11-21');
    });
    it('2: editor también puede dar de baja', async () => {
        const res = await request(app)
            .put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${EDITOR}`)
            .send({ fechaBaja: '2026-11-21' });
        expect(res.status).toBe(200);
    });
    it('3: viewer no puede dar de baja', async () => {
        const res = await request(app)
            .put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${VIEWER}`)
            .send({ fechaBaja: '2026-11-21' });
        expect(res.status).toBe(403);
    });
    it('4: rechaza una fecha con formato inválido', async () => {
        const res = await request(app)
            .put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '21/11/2026' });
        expect(res.status).toBe(400);
    });
    it('5: devuelve 404 si el trabajador no existe', async () => {
        const res = await request(app)
            .put('/api/workers/999/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '2026-11-21' });
        expect(res.status).toBe(404);
    });
    it('6: GET /api/workers sin asOf devuelve todos, incluidos dados de baja', async () => {
        await request(app).put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '2026-11-21' });
        const res = await request(app).get('/api/workers').set('Authorization', `Bearer ${ADMIN}`);
        expect(res.body).toHaveLength(2);
        expect(res.body.find(w => w.no === '123').fechaBaja).toBe('2026-11-21');
    });
    it('7: con asOf anterior a la baja, el trabajador sigue visible', async () => {
        await request(app).put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '2026-11-21' });
        const res = await request(app).get('/api/workers?asOf=2026-11-20').set('Authorization', `Bearer ${ADMIN}`);
        expect(res.body.map(w => w.no)).toEqual(['123', '456']);
    });
    it('8: con asOf igual a la baja, el trabajador se oculta', async () => {
        await request(app).put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '2026-11-21' });
        const res = await request(app).get('/api/workers?asOf=2026-11-21').set('Authorization', `Bearer ${ADMIN}`);
        expect(res.body.map(w => w.no)).toEqual(['456']);
    });
    it('9: con asOf posterior a la baja, sigue oculto', async () => {
        await request(app).put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '2026-11-21' });
        const res = await request(app).get('/api/workers?asOf=2026-11-25').set('Authorization', `Bearer ${ADMIN}`);
        expect(res.body.map(w => w.no)).toEqual(['456']);
    });
    it('10: reincorporar quita la fecha y lo devuelve al listado filtrado', async () => {
        await request(app).put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: '2026-11-21' });
        const res = await request(app).put('/api/workers/123/baja')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ fechaBaja: null });
        expect(res.body.fechaBaja).toBeNull();
        const list = await request(app).get('/api/workers?asOf=2026-11-25').set('Authorization', `Bearer ${ADMIN}`);
        expect(list.body.map(w => w.no)).toEqual(['123', '456']);
    });
});
