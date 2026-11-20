import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// El middleware exige JWT_SECRET antes de cargar los módulos del servicio.
vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.JWT_SECRET = 'test-jwt-secret-nomina-ccsa';
    // Usar una DB temporal para los tests de autenticación
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

const ADMIN_PASSWORD = 'test-admin-password';

beforeAll(() => {
    // Asegurarse de que la DB temporal se inicialice correctamente
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            activo INTEGER NOT NULL DEFAULT 1,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);

    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare("INSERT INTO users (username, password_hash, role, activo) VALUES (?, ?, 'admin', 1)")
        .run('admin', hash);
});

afterAll(async () => {
    // Limpiar la DB temporal después de los tests
    db.close();
    // Intentar eliminar el archivo con un pequeño retraso, especialmente en Windows
    const cleanup = () => {
        try {
            fs.unlinkSync(process.env.DB_PATH);
        } catch (e) {
            console.warn(`[Cleanup] Fallo al eliminar DB temporal: ${e.message}`);
        }
    };
    setTimeout(cleanup, 100);
});

describe('Auth Service Integration Tests', () => {
    it('rejects login with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('succeeds login with seeded admin credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: ADMIN_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.username).toBe('admin');
    });
});
