import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import authRoutes from '../routes/auth.routes.cjs';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', authRoutes);

describe('Auth Service Integration Tests', () => {
    it('rejects login with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'wrongpassword' });
        
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('succeeds login with valid default admin credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'adminpassword123' });
        
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.username).toBe('admin');
    });
});
