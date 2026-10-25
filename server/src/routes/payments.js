import { Router } from 'express';
import { z } from 'zod';
import { Payment } from '../models/Payment.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { requireAuth, requireRole, STAFF, STAFF_NO_OPERATOR } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound, badRequest } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { resolveMember } from './helpers.js';
import { withTransaction, postLedger, postJournal, memberOutstanding, outstandingCharges } from '../services/ledger.js';
import { checkOverpayment, allocatePayment } from '../services/accounting.js';
import { nextReceiptNo } from '../services/ids.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { writeAudit } from '../middleware/audit.js';
import { checkIdempotency, storeIdempotency } from '../middleware/idempotency.js';
import { getSettings } from '../services/settings.js';
import { JournalLine } from '../models/JournalLine.js';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { WeighbridgeEntry } from '../models/WeighbridgeEntry.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ memberId: z.string().min(1), amount: z.number().int().positive(), method: z.enum(['cash', 'bank', 'bkash', 'nagad', 'other']).optional().default('cash'), reference: z.string().optional().default(''), notes: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.member = m._id; } if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([Payment.find(filter).sort({ paymentDate: -1 }).skip(skip).limit(limit).populate('member', 'memberId fullName businessName').lean(), Payment.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), checkIdempotency, validate(schema), async (req, res, next) => {
  try {
    const member = await resolveMember(req.body.memberId);
    if (member.status === 'archived') throw badRequest('Cannot accept payments for an archived member');
    const settings = await getSettings();
    const created = await withTransaction(async (session) => {
      const out = await memberOutstanding(member._id, session);
      const { applied, advance } = checkOverpayment(out.outstanding, req.body.amount, settings.allowAdvancePayments);
      const receiptNo = await nextReceiptNo(session);
      const docs = await Payment.create([{ receiptNo, member: member._id, amount: req.body.amount, appliedAmount: applied, advanceAmount: advance, method: req.body.method, reference: req.body.reference, notes: req.body.notes, receivedBy: req.user.id }], session ? { session } : {});
      const payment = docs[0];
      if (applied > 0) {
        await postLedger({ member: member._id, kind: 'payment', sourceType: 'Payment', sourceId: payment._id, credit: applied, description: `Payment ${receiptNo}` }, session);
        await postJournal({ memo: `Payment ${receiptNo}`, sourceType: 'Payment', sourceId: payment._id, member: member._id, lines: [{ account: '1000', debit: applied, credit: 0 }, { account: '1100', debit: 0, credit: applied }] }, session);
        const charges = await outstandingCharges(member._id, session);
        const { allocations } = allocatePayment(applied, charges.map((c) => ({ id: String(c.doc._id), remaining: c.remaining })));
        for (const a of allocations) {
          const ch = charges.find((c) => String(c.doc._id) === a.chargeId);
          await PaymentAllocation.create([{ payment: payment._id, member: member._id, chargeType: ch.type, chargeId: ch.doc._id, amount: a.amount }], session ? { session } : {});
          const Model = ch.type === 'vehicle' ? VehicleEntry : WeighbridgeEntry;
          await Model.updateOne({ _id: ch.doc._id }, { $inc: { amountPaid: a.amount } }, session ? { session } : {});
        }
      }
      if (advance > 0) {
        await postLedger({ member: member._id, kind: 'unapplied', sourceType: 'Payment', sourceId: payment._id, credit: advance, description: `Advance / unapplied credit from ${receiptNo}` }, session);
        await postJournal({ memo: `Advance credit ${receiptNo}`, sourceType: 'Payment', sourceId: payment._id, member: member._id, lines: [{ account: '1000', debit: advance, credit: 0 }, { account: '2100', debit: 0, credit: advance }] }, session);
      }
      return payment;
    });
    await writeAudit({ actor: req.user, action: 'PAYMENT_CREATE', recordType: 'Payment', recordId: String(created._id), after: created.toObject() });
    const body = { success: true, data: created }; await storeIdempotency(req, 201, body); res.status(201).json(body);
  } catch (e) { next(e); }
});
r.get('/:id', requireRole(...STAFF), async (req, res, next) => {
  try { const p = await Payment.findById(req.params.id).populate('member', 'memberId fullName businessName'); if (!p) throw notFound('Payment not found'); const allocations = await PaymentAllocation.find({ payment: p._id }).lean(); ok(res, { ...p.toObject(), allocations }); } catch (e) { next(e); }
});
r.get('/:id/receipt', requireRole(...STAFF), async (req, res, next) => {
  try { const p = await Payment.findById(req.params.id).populate('member', 'memberId fullName businessName'); if (!p) throw notFound('Payment not found');
    ok(res, { receiptNo: p.receiptNo, member: p.member, amount: p.amount, appliedAmount: p.appliedAmount, advanceAmount: p.advanceAmount, method: p.method, reference: p.reference, paymentDate: p.paymentDate, status: p.status }); } catch (e) { next(e); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id); if (!payment) throw notFound('Payment not found'); if (payment.status === 'reversed') throw badRequest('Payment already reversed');
    await withTransaction(async (session) => {
      const ledgers = await LedgerEntry.find({ sourceType: 'Payment', sourceId: payment._id, status: 'posted' }, null, session ? { session } : {});
      const journals = await JournalEntry.find({ sourceType: 'Payment', sourceId: payment._id, status: 'posted' }, null, session ? { session } : {});
      for (const j of journals) { const lines = await JournalLineFind(j, session); await reverseJournalOnly(j, lines, req.body.reason, session); }
      for (const row of ledgers) {
        await LedgerEntry.create([{ member: row.member, kind: row.kind, sourceType: row.sourceType, sourceId: row.sourceId, debit: row.credit, credit: row.debit, description: `Reversal: ${req.body.reason}`, status: 'posted', reversalOf: row._id }], session ? { session } : {});
        await LedgerEntry.updateOne({ _id: row._id }, { $set: { status: 'reversed' } }, session ? { session } : {});
      }
      // Undo allocations + amountPaid.
      const allocs = await PaymentAllocation.find({ payment: payment._id, status: 'posted' }, null, session ? { session } : {});
      for (const a of allocs) { const Model = a.chargeType === 'vehicle' ? VehicleEntry : WeighbridgeEntry; await Model.updateOne({ _id: a.chargeId }, { $inc: { amountPaid: -a.amount } }, session ? { session } : {}); await PaymentAllocation.updateOne({ _id: a._id }, { $set: { status: 'reversed' } }, session ? { session } : {}); }
      payment.status = 'reversed'; payment.reversalReason = req.body.reason; await payment.save(session ? { session } : {});
    });
    await writeAudit({ actor: req.user, action: 'PAYMENT_REVERSE', recordType: 'Payment', recordId: String(payment._id), reason: req.body.reason, before: { status: 'posted' }, after: { status: 'reversed' } });
    ok(res, payment);
  } catch (e) { next(e); }
});
async function JournalLineFind(j, session) { const q = JournalLine.find({ journal: j._id }); if (session) q.session(session); return q.exec(); }
async function reverseJournalOnly(journal, lines, reason, session) {
  const [rev] = await JournalEntry.create([{ memo: `Reversal: ${reason}`, sourceType: journal.sourceType, sourceId: journal.sourceId, member: journal.member, status: 'posted', reversalOf: journal._id }], session ? { session } : {});
  await JournalLine.insertMany(lines.map((l) => ({ journal: rev._id, account: l.account, debit: l.credit, credit: l.debit })), session ? { session } : {});
  await JournalEntry.updateOne({ _id: journal._id }, { $set: { status: 'reversed' } }, session ? { session } : {});
}
export default r;
