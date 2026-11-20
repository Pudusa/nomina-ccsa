import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DB_PATH = path.join(os.tmpdir(), `zk-config-${Date.now()}.sqlite`);
});

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database.cjs';
import attendanceRoutes from '../routes/attendance.routes.cjs';

const ADMIN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
const VIEWER = jwt.sign({ id: 2, username: 'viewer', role: 'viewer' }, process.env.JWT_SECRET);
const app = express();
app.use(express.json());
app.use('/api', attendanceRoutes);

beforeEach(() => {
    db.exec(`
        DELETE FROM zk_devices;
        UPDATE zk_settings SET sync_hour = 0, sync_minute = 0, enabled = 1, last_sync_date = NULL WHERE id = 1;
    `);
});
afterAll(() => {
    db.close();
});

describe('configuración ZK por HTTP — 5 casos', () => {
    it('1: rechaza una IP con formato inválido', async () => {
        const res = await request(app)
            .put('/api/attendance/zk/config')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ hour: 12, minute: 30, enabled: true, devices: [{ ip: 'no-es-una-ip' }] });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('IPv4');
    });
    it('2: rechaza un octeto fuera de rango', async () => {
        const res = await request(app)
            .put('/api/attendance/zk/config')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ hour: 12, minute: 30, enabled: true, devices: [{ ip: '192.168.999.1' }] });
        expect(res.status).toBe(400);
    });
    it('3: guarda la configuración con una IP válida', async () => {
        const res = await request(app)
            .put('/api/attendance/zk/config')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({
                hour: 12, minute: 30, enabled: true,
                devices: [{ name: 'Reloj 1', ip: '192.168.107.13', port: 4370, commKey: 0 }],
            });
        expect(res.status).toBe(200);
        expect(res.body.settings.syncHour).toBe(12);
        expect(res.body.devices[0].ip).toBe('192.168.107.13');
    });
    it('4: devuelve la configuración guardada al administrador', async () => {
        await request(app)
            .put('/api/attendance/zk/config')
            .set('Authorization', `Bearer ${ADMIN}`)
            .send({ hour: 9, minute: 15, enabled: true, devices: [{ ip: '10.0.0.5' }] });
        const res = await request(app)
            .get('/api/attendance/zk/config')
            .set('Authorization', `Bearer ${ADMIN}`);
        expect(res.status).toBe(200);
        expect(res.body.settings.syncMinute).toBe(15);
        expect(res.body.devices).toHaveLength(1);
    });
    it('5: niega el acceso a un rol que no es administrador', async () => {
        const res = await request(app)
            .get('/api/attendance/zk/config')
            .set('Authorization', `Bearer ${VIEWER}`);
        expect(res.status).toBe(403);
    });
});
