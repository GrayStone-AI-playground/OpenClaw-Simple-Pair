import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('simple pair api', () => {
  it('blocks viewer from starting pair', async () => {
    const app = createApp();
    const r = await request(app).post('/simple_pair').set('x-role', 'viewer').send({});
    expect(r.status).toBe(403);
  });

  it('pair page is gated by active pairing window', async () => {
    const app = createApp();
    const before = await request(app).get('/pair');
    expect(before.status).toBe(404);

    await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    const after = await request(app).get('/pair');
    expect(after.status).toBe(200);
  });

  it('owner can start, resolve, claim and approve', async () => {
    const app = createApp();
    const start = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    expect(start.status).toBe(200);
    const { shortCode } = start.body;

    const resolve = await request(app).post('/pair/resolve').send({ code: shortCode });
    expect(resolve.status).toBe(200);
    const sid = resolve.body.sessionId;

    const claim = await request(app).post('/pair/claim').send({ sessionId: sid, client: { kind: 'web' } });
    expect(claim.status).toBe(200);

    const approveViewer = await request(app)
      .post('/pair/approve')
      .set('x-role', 'viewer')
      .send({ requestId: claim.body.requestId });
    expect(approveViewer.status).toBe(403);

    const approveOwner = await request(app)
      .post('/pair/approve')
      .set('x-role', 'owner')
      .send({ requestId: claim.body.requestId });
    expect(approveOwner.status).toBe(200);
  });

  it('enforces single active session policy', async () => {
    const app = createApp();
    const first = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    expect(first.status).toBe(200);

    const second = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    expect(second.status).toBe(409);
  });
});
