import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import jwt from 'jsonwebtoken';

// El middleware exige JWT_SECRET antes de cargar los módulos del servicio.
vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret-nomina-ccsa';
    process.env.DB_PATH = path.join(os.tmpdir(), `auth-test-${Date.now()}.sqlite`);
});

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import authRoutes from '../routes/auth.routes.cjs';
import db from '../database.cjs';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', authRoutes);

// Usuarios SOLO en la BD temporal de test (nunca en la BD real).
const USERS = [
    { username: 'admin', password: 'AdminPass123', role: 'admin', activo: 1 },
    { username: 'editor', password: 'EditorPass123', role: 'editor', activo: 1 },
    { username: 'viewer', password: 'ViewerPass123', role: 'viewer', activo: 1 },
    { username: 'test_user', password: 'TestPass123', role: 'viewer', activo: 1 },
    { username: 'inactivo', password: 'InactivePass123', role: 'viewer', activo: 0 },
];

beforeAll(() => {
    USERS.forEach((u) => {
        const hash = bcrypt.hashSync(u.password, 10);
        db.prepare('INSERT INTO users (username, password_hash, role, activo, must_change_password) VALUES (?, ?, ?, ?, 1)')
            .run(u.username, hash, u.role, u.activo);
    });
});

afterAll(async () => {
    db.close();
    setTimeout(() => {
        try { fs.unlinkSync(process.env.DB_PATH); } catch (e) { /* ya borrado */ }
    }, 100);
});

describe('POST /api/auth/login — 10 casos', () => {
    // --- 5 que ACEPTAN ---
    it('1: admin con credenciales correctas -> 200', async () => {
        const r = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'AdminPass123' });
        expect(r.status).toBe(200);
    });
    it('2: devuelve token JWT valido', async () => {
        const r = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'AdminPass123' });
        const payload = jwt.verify(r.body.token, process.env.JWT_SECRET);
        expect(payload.username).toBe('admin');
        expect(payload.role).toBe('admin');
    });
    it('3: el rol editor se refleja en la respuesta', async () => {
        const r = await request(app).post('/api/auth/login').send({ username: 'editor', password: 'EditorPass123' });
        expect(r.body.user.role).toBe('editor');
    });
    it('4: el rol viewer se refleja en el token', async () => {
        const r = await request(app).post('/api/auth/login').send({ username: 'viewer', password: 'ViewerPass123' });
        expect(jwt.verify(r.body.token, process.env.JWT_SECRET).role).toBe('viewer');
    });
    it('5: usuario test_user puede autenticarse (solo en BD temporal)', async () => {
        const r = await request(app).post('/api/auth/login').send({ username: 'test_user', password: 'TestPass123' });
        expect(r.status).toBe(200);
        expect(r.body.user.username).toBe('test_user');
    });

    // --- 5 que RECHAZAN ---
    it('6: contraseña incorrecta -> 401', async () => {
        expect((await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' })).status).toBe(401);
    });
    it('7: usuario inexistente -> 401', async () => {
        expect((await request(app).post('/api/auth/login').send({ username: 'no_existe', password: 'x' })).status).toBe(401);
    });
    it('8: sin username -> 400', async () => {
        expect((await request(app).post('/api/auth/login').send({ password: 'x' })).status).toBe(400);
    });
    it('9: sin password -> 400', async () => {
        expect((await request(app).post('/api/auth/login').send({ username: 'admin' })).status).toBe(400);
    });
    it('10: usuario inactivo -> 401', async () => {
        expect((await request(app).post('/api/auth/login').send({ username: 'inactivo', password: 'InactivePass123' })).status).toBe(401);
    });
});
