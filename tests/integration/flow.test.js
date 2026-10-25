import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestDb, stopTestDb, makeStaff, makeMember } from './setup.js';
import { FeeRule } from '../../server/src/models/FeeRule.js';
let app, agent;
beforeAll(async () => { app = await startTestDb(); const staff = await makeStaff('SUPER_ADMIN'); agent = request.agent(app); await agent.post('/api/v1/auth/login').send({ email: staff.email, password: 'password123' }).expect(200); }, 600000);
afterAll(async () => { await stopTestDb(); }, 120000);
describe('end-to-end member -> charge -> payment -> statement', () => {
  it('creates member with NAK id, posts weighbridge charge from contract rate, pays partially, statement reconciles', async () => {
    const m = await agent.post('/api/v1/members').send({ fullName: 'Ayesha Traders', businessName: 'Ayesha' }).expect(201);
    expect(m.body.data.memberId).toMatch(/^NAK-\d{4}$/);
    const mid = m.body.data.memberId;
    // weighbridge bhutan = 100 (contract default seeded by bootstrap)
    const w = await agent.post('/api/v1/weighbridge').send({ memberId: mid, vehicleNumber: 'DHAKA-123', category: 'bhutan' }).expect(201);
    expect(w.body.data.feeAmount).toBe(100);
    // overpayment rejected by default
    await agent.post('/api/v1/payments').send({ memberId: mid, amount: 101 }).expect(400);
    const p = await agent.post('/api/v1/payments').set('Idempotency-Key', 'pay-1').send({ memberId: mid, amount: 60 }).expect(201);
    expect(p.body.data.receiptNo).toMatch(/^REC-\d{8}-\d{4}$/);
    // idempotent replay returns same receipt, no duplicate
    const replay = await agent.post('/api/v1/payments').set('Idempotency-Key', 'pay-1').send({ memberId: mid, amount: 60 }).expect(201);
    expect(replay.body.data.receiptNo).toBe(p.body.data.receiptNo);
    const st = await agent.get(`/api/v1/members/${mid}/statement`).expect(200);
    expect(st.body.data.totals.outstanding).toBe(40);
    expect(st.body.data.totals.charges).toBe(100);
    expect(st.body.data.totals.payments).toBe(60);
    // reversal of payment restores outstanding
    await agent.post(`/api/v1/payments/${p.body.data._id}/reverse`).send({ reason: 'wrong entry' }).expect(200);
    const st2 = await agent.get(`/api/v1/members/${mid}/statement`).expect(200);
    expect(st2.body.data.totals.outstanding).toBe(100);
  });
  it('vehicle entries are quantity-based at the seeded ৳50 standard rate (1x50, 5x50)', async () => {
    const m = await makeMember();
    const one = await agent.post('/api/v1/vehicle-entries').send({ memberId: m.memberId, quantity: 1 }).expect(201);
    expect(one.body.data.quantity).toBe(1);
    expect(one.body.data.feePerVehicle).toBe(50);
    expect(one.body.data.totalCharge).toBe(50);
    expect(one.body.data.feeAmount).toBe(50);
    expect(one.body.data.feeRule).toBeTruthy();
    const five = await agent.post('/api/v1/vehicle-entries').send({ memberId: m.memberId, quantity: 5, notes: 'batch' }).expect(201);
    expect(five.body.data.quantity).toBe(5);
    expect(five.body.data.feePerVehicle).toBe(50);
    expect(five.body.data.totalCharge).toBe(250);
    expect(five.body.data.feeAmount).toBe(250);
    const st = await agent.get(`/api/v1/members/${m.memberId}/statement`).expect(200);
    expect(st.body.data.totals.charges).toBe(300);
    expect(st.body.data.totals.outstanding).toBe(300);
  });
  it('vehicle entries reject quantity 0, negative, non-integer and missing quantity', async () => {
    const m = await makeMember();
    for (const q of [0, -3, 1.5, '5']) await agent.post('/api/v1/vehicle-entries').send({ memberId: m.memberId, quantity: q }).expect(400);
    await agent.post('/api/v1/vehicle-entries').send({ memberId: m.memberId }).expect(400);
    const st = await agent.get(`/api/v1/members/${m.memberId}/statement`).expect(200);
    expect(st.body.data.totals.outstanding).toBe(0);
  });
  it('vehicle entry idempotent replay returns the same entry with no duplicate charge', async () => {
    const m = await makeMember();
    const first = await agent.post('/api/v1/vehicle-entries').set('Idempotency-Key', 'veh-1').send({ memberId: m.memberId, quantity: 2 }).expect(201);
    expect(first.body.data.totalCharge).toBe(100);
    const replay = await agent.post('/api/v1/vehicle-entries').set('Idempotency-Key', 'veh-1').send({ memberId: m.memberId, quantity: 2 }).expect(201);
    expect(replay.body.data._id).toBe(first.body.data._id);
    expect(replay.body.data.totalCharge).toBe(100);
    const list = await agent.get(`/api/v1/vehicle-entries?memberId=${m.memberId}`).expect(200);
    expect(list.body.data.items).toHaveLength(1);
    const st = await agent.get(`/api/v1/members/${m.memberId}/statement`).expect(200);
    expect(st.body.data.totals.outstanding).toBe(100);
  });
  it('vehicle reversal preserves the original and is refused once payments are allocated', async () => {
    const m = await makeMember();
    const v = await agent.post('/api/v1/vehicle-entries').send({ memberId: m.memberId, quantity: 2 }).expect(201);
    await agent.post('/api/v1/payments').send({ memberId: m.memberId, amount: 50 }).expect(201);
    await agent.post(`/api/v1/vehicle-entries/${v.body.data._id}/reverse`).send({ reason: 'too late' }).expect(400);
    const m2 = await makeMember();
    const v2 = await agent.post('/api/v1/vehicle-entries').send({ memberId: m2.memberId, quantity: 2 }).expect(201);
    const rev = await agent.post(`/api/v1/vehicle-entries/${v2.body.data._id}/reverse`).send({ reason: 'wrong entry' }).expect(200);
    expect(rev.body.data.status).toBe('reversed');
    expect(rev.body.data.totalCharge).toBe(100); // original amount untouched
    const st = await agent.get(`/api/v1/members/${m2.memberId}/statement`).expect(200);
    expect(st.body.data.totals.outstanding).toBe(0);
  });
  it('public members hide phone and balance by default; only published notices are public', async () => {
    const pub = await request(app).get('/api/v1/public/members').expect(200);
    expect(pub.body.data.items.length).toBeGreaterThan(0);
    expect(pub.body.data.items[0]).not.toHaveProperty('phone');
    expect(pub.body.data.items[0]).not.toHaveProperty('outstanding');
    const n = await agent.post('/api/v1/notices').send({ title: 'Draft notice', body: 'hello' }).expect(201);
    const pubN = await request(app).get('/api/v1/public/notices').expect(200);
    expect(pubN.body.data.items.find((x) => x._id === n.body.data._id)).toBeUndefined();
    await agent.post(`/api/v1/notices/${n.body.data._id}/publish`).expect(200);
    const pubN2 = await request(app).get('/api/v1/public/notices').expect(200);
    expect(pubN2.body.data.items.find((x) => x._id === n.body.data._id)).toBeDefined();
  });
  it('dashboard summary reflects real data only', async () => {
    const d = await agent.get('/api/v1/dashboard/summary').expect(200);
    expect(d.body.data.totalOutstanding).toBeGreaterThanOrEqual(0);
    expect(typeof d.body.data.activeMembers).toBe('number');
  });
  it('unauthenticated staff endpoints are rejected', async () => {
    await request(app).get('/api/v1/members').expect(401);
  });
});
