import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('simple pair api', () => {
  const app = createApp();

  it('blocks viewer from starting pair', async () => {
    const r = await request(app).post('/simple_pair').set('x-role','viewer').send({});
    expect(r.status).toBe(403);
  });

  it('owner can start, claim and approve', async () => {
    const start = await request(app).post('/simple_pair').set('x-role','owner').send({ ttlSeconds: 120 });
    expect(start.status).toBe(200);
    const { shortCode } = start.body;

    const resolve = await request(app).post('/pair/resolve').send({ code: shortCode });
    expect(resolve.status).toBe(200);
    const sid = resolve.body.sessionId;

    const claim = await request(app).post('/pair/claim').send({ sessionId: sid, client: { kind: 'web' } });
    expect(claim.status).toBe(200);

    const approveViewer = await request(app).post('/pair/approve').set('x-role','viewer').send({ requestId: claim.body.requestId });
    expect(approveViewer.status).toBe(403);

    const approveOwner = await request(app).post('/pair/approve').set('x-role','owner').send({ requestId: claim.body.requestId });
    expect(approveOwner.status).toBe(200);
  });
});
