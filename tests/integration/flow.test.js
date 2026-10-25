import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { startTestDb, stopTestDb, makeStaff, makeMember } from './setup.js';
import { User } from '../../server/src/models/User.js';
import { AuditLog } from '../../server/src/models/AuditLog.js';
import { FeeRule } from '../../server/src/models/FeeRule.js';
let app, agent;
beforeAll(async () => { app = await startTestDb(); const staff = await makeStaff('SUPER_ADMIN'); agent = request.agent(app); await agent.post('/api/v1/auth/login').send({ email: staff.email, password: 'password123' }).expect(200); }, 600000);
afterAll(async () => { await stopTestDb(); }, 120000);
describe('AI Studio sections: leaders, accounts, audit log, future-only fees, settings status', () => {
  // Runs BEFORE the e2e describe in this file (no journals exist yet at the
  // first test), and the fee-flow test uses only the trolley category so the
  // later bhutan/vehicle-rate assertions are untouched. Test fixtures only.
  let operatorAgent = null;
  async function operator() {
    if (operatorAgent) return operatorAgent;
    const u = await makeStaff('OPERATOR'); const a = request.agent(app);
    await a.post('/api/v1/auth/login').send({ email: u.email, password: 'password123' }).expect(200);
    operatorAgent = a; return a;
  }
  it('accounts endpoint shows only zero balances with no transactions', async () => {
    const r = await agent.get('/api/v1/accounting/accounts').expect(200);
    // Bootstrap seeds the 6 chart accounts; with no journals yet every
    // balance must be exactly 0 — no invented amounts.
    expect(r.body.data.items.length).toBeGreaterThan(0);
    expect(r.body.data.items.every((x) => x.debit === 0 && x.credit === 0 && x.balance === 0)).toBe(true);
    expect(r.body.data.total).toBe(r.body.data.items.length);
  });
  it('accounts endpoint sums journal lines after a posted charge', async () => {
    const m = await makeMember();
    const w = await agent.post('/api/v1/weighbridge').send({ memberId: m.memberId, vehicleNumber: 'TEST-1', category: 'bhutan' }).expect(201);
    expect(w.body.data.feeAmount).toBe(100);
    const r = await agent.get('/api/v1/accounting/accounts').expect(200);
    const byCode = Object.fromEntries(r.body.data.items.map((x) => [x.code, x]));
    expect(byCode['1100']).toMatchObject({ debit: 100, credit: 0, balance: 100 });
    expect(byCode['4100']).toMatchObject({ debit: 0, credit: 100, balance: -100 });
  });
  it('leaders CRUD, public listing hides mobile, non-admin/unauth writes rejected', async () => {
    await request(app).post('/api/v1/leaders').send({ nameBn: 'X', designationBn: 'Y' }).expect(401);
    const op = await operator();
    await op.post('/api/v1/leaders').send({ nameBn: 'X', designationBn: 'Y' }).expect(403);
    const created = await agent.post('/api/v1/leaders').send({ nameBn: 'Test Name BN', nameEn: 'Test Name', designationBn: 'Test Designation', designationEn: 'Executive Member', firm: 'Test Firm', displayOrder: 1, mobile: '01000000000', photoUrl: 'https://example.test/photo.jpg' }).expect(201);
    const id = created.body.data._id;
    const pub = await request(app).get('/api/v1/public/leaders').expect(200);
    const row = pub.body.data.items.find((x) => x._id === id);
    expect(row).toBeDefined(); expect(row).not.toHaveProperty('mobile');
    expect(row).toMatchObject({ nameBn: 'Test Name BN', designationBn: 'Test Designation', firm: 'Test Firm', displayOrder: 1 });
    await agent.patch(`/v1/leaders/${id}`.replace('/v1/', '/api/v1/')).send({ designationEn: 'President' }).expect(200);
    const list = await agent.get('/api/v1/leaders').expect(200);
    expect(list.body.data.items.find((x) => x._id === id).designationEn).toBe('President');
    await agent.patch(`/api/v1/leaders/${id}`).send({ active: false }).expect(200); // soft archive, never hard delete
    const pub2 = await request(app).get('/api/v1/public/leaders').expect(200);
    expect(pub2.body.data.items.find((x) => x._id === id)).toBeUndefined();
    const list2 = await agent.get('/api/v1/leaders').expect(200);
    expect(list2.body.data.items.find((x) => x._id === id).active).toBe(false);
  });
  it('audit-logs endpoint returns real logs paginated and rejects non-admin roles', async () => {
    const op = await operator();
    await op.get('/api/v1/accounting/audit-logs').expect(403);
    const r = await agent.get('/api/v1/accounting/audit-logs?limit=5').expect(200);
    expect(r.body.data.items.length).toBeGreaterThan(0); expect(r.body.data.totalPages).toBeGreaterThanOrEqual(1);
    expect(r.body.data.items[0]).toHaveProperty('action'); expect(r.body.data.items[0]).toHaveProperty('recordType');
    const f = await agent.get('/api/v1/accounting/audit-logs?action=LEADER_CREATE').expect(200);
    expect(f.body.data.items.length).toBeGreaterThan(0);
    expect(f.body.data.items.every((x) => x.action === 'LEADER_CREATE')).toBe(true);
  });
  it('fee change is future-only: old rule closed, new rule effective, old snapshot unchanged', async () => {
    const m = await makeMember();
    const oldEntry = await agent.post('/api/v1/weighbridge').send({ memberId: m.memberId, vehicleNumber: 'TEST-OLD', category: 'trolley' }).expect(201);
    expect(oldEntry.body.data.feeAmount).toBe(300);
    const rules = await agent.get('/api/v1/fee-rules?scope=weighbridge&category=trolley&limit=100').expect(200);
    const current = rules.body.data.items.filter((x) => !x.effectiveTo).sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0];
    expect(current.amount).toBe(300);
    const eff = new Date().toISOString();
    await agent.patch(`/api/v1/fee-rules/${current._id}`).send({ effectiveTo: eff }).expect(200);
    await agent.post('/api/v1/fee-rules').send({ scope: 'weighbridge', category: 'trolley', amount: 175, effectiveFrom: eff, reason: 'test future-only change' }).expect(201);
    const newEntry = await agent.post('/api/v1/weighbridge').send({ memberId: m.memberId, vehicleNumber: 'TEST-NEW', category: 'trolley' }).expect(201);
    expect(newEntry.body.data.feeAmount).toBe(175);
    const after = await agent.get('/api/v1/fee-rules?scope=weighbridge&category=trolley&limit=100').expect(200);
    expect(after.body.data.items.find((x) => x._id === current._id).effectiveTo).toBeTruthy();
    expect(oldEntry.body.data.feeAmount).toBe(300); // snapshot untouched
  });
  it('settings/status rejects non-admin and returns counts without secrets', async () => {
    const op = await operator();
    await op.get('/api/v1/settings/status').expect(403);
    await request(app).get('/api/v1/settings/status').expect(401);
    const r = await agent.get('/api/v1/settings/status').expect(200);
    expect(r.body.data.db.connected).toBe(true);
    expect(r.body.data.app.name).toBe('nakugaon-association-server'); expect(typeof r.body.data.app.version).toBe('string');
    for (const k of ['members', 'vehicleEntries', 'weighbridgeEntries', 'payments', 'expenses', 'notices', 'leaders', 'auditLogs']) expect(typeof r.body.data.counts[k]).toBe('number');
    expect(JSON.stringify(r.body)).not.toMatch(/mongodb:|jwt|secret|password/i);
  });
});

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

describe('change-password (logged-in user only, own account)', () => {
  // Test fixture account only — not a real user credential.
  const OLD = 'OldPassword123';
  const NEW = 'NewPassword123';
  let user, agent;
  beforeAll(async () => {
    user = await User.create({ name: 'ChangePw Staff', email: 'changepw@test.local', passwordHash: await bcrypt.hash(OLD, 10), role: 'SUPER_ADMIN' });
    agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email: user.email, password: OLD }).expect(200);
  });
  it('rejects unauthenticated requests', async () => {
    await request(app).post('/api/v1/auth/change-password').send({ currentPassword: OLD, newPassword: NEW, confirmPassword: NEW }).expect(401);
  });
  it('rejects a wrong current password and keeps the old password working', async () => {
    await agent.post('/api/v1/auth/change-password').send({ currentPassword: 'WrongPassword123', newPassword: NEW, confirmPassword: NEW }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: user.email, password: OLD }).expect(200);
  });
  it('rejects a short new password', async () => {
    await agent.post('/api/v1/auth/change-password').send({ currentPassword: OLD, newPassword: 'short', confirmPassword: 'short' }).expect(400);
  });
  it('rejects a new password identical to the current password', async () => {
    await agent.post('/api/v1/auth/change-password').send({ currentPassword: OLD, newPassword: OLD, confirmPassword: OLD }).expect(400);
  });
  it('rejects a mismatched confirmation', async () => {
    await agent.post('/api/v1/auth/change-password').send({ currentPassword: OLD, newPassword: NEW, confirmPassword: 'Different123' }).expect(400);
  });
  it('changes the password, writes an audit entry with no password values, and only the new password logs in', async () => {
    const res = await agent.post('/api/v1/auth/change-password').send({ currentPassword: OLD, newPassword: NEW, confirmPassword: NEW }).expect(200);
    expect(res.body.data.passwordChanged).toBe(true);
    const audit = await AuditLog.findOne({ action: 'PASSWORD_CHANGE', recordId: String(user._id) }).lean();
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit)).not.toContain(OLD);
    expect(JSON.stringify(audit)).not.toContain(NEW);
    await request(app).post('/api/v1/auth/login').send({ email: user.email, password: OLD }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: user.email, password: NEW }).expect(200);
  });
});
