import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ser } from '../db/serialize.js';
import { requireAuth, requireRole, STAFF, STAFF_NO_OPERATOR } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound, badRequest } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { resolveMember } from './helpers.js';
import { effectiveFeeRule } from '../services/fees.js';
import { withTransaction, postLedger, postJournal, reverseLedgerAndJournal } from '../services/ledger.js';
import { writeAudit } from '../middleware/audit.js';
import { checkIdempotency, storeIdempotency } from '../middleware/idempotency.js';
const r = Router(); r.use(requireAuth);
const memberSelect = { select: { id: true, memberId: true, fullName: true, businessName: true } };
// Quantity model: one entry = N vehicles. quantity must be a positive integer
// (Zod rejects 0, negatives, non-integers and non-numbers with 400). No
// vehicleNumber/driver fields are required. Fee comes from the effective
// 'vehicle'/'standard' rule; the per-vehicle rate is snapshotted on the entry.
const schema = z.object({ memberId: z.string().min(1), quantity: z.number().int().positive(), entryDate: z.string().optional(), notes: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.memberId = m.id; } if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([prisma.vehicleEntry.findMany({ where: filter, orderBy: { entryDate: 'desc' }, skip, take: limit, include: { member: memberSelect } }), prisma.vehicleEntry.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), checkIdempotency, validate(schema), async (req, res, next) => {
  try {
    const member = await resolveMember(req.body.memberId);
    if (member.status === 'archived') throw badRequest('Cannot post entries for an archived member');
    const at = req.body.entryDate ? new Date(req.body.entryDate) : new Date();
    if (Number.isNaN(at.getTime())) throw badRequest('Invalid entryDate');
    const created = await withTransaction(async (tx) => {
      // Rejects with NO_FEE_RULE (400) when no effective vehicle rule exists.
      const rule = await effectiveFeeRule('vehicle', 'standard', at, tx);
      const total = req.body.quantity * rule.amount; // integer BDT: int x int
      const entry = await tx.vehicleEntry.create({ data: { memberId: member.id, quantity: req.body.quantity, vehicleCategory: 'standard', notes: req.body.notes, feePerVehicle: rule.amount, totalCharge: total, feeAmount: total, feeRuleId: rule.id, entryDate: at, createdById: req.user.id } });
      await postLedger({ memberId: member.id, kind: 'charge', sourceType: 'VehicleEntry', sourceId: entry.id, debit: total, description: `Vehicle fee ${req.body.quantity} x ${rule.amount}` }, tx);
      await postJournal({ memo: `Vehicle fee ${req.body.quantity} vehicles`, sourceType: 'VehicleEntry', sourceId: entry.id, memberId: member.id, lines: [{ account: '1100', debit: total, credit: 0 }, { account: '4000', debit: 0, credit: total }] }, tx);
      return entry;
    });
    await writeAudit({ actor: req.user, action: 'VEHICLE_ENTRY_CREATE', recordType: 'VehicleEntry', recordId: String(created.id), after: ser(created) });
    const body = { success: true, data: ser(created) }; await storeIdempotency(req, 201, body); res.status(201).json(body);
  } catch (e) { next(e); }
});
r.get('/:id', requireRole(...STAFF), async (req, res, next) => {
  try { const e = await prisma.vehicleEntry.findUnique({ where: { id: req.params.id }, include: { member: memberSelect } }); if (!e) throw notFound('Vehicle entry not found'); ok(res, ser(e)); } catch (err) { next(err); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const entry = await prisma.vehicleEntry.findUnique({ where: { id: req.params.id } }); if (!entry) throw notFound('Vehicle entry not found'); if (entry.status === 'reversed') throw badRequest('Entry already reversed');
    if ((entry.amountPaid || 0) > 0) throw badRequest('Cannot reverse a charge that already has payments allocated; reverse the payment first', 'CHARGE_HAS_PAYMENTS');
    await withTransaction(async (tx) => {
      const ledgers = await tx.ledgerEntry.findMany({ where: { sourceType: 'VehicleEntry', sourceId: entry.id, status: 'posted' } });
      const journal = await tx.journalEntry.findFirst({ where: { sourceType: 'VehicleEntry', sourceId: entry.id, status: 'posted' } });
      await reverseLedgerAndJournal({ ledgerRows: ledgers, journal, reason: req.body.reason }, tx);
      await tx.vehicleEntry.update({ where: { id: entry.id }, data: { status: 'reversed', reversalReason: req.body.reason } });
    });
    await writeAudit({ actor: req.user, action: 'VEHICLE_ENTRY_REVERSE', recordType: 'VehicleEntry', recordId: String(entry.id), reason: req.body.reason, before: { status: 'posted' }, after: { status: 'reversed' } });
    const updated = await prisma.vehicleEntry.findUnique({ where: { id: entry.id } });
    ok(res, ser(updated));
  } catch (e) { next(e); }
});
export default r;
