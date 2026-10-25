import { Router } from 'express';
import { z } from 'zod';
import { WeighbridgeEntry } from '../models/WeighbridgeEntry.js';
import { requireAuth, requireRole, STAFF, STAFF_NO_OPERATOR } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound, badRequest } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { resolveMember } from './helpers.js';
import { effectiveFeeRule } from '../services/fees.js';
import { withTransaction, postLedger, postJournal, reverseLedgerAndJournal } from '../services/ledger.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { writeAudit } from '../middleware/audit.js';
import { checkIdempotency, storeIdempotency } from '../middleware/idempotency.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ memberId: z.string().min(1), vehicleNumber: z.string().min(1), category: z.enum(['bhutan', 'bangladeshi', 'lorry-crab', 'trolley']), weightKg: z.number().positive().nullable().optional(), notes: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.member = m._id; } if (req.query.category) filter.category = req.query.category; if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([WeighbridgeEntry.find(filter).sort({ entryDate: -1 }).skip(skip).limit(limit).populate('member', 'memberId fullName businessName').lean(), WeighbridgeEntry.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), checkIdempotency, validate(schema), async (req, res, next) => {
  try {
    const member = await resolveMember(req.body.memberId);
    if (member.status === 'archived') throw badRequest('Cannot post entries for an archived member');
    const created = await withTransaction(async (session) => {
      const rule = await effectiveFeeRule('weighbridge', req.body.category, new Date(), session);
      const docs = await WeighbridgeEntry.create([{ member: member._id, vehicleNumber: req.body.vehicleNumber, category: req.body.category, weightKg: req.body.weightKg ?? null, notes: req.body.notes, feeAmount: rule.amount, feeRule: rule._id, createdBy: req.user.id }], session ? { session } : {});
      const entry = docs[0];
      await postLedger({ member: member._id, kind: 'charge', sourceType: 'WeighbridgeEntry', sourceId: entry._id, debit: rule.amount, description: `Weighbridge fee ${req.body.category} ${req.body.vehicleNumber}` }, session);
      await postJournal({ memo: `Weighbridge fee ${req.body.category}`, sourceType: 'WeighbridgeEntry', sourceId: entry._id, member: member._id, lines: [{ account: '1100', debit: rule.amount, credit: 0 }, { account: '4100', debit: 0, credit: rule.amount }] }, session);
      return entry;
    });
    await writeAudit({ actor: req.user, action: 'WEIGHBRIDGE_ENTRY_CREATE', recordType: 'WeighbridgeEntry', recordId: String(created._id), after: created.toObject() });
    const body = { success: true, data: created }; await storeIdempotency(req, 201, body); res.status(201).json(body);
  } catch (e) { next(e); }
});
r.get('/:id', requireRole(...STAFF), async (req, res, next) => {
  try { const e = await WeighbridgeEntry.findById(req.params.id).populate('member', 'memberId fullName businessName'); if (!e) throw notFound('Weighbridge entry not found'); ok(res, e); } catch (err) { next(err); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const entry = await WeighbridgeEntry.findById(req.params.id); if (!entry) throw notFound('Weighbridge entry not found'); if (entry.status === 'reversed') throw badRequest('Entry already reversed');
    if ((entry.amountPaid || 0) > 0) throw badRequest('Cannot reverse a charge that already has payments allocated; reverse the payment first', 'CHARGE_HAS_PAYMENTS');
    await withTransaction(async (session) => {
      const ledgers = await LedgerEntry.find({ sourceType: 'WeighbridgeEntry', sourceId: entry._id, status: 'posted' }, null, session ? { session } : {});
      const journal = await JournalEntry.findOne({ sourceType: 'WeighbridgeEntry', sourceId: entry._id, status: 'posted' }, null, session ? { session } : {});
      await reverseLedgerAndJournal({ ledgerRows: ledgers, journal, reason: req.body.reason }, session);
      entry.status = 'reversed'; entry.reversalReason = req.body.reason; await entry.save(session ? { session } : {});
    });
    await writeAudit({ actor: req.user, action: 'WEIGHBRIDGE_ENTRY_REVERSE', recordType: 'WeighbridgeEntry', recordId: String(entry._id), reason: req.body.reason, before: { status: 'posted' }, after: { status: 'reversed' } });
    ok(res, entry);
  } catch (e) { next(e); }
});
export default r;
