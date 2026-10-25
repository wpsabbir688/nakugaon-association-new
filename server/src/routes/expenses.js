import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ser } from '../db/serialize.js';
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
    const [items, total] = await Promise.all([prisma.expense.findMany({ where: filter, orderBy: { expenseDate: 'desc' }, skip, take: limit }), prisma.expense.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), validate(schema), async (req, res, next) => {
  try { const e = await prisma.expense.create({ data: { ...req.body, createdById: req.user.id } }); await writeAudit({ actor: req.user, action: 'EXPENSE_CREATE', recordType: 'Expense', recordId: String(e.id), after: ser(e) }); ok(res, ser(e), 201); } catch (err) { next(err); }
});
r.post('/:id/approve', requireRole(...STAFF_NO_OPERATOR), async (req, res, next) => {
  try { const e = await prisma.expense.findUnique({ where: { id: req.params.id } }); if (!e) throw notFound('Expense not found'); if (e.status !== 'pending') throw badRequest(`Expense is ${e.status}, cannot approve`);
    await withTransaction(async (tx) => { await postJournal({ memo: `Expense: ${e.title}`, sourceType: 'Expense', sourceId: e.id, memberId: null, lines: [{ account: '5000', debit: e.amount, credit: 0 }, { account: '1000', debit: 0, credit: e.amount }] }, tx); await tx.expense.update({ where: { id: e.id }, data: { status: 'approved', approvedById: req.user.id } }); });
    await writeAudit({ actor: req.user, action: 'EXPENSE_APPROVE', recordType: 'Expense', recordId: String(e.id), before: { status: 'pending' }, after: { status: 'approved' } });
    const updated = await prisma.expense.findUnique({ where: { id: e.id } }); ok(res, ser(updated)); } catch (err) { next(err); }
});
r.post('/:id/reject', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().optional().default('') })), async (req, res, next) => {
  try { const e = await prisma.expense.findUnique({ where: { id: req.params.id } }); if (!e) throw notFound('Expense not found'); if (e.status !== 'pending') throw badRequest('Only pending expenses can be rejected'); const updated = await prisma.expense.update({ where: { id: e.id }, data: { status: 'rejected', reason: req.body.reason } }); await writeAudit({ actor: req.user, action: 'EXPENSE_REJECT', recordType: 'Expense', recordId: String(e.id), reason: req.body.reason }); ok(res, ser(updated)); } catch (err) { next(err); }
});
r.post('/:id/reverse', requireRole(...STAFF_NO_OPERATOR), validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try { const e = await prisma.expense.findUnique({ where: { id: req.params.id } }); if (!e) throw notFound('Expense not found'); if (e.status !== 'approved') throw badRequest('Only approved expenses can be reversed');
    await withTransaction(async (tx) => { const j = await tx.journalEntry.findFirst({ where: { sourceType: 'Expense', sourceId: e.id, status: 'posted' } }); if (j) { const lines = await tx.journalLine.findMany({ where: { journalId: j.id } }); const rev = await tx.journalEntry.create({ data: { memo: `Reversal: ${req.body.reason}`, sourceType: 'Expense', sourceId: e.id, status: 'posted', reversalOfId: j.id } }); await tx.journalLine.createMany({ data: lines.map((l) => ({ journalId: rev.id, account: l.account, debit: l.credit, credit: l.debit })) }); await tx.journalEntry.update({ where: { id: j.id }, data: { status: 'reversed' } }); } await tx.expense.update({ where: { id: e.id }, data: { status: 'reversed', reason: req.body.reason } }); });
    await writeAudit({ actor: req.user, action: 'EXPENSE_REVERSE', recordType: 'Expense', recordId: String(e.id), reason: req.body.reason });
    const updated = await prisma.expense.findUnique({ where: { id: e.id } }); ok(res, ser(updated)); } catch (err) { next(err); }
});
export default r;
