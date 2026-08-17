import { describe, expect, it } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-with-sufficient-length';
const { default: app } = await import('../app.js');

describe('API foundation', () => {
  it('describes the API at the root URL', async () => {
    const response = await request(app).get('/').expect(200);
    expect(response.body).toMatchObject({ success: true, service: 'FoundBack API', api: '/api' });
  });

  it('returns a structured health response', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.service).toBe('FoundBack API');
  });

  it('uses centralized JSON errors for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist').expect(404);
    expect(response.body).toMatchObject({ success: false });
    expect(response.body.message).toContain('not found');
  });

  it('validates public contact messages before persistence', async () => {
    const response = await request(app).post('/api/public/contact').send({ name: 'A', email: 'bad', subject: '', message: 'short' }).expect(422);
    expect(response.body.success).toBe(false);
  });
});
