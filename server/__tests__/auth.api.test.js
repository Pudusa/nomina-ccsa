import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.cjs';

describe('Auth API Integration Tests', () => {
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

    it('blocks access to protected endpoints without token', async () => {
        const res = await request(app)
            .get('/api/workers');
        
        expect(res.status).toBe(401);
    });
});
