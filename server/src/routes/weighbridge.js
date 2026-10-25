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
const schema = z.object({ memberId: z.string().min(1), vehicleNumber: z.string().min(1), category: z.enum(['bhutan', 'bangladeshi', 'lorry-crab', 'trolley']), weightKg: z.number().positive().nullable().optional(), notes: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.memberId = m.id; } if (req.query.category) filter.category = req.query.category; if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([prisma.weighbridgeEntry.findMany({ where: filter, orderBy: { entryDate: 'desc' }, skip, take: limit, include: { member: memberSelect } }), prisma.weighbridgeEntry.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), checkIdempotency, validate(schema), async (req, res, next) => {
  try {
    const member = await resolveMember(req.body.memberId);
    if (member.status === 'archived') throw badRequest('Cannot post entries for an archived member');
    const created = await withTransaction(async (tx) => {
      const rule = await effectiveFeeRule('weighbridge', req.body.category, new Date(), tx);
      const entry = await tx.weighbridgeEntry.create({ data: { memberId: member.id, vehicleNumber: req.body.vehicleNumber, category: req.body.category, weightKg: req.body.weightKg ?? null, notes: req.body.notes, feeAmount: rule.amount, feeRuleId: rule.id, createdById: req.user.id } });
      await postLedger({ memberId: member.id, kind: 'charge', sourceType: 'WeighbridgeEntry', sourceId: entry.id, debit: rule.amount, description: `Weighbridge fee ${req.body.category} ${req.body.vehicleNumber}` }, tx);
      await postJournal({ memo: `Weighbridge fee ${req.body.category}`, sourceType: 'WeighbridgeEntry', sourceId: entry.id, memberId: member.id, lines: [{ account: '1100', debit: rule.amount, credit: 0 }, { account: '4100', debit: 0, credit: rule.amount }] }, tx);
      return entry;
    });
    await writeAudit({ actor: req.user, action: 'WEIGHBRIDGE_ENTRY_CREATE', recordType: 'WeighbridgeEntry', recordId: String(created.id), after: ser(created) });
    const body = { success: true, data: ser(created) }; await storeIdempotency(req, 201, body); res.status(201).json(body);
  } catch (e) { next(e); }
});
r.get('/:id', requireRole(...STAFF), async (req, res, next) => {
  try { const e = await prisma.weighbridgeEntry.findUnique({ where: { id: req.params.id }, include: { member: memberSelect } }); if (!e) throw notFound('Weighbridge entry not found'); ok(res, ser(e)); } catch (err) { next(err); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const entry = await prisma.weighbridgeEntry.findUnique({ where: { id: req.params.id } }); if (!entry) throw notFound('Weighbridge entry not found'); if (entry.status === 'reversed') throw badRequest('Entry already reversed');
    if ((entry.amountPaid || 0) > 0) throw badRequest('Cannot reverse a charge that already has payments allocated; reverse the payment first', 'CHARGE_HAS_PAYMENTS');
    await withTransaction(async (tx) => {
      const ledgers = await tx.ledgerEntry.findMany({ where: { sourceType: 'WeighbridgeEntry', sourceId: entry.id, status: 'posted' } });
      const journal = await tx.journalEntry.findFirst({ where: { sourceType: 'WeighbridgeEntry', sourceId: entry.id, status: 'posted' } });
      await reverseLedgerAndJournal({ ledgerRows: ledgers, journal, reason: req.body.reason }, tx);
      await tx.weighbridgeEntry.update({ where: { id: entry.id }, data: { status: 'reversed', reversalReason: req.body.reason } });
    });
    await writeAudit({ actor: req.user, action: 'WEIGHBRIDGE_ENTRY_REVERSE', recordType: 'WeighbridgeEntry', recordId: String(entry.id), reason: req.body.reason, before: { status: 'posted' }, after: { status: 'reversed' } });
    const updated = await prisma.weighbridgeEntry.findUnique({ where: { id: entry.id } });
    ok(res, ser(updated));
  } catch (e) { next(e); }
});
export default r;
