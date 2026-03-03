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
    expect(claim.body.approval?.nextCommand).toBe('/simple_pair_approve');

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
    expect(second.status).toBe(200);
    expect(second.body.reused).toBe(true);
  });

  it('owner can approve latest pending without requestId', async () => {
    const app = createApp();
    const start = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    const resolve = await request(app).post('/pair/resolve').send({ code: start.body.shortCode });
    await request(app).post('/pair/claim').send({ sessionId: resolve.body.sessionId, client: { kind: 'web' } });

    const latest = await request(app).post('/pair/approve-latest').set('x-role', 'owner').send({});
    expect(latest.status).toBe(200);
    expect(latest.body.approved).toBe(true);
  });

  it('telegram explicit approve endpoint works with requestId', async () => {
    const app = createApp();
    const start = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    const resolve = await request(app).post('/pair/resolve').send({ code: start.body.shortCode });
    const claim = await request(app).post('/pair/claim').send({ sessionId: resolve.body.sessionId, client: { kind: 'web' } });

    const tgApprove = await request(app)
      .post('/telegram/simple_pair/approve')
      .set('x-telegram-owner', 'true')
      .send({ requestId: claim.body.requestId });
    expect(tgApprove.status).toBe(200);
    expect(tgApprove.body.approved).toBe(true);
  });

  it('handoff can be created after approval and redeemed once', async () => {
    const app = createApp();
    const start = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    const resolve = await request(app).post('/pair/resolve').send({ code: start.body.shortCode });
    const claim = await request(app).post('/pair/claim').send({ sessionId: resolve.body.sessionId, client: { kind: 'web' } });
    await request(app).post('/pair/approve').set('x-role', 'owner').send({ requestId: claim.body.requestId });

    const create = await request(app).post('/pair/handoff/create').send({ sessionId: resolve.body.sessionId });
    expect(create.status).toBe(200);
    const handoffId = create.body.handoffId;

    const redeem1 = await request(app).post('/pair/handoff/redeem').send({ handoffId });
    expect(redeem1.status).toBe(200);
    expect(redeem1.body.ok).toBe(true);

    const redeem2 = await request(app).post('/pair/handoff/redeem').send({ handoffId });
    expect(redeem2.status).toBe(409);
  });

  it('requires explicit selection when multiple pending exist', async () => {
    const app = createApp();
    // first pending
    const s1 = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    const r1 = await request(app).post('/pair/resolve').send({ code: s1.body.shortCode });
    await request(app).post('/pair/claim').send({ sessionId: r1.body.sessionId, client: { kind: 'web' } });

    // second pending (new simple_pair after first moved to pending_approval)
    const s2 = await request(app).post('/simple_pair').set('x-role', 'owner').send({ ttlSeconds: 120 });
    const r2 = await request(app).post('/pair/resolve').send({ code: s2.body.shortCode });
    await request(app).post('/pair/claim').send({ sessionId: r2.body.sessionId, client: { kind: 'web' } });

    const latest = await request(app).post('/pair/approve-latest').set('x-role', 'owner').send({});
    expect(latest.status).toBe(409);
    expect(latest.body.error.code).toBe('multiple_pending');
    expect(Array.isArray(latest.body.pending)).toBe(true);
    expect(latest.body.pending.length).toBeGreaterThan(1);
  });
});
