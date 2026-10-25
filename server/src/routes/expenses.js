import { Router } from 'express';
import { z } from 'zod';
import { Expense } from '../models/Expense.js';
import { requireAuth, requireRole, STAFF, STAFF_NO_OPERATOR } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound, badRequest } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { withTransaction, postJournal } from '../services/ledger.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ title: z.string().min(1), category: z.string().optional().default('general'), amount: z.number().int().positive(), notes: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([Expense.find(filter).sort({ expenseDate: -1 }).skip(skip).limit(limit).lean(), Expense.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), validate(schema), async (req, res, next) => {
  try { const e = await Expense.create({ ...req.body, createdBy: req.user.id }); await writeAudit({ actor: req.user, action: 'EXPENSE_CREATE', recordType: 'Expense', recordId: String(e._id), after: e.toObject() }); ok(res, e, 201); } catch (err) { next(err); }
});
r.post('/:id/approve', requireRole(...STAFF_NO_OPERATOR), async (req, res, next) => {
  try { const e = await Expense.findById(req.params.id); if (!e) throw notFound('Expense not found'); if (e.status !== 'pending') throw badRequest(`Expense is ${e.status}, cannot approve`);
    await withTransaction(async (session) => { await postJournal({ memo: `Expense: ${e.title}`, sourceType: 'Expense', sourceId: e._id, member: null, lines: [{ account: '5000', debit: e.amount, credit: 0 }, { account: '1000', debit: 0, credit: e.amount }] }, session); e.status = 'approved'; e.approvedBy = req.user.id; await e.save(session ? { session } : {}); });
    await writeAudit({ actor: req.user, action: 'EXPENSE_APPROVE', recordType: 'Expense', recordId: String(e._id), before: { status: 'pending' }, after: { status: 'approved' } }); ok(res, e); } catch (err) { next(err); }
});
r.post('/:id/reject', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().optional().default('') })), async (req, res, next) => {
  try { const e = await Expense.findById(req.params.id); if (!e) throw notFound('Expense not found'); if (e.status !== 'pending') throw badRequest('Only pending expenses can be rejected'); e.status = 'rejected'; e.reason = req.body.reason; await e.save(); await writeAudit({ actor: req.user, action: 'EXPENSE_REJECT', recordType: 'Expense', recordId: String(e._id), reason: req.body.reason }); ok(res, e); } catch (err) { next(err); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try { const e = await Expense.findById(req.params.id); if (!e) throw notFound('Expense not found'); if (e.status !== 'approved') throw badRequest('Only approved expenses can be reversed');
    const { JournalEntry } = await import('../models/JournalEntry.js'); const { JournalLine } = await import('../models/JournalLine.js');
    await withTransaction(async (session) => { const j = await JournalEntry.findOne({ sourceType: 'Expense', sourceId: e._id, status: 'posted' }, null, session ? { session } : {}); if (j) { const lines = await JournalLine.find({ journal: j._id }, null, session ? { session } : {}); const [rev] = await JournalEntry.create([{ memo: `Reversal: ${req.body.reason}`, sourceType: 'Expense', sourceId: e._id, status: 'posted', reversalOf: j._id }], session ? { session } : {}); await JournalLine.insertMany(lines.map((l) => ({ journal: rev._id, account: l.account, debit: l.credit, credit: l.debit })), session ? { session } : {}); await JournalEntry.updateOne({ _id: j._id }, { $set: { status: 'reversed' } }, session ? { session } : {}); } e.status = 'reversed'; e.reason = req.body.reason; await e.save(session ? { session } : {}); });
    await writeAudit({ actor: req.user, action: 'EXPENSE_REVERSE', recordType: 'Expense', recordId: String(e._id), reason: req.body.reason }); ok(res, e); } catch (err) { next(err); }
});
export default r;
