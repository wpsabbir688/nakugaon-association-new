import { Router } from 'express';
import { z } from 'zod';
import { VehicleEntry } from '../models/VehicleEntry.js';
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
// Quantity model: one entry = N vehicles. quantity must be a positive integer
// (Zod rejects 0, negatives, non-integers and non-numbers with 400). No
// vehicleNumber/driver fields are required. Fee comes from the effective
// 'vehicle'/'standard' rule; the per-vehicle rate is snapshotted on the entry.
const schema = z.object({ memberId: z.string().min(1), quantity: z.number().int().positive(), entryDate: z.string().optional(), notes: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.member = m._id; } if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([VehicleEntry.find(filter).sort({ entryDate: -1 }).skip(skip).limit(limit).populate('member', 'memberId fullName businessName').lean(), VehicleEntry.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), checkIdempotency, validate(schema), async (req, res, next) => {
  try {
    const member = await resolveMember(req.body.memberId);
    if (member.status === 'archived') throw badRequest('Cannot post entries for an archived member');
    const at = req.body.entryDate ? new Date(req.body.entryDate) : new Date();
    if (Number.isNaN(at.getTime())) throw badRequest('Invalid entryDate');
    const created = await withTransaction(async (session) => {
      // Rejects with NO_FEE_RULE (400) when no effective vehicle rule exists.
      const rule = await effectiveFeeRule('vehicle', 'standard', at, session);
      const total = req.body.quantity * rule.amount; // integer BDT: int x int
      const docs = await VehicleEntry.create([{ member: member._id, quantity: req.body.quantity, vehicleCategory: 'standard', notes: req.body.notes, feePerVehicle: rule.amount, totalCharge: total, feeAmount: total, feeRule: rule._id, entryDate: at, createdBy: req.user.id }], session ? { session } : {});
      const entry = docs[0];
      await postLedger({ member: member._id, kind: 'charge', sourceType: 'VehicleEntry', sourceId: entry._id, debit: total, description: `Vehicle fee ${req.body.quantity} x ${rule.amount}` }, session);
      await postJournal({ memo: `Vehicle fee ${req.body.quantity} vehicles`, sourceType: 'VehicleEntry', sourceId: entry._id, member: member._id, lines: [{ account: '1100', debit: total, credit: 0 }, { account: '4000', debit: 0, credit: total }] }, session);
      return entry;
    });
    await writeAudit({ actor: req.user, action: 'VEHICLE_ENTRY_CREATE', recordType: 'VehicleEntry', recordId: String(created._id), after: created.toObject() });
    const body = { success: true, data: created }; await storeIdempotency(req, 201, body); res.status(201).json(body);
  } catch (e) { next(e); }
});
r.get('/:id', requireRole(...STAFF), async (req, res, next) => {
  try { const e = await VehicleEntry.findById(req.params.id).populate('member', 'memberId fullName businessName'); if (!e) throw notFound('Vehicle entry not found'); ok(res, e); } catch (err) { next(err); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const entry = await VehicleEntry.findById(req.params.id); if (!entry) throw notFound('Vehicle entry not found'); if (entry.status === 'reversed') throw badRequest('Entry already reversed');
    if ((entry.amountPaid || 0) > 0) throw badRequest('Cannot reverse a charge that already has payments allocated; reverse the payment first', 'CHARGE_HAS_PAYMENTS');
    await withTransaction(async (session) => {
      const ledgers = await LedgerEntry.find({ sourceType: 'VehicleEntry', sourceId: entry._id, status: 'posted' }, null, session ? { session } : {});
      const journal = await JournalEntry.findOne({ sourceType: 'VehicleEntry', sourceId: entry._id, status: 'posted' }, null, session ? { session } : {});
      await reverseLedgerAndJournal({ ledgerRows: ledgers, journal, reason: req.body.reason }, session);
      entry.status = 'reversed'; entry.reversalReason = req.body.reason; await entry.save(session ? { session } : {});
    });
    await writeAudit({ actor: req.user, action: 'VEHICLE_ENTRY_REVERSE', recordType: 'VehicleEntry', recordId: String(entry._id), reason: req.body.reason, before: { status: 'posted' }, after: { status: 'reversed' } });
    ok(res, entry);
  } catch (e) { next(e); }
});
export default r;
