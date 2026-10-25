import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ser } from '../db/serialize.js';
import { requireAuth, requireRole, STAFF, STAFF_NO_OPERATOR } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound, badRequest } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { resolveMember } from './helpers.js';
import { withTransaction, postLedger, postJournal, memberOutstanding, outstandingCharges } from '../services/ledger.js';
import { checkOverpayment, allocatePayment } from '../services/accounting.js';
import { nextReceiptNo } from '../services/ids.js';
import { writeAudit } from '../middleware/audit.js';
import { checkIdempotency, storeIdempotency } from '../middleware/idempotency.js';
import { getSettings } from '../services/settings.js';
const r = Router(); r.use(requireAuth);
const memberSelect = { select: { id: true, memberId: true, fullName: true, businessName: true } };
const schema = z.object({ memberId: z.string().min(1), amount: z.number().int().positive(), method: z.enum(['cash', 'bank', 'bkash', 'nagad', 'other']).optional().default('cash'), reference: z.string().optional().default(''), notes: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.memberId = m.id; } if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([prisma.payment.findMany({ where: filter, orderBy: { paymentDate: 'desc' }, skip, take: limit, include: { member: memberSelect } }), prisma.payment.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), checkIdempotency, validate(schema), async (req, res, next) => {
  try {
    const member = await resolveMember(req.body.memberId);
    if (member.status === 'archived') throw badRequest('Cannot accept payments for an archived member');
    const settings = await getSettings();
    const created = await withTransaction(async (tx) => {
      const out = await memberOutstanding(member.id, tx);
      const { applied, advance } = checkOverpayment(out.outstanding, req.body.amount, settings.allowAdvancePayments);
      const receiptNo = await nextReceiptNo(tx);
      const payment = await tx.payment.create({ data: { receiptNo, memberId: member.id, amount: req.body.amount, appliedAmount: applied, advanceAmount: advance, method: req.body.method, reference: req.body.reference, notes: req.body.notes, receivedById: req.user.id } });
      if (applied > 0) {
        await postLedger({ memberId: member.id, kind: 'payment', sourceType: 'Payment', sourceId: payment.id, credit: applied, description: `Payment ${receiptNo}` }, tx);
        await postJournal({ memo: `Payment ${receiptNo}`, sourceType: 'Payment', sourceId: payment.id, memberId: member.id, lines: [{ account: '1000', debit: applied, credit: 0 }, { account: '1100', debit: 0, credit: applied }] }, tx);
        const charges = await outstandingCharges(member.id, tx);
        const { allocations } = allocatePayment(applied, charges.map((c) => ({ id: String(c.doc.id), remaining: c.remaining })));
        for (const a of allocations) {
          const ch = charges.find((c) => String(c.doc.id) === a.chargeId);
          await tx.paymentAllocation.create({ data: { paymentId: payment.id, memberId: member.id, chargeType: ch.type, chargeId: ch.doc.id, amount: a.amount } });
          const model = ch.type === 'vehicle' ? tx.vehicleEntry : tx.weighbridgeEntry;
          await model.update({ where: { id: ch.doc.id }, data: { amountPaid: { increment: a.amount } } });
        }
      }
      if (advance > 0) {
        await postLedger({ memberId: member.id, kind: 'unapplied', sourceType: 'Payment', sourceId: payment.id, credit: advance, description: `Advance / unapplied credit from ${receiptNo}` }, tx);
        await postJournal({ memo: `Advance credit ${receiptNo}`, sourceType: 'Payment', sourceId: payment.id, memberId: member.id, lines: [{ account: '1000', debit: advance, credit: 0 }, { account: '2100', debit: 0, credit: advance }] }, tx);
      }
      return payment;
    });
    await writeAudit({ actor: req.user, action: 'PAYMENT_CREATE', recordType: 'Payment', recordId: String(created.id), after: ser(created) });
    const body = { success: true, data: ser(created) }; await storeIdempotency(req, 201, body); res.status(201).json(body);
  } catch (e) { next(e); }
});
r.get('/:id', requireRole(...STAFF), async (req, res, next) => {
  try { const p = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { member: memberSelect } }); if (!p) throw notFound('Payment not found'); const allocations = await prisma.paymentAllocation.findMany({ where: { paymentId: p.id } }); ok(res, { ...ser(p), allocations: allocations.map(ser) }); } catch (e) { next(e); }
});
r.get('/:id/receipt', requireRole(...STAFF), async (req, res, next) => {
  try { const p = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { member: memberSelect } }); if (!p) throw notFound('Payment not found');
    const s = ser(p);
    ok(res, { receiptNo: s.receiptNo, member: s.member, amount: s.amount, appliedAmount: s.appliedAmount, advanceAmount: s.advanceAmount, method: s.method, reference: s.reference, paymentDate: s.paymentDate, status: s.status }); } catch (e) { next(e); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } }); if (!payment) throw notFound('Payment not found'); if (payment.status === 'reversed') throw badRequest('Payment already reversed');
    await withTransaction(async (tx) => {
      const ledgers = await tx.ledgerEntry.findMany({ where: { sourceType: 'Payment', sourceId: payment.id, status: 'posted' } });
      const journals = await tx.journalEntry.findMany({ where: { sourceType: 'Payment', sourceId: payment.id, status: 'posted' } });
      for (const j of journals) {
        const lines = await tx.journalLine.findMany({ where: { journalId: j.id } });
        const rev = await tx.journalEntry.create({ data: { memo: `Reversal: ${req.body.reason}`, sourceType: j.sourceType, sourceId: j.sourceId, memberId: j.memberId, status: 'posted', reversalOfId: j.id } });
        await tx.journalLine.createMany({ data: lines.map((l) => ({ journalId: rev.id, account: l.account, debit: l.credit, credit: l.debit })) });
        await tx.journalEntry.update({ where: { id: j.id }, data: { status: 'reversed' } });
      }
      for (const row of ledgers) {
        await tx.ledgerEntry.create({ data: { memberId: row.memberId, kind: row.kind, sourceType: row.sourceType, sourceId: row.sourceId, debit: row.credit, credit: row.debit, description: `Reversal: ${req.body.reason}`, status: 'posted', reversalOfId: row.id } });
        await tx.ledgerEntry.update({ where: { id: row.id }, data: { status: 'reversed' } });
      }
      // Undo allocations + amountPaid.
      const allocs = await tx.paymentAllocation.findMany({ where: { paymentId: payment.id, status: 'posted' } });
      for (const a of allocs) { const model = a.chargeType === 'vehicle' ? tx.vehicleEntry : tx.weighbridgeEntry; await model.update({ where: { id: a.chargeId }, data: { amountPaid: { decrement: a.amount } } }); await tx.paymentAllocation.update({ where: { id: a.id }, data: { status: 'reversed' } }); }
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'reversed', reversalReason: req.body.reason } });
    });
    await writeAudit({ actor: req.user, action: 'PAYMENT_REVERSE', recordType: 'Payment', recordId: String(payment.id), reason: req.body.reason, before: { status: 'posted' }, after: { status: 'reversed' } });
    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    ok(res, ser(updated));
  } catch (e) { next(e); }
});
export default r;
