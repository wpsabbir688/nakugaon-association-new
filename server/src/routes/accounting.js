import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { ser, serAudit } from '../db/serialize.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { ok } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { resolveMember } from './helpers.js';
import { computeOutstanding } from '../services/accounting.js';
import { dateRange } from './helpers.js';
const r = Router(); r.use(requireAuth, requireRole(...STAFF));
const memberSelect = { select: { id: true, memberId: true, fullName: true } };
r.get('/accounts', async (req, res, next) => {
  try {
    const sums = await prisma.journalLine.groupBy({ by: ['account'], _sum: { debit: true, credit: true } });
    const docs = await prisma.account.findMany();
    // Union of Account docs and journal-line codes: a doc with no journals
    // shows true 0/0/0 sums (not an invented balance); a journal code with
    // no doc falls back to the code as its name. With neither, this is empty.
    const byCode = {}; for (const d of docs) byCode[d.code] = { code: d.code, name: d.name, type: d.type, debit: 0, credit: 0, balance: 0 };
    for (const g of sums) { const row = byCode[g.account] || (byCode[g.account] = { code: g.account, name: g.account, type: null, debit: 0, credit: 0, balance: 0 }); row.debit = g._sum.debit || 0; row.credit = g._sum.credit || 0; row.balance = row.debit - row.credit; }
    const rows = Object.values(byCode);
    rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    ok(res, { items: rows, total: rows.length }); } catch (e) { next(e); }
});
r.get('/ledger', async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.memberId = m.id; } if (req.query.kind) filter.kind = req.query.kind;
    const [items, total] = await Promise.all([prisma.ledgerEntry.findMany({ where: filter, orderBy: { postedAt: 'desc' }, skip, take: limit, include: { member: memberSelect } }), prisma.ledgerEntry.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.get('/reconciliation', async (req, res, next) => {
  try {
    // Member receivables per journal (account 1100, all journals) vs per ledger outstanding.
    // Append-only: reversal journals negate originals, so all journals count.
    const lines = await prisma.journalLine.findMany();
    const byAccount = {};
    for (const l of lines) { byAccount[l.account] = byAccount[l.account] || { debit: 0, credit: 0 }; byAccount[l.account].debit += l.debit; byAccount[l.account].credit += l.credit; }
    const journalReceivables = (byAccount['1100']?.debit || 0) - (byAccount['1100']?.credit || 0);
    const ledgerRows = await prisma.ledgerEntry.findMany();
    const totals = computeOutstanding(ledgerRows);
    const journalCash = (byAccount['1000']?.debit || 0) - (byAccount['1000']?.credit || 0);
    // Per-journal balance is enforced at posting time (see note below).
    ok(res, { journalBalances: byAccount, journalReceivables, journalCash, ledgerOutstanding: totals.outstanding, ledgerTotals: totals, receivablesMatch: journalReceivables === totals.outstanding, note: 'Per-journal balance is enforced at posting time (unbalanced journals are never saved); this endpoint verifies aggregate agreement.' });
  } catch (e) { next(e); }
});
r.get('/reports', async (req, res, next) => {
  try {
    const dr = dateRange(req.query); const hasRange = Object.keys(dr).length > 0;
    const dateFilter = hasRange ? { postedAt: dr } : {};
    const ledgerRows = await prisma.ledgerEntry.findMany({ where: { ...dateFilter } });
    const totals = computeOutstanding(ledgerRows);
    const sumAgg = async (model, field, dateField, status) => {
      const where = { status, ...(hasRange ? { [dateField]: dr } : {}) };
      const agg = await prisma[model].aggregate({ where, _sum: { [field]: true }, _count: { _all: true } });
      return { _id: null, total: agg._sum[field] || 0, count: agg._count._all };
    };
    const charges = await sumAgg('vehicleEntry', 'feeAmount', 'entryDate', 'posted');
    const wgroups = await prisma.weighbridgeEntry.groupBy({ by: ['category'], where: { status: 'posted', ...(hasRange ? { entryDate: dr } : {}) }, _sum: { feeAmount: true }, _count: { _all: true } });
    const wcharges = wgroups.map((g) => ({ _id: g.category, total: g._sum.feeAmount || 0, count: g._count._all }));
    const pays = await sumAgg('payment', 'amount', 'paymentDate', 'posted');
    const exps = await sumAgg('expense', 'amount', 'expenseDate', 'approved');
    ok(res, { period: { from: req.query.from || null, to: req.query.to || null }, ledgerTotals: totals, vehicleFees: charges, weighbridgeByCategory: wcharges, payments: pays, approvedExpenses: exps });
  } catch (e) { next(e); }
});
r.get('/audit-logs', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.action) filter.action = req.query.action; if (req.query.recordType) filter.recordType = req.query.recordType;
    const [items, total] = await Promise.all([prisma.auditLog.findMany({ where: filter, orderBy: { createdAt: 'desc' }, skip, take: limit }), prisma.auditLog.count({ where: filter })]); ok(res, pageResponse(items.map(serAudit), total, { page, limit })); } catch (e) { next(e); }
});
export default r;
