import { Router } from 'express';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { JournalLine } from '../models/JournalLine.js';
import { AuditLog } from '../models/AuditLog.js';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { WeighbridgeEntry } from '../models/WeighbridgeEntry.js';
import { Payment } from '../models/Payment.js';
import { Expense } from '../models/Expense.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { ok } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { resolveMember } from './helpers.js';
import { computeOutstanding } from '../services/accounting.js';
import { dateRange } from './helpers.js';
const r = Router(); r.use(requireAuth, requireRole(...STAFF));
r.get('/ledger', async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.memberId) { const m = await resolveMember(req.query.memberId); filter.member = m._id; } if (req.query.kind) filter.kind = req.query.kind;
    const [items, total] = await Promise.all([LedgerEntry.find(filter).sort({ postedAt: -1 }).skip(skip).limit(limit).populate('member', 'memberId fullName').lean(), LedgerEntry.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.get('/reconciliation', async (req, res, next) => {
  try {
    // Member receivables per journal (account 1100, posted journals only) vs per ledger outstanding.
    const postedJournals = await JournalEntry.find({}).select('_id').lean(); // append-only: reversal journals negate originals
    const jids = postedJournals.map((j) => j._id);
    const lines = await JournalLine.find({ journal: { $in: jids } }).lean();
    const byAccount = {};
    for (const l of lines) { byAccount[l.account] = byAccount[l.account] || { debit: 0, credit: 0 }; byAccount[l.account].debit += l.debit; byAccount[l.account].credit += l.credit; }
    const journalReceivables = (byAccount['1100']?.debit || 0) - (byAccount['1100']?.credit || 0);
    const ledgerRows = await LedgerEntry.find({}).lean();
    const totals = computeOutstanding(ledgerRows);
    const journalCash = (byAccount['1000']?.debit || 0) - (byAccount['1000']?.credit || 0);
    // Per-journal balance is enforced at posting time (see note below).
    ok(res, { journalBalances: byAccount, journalReceivables, journalCash, ledgerOutstanding: totals.outstanding, ledgerTotals: totals, receivablesMatch: journalReceivables === totals.outstanding, note: 'Per-journal balance is enforced at posting time (unbalanced journals are never saved); this endpoint verifies aggregate agreement.' });
  } catch (e) { next(e); }
});
r.get('/reports', async (req, res, next) => {
  try {
    const dr = dateRange(req.query); const dateFilter = Object.keys(dr).length ? { postedAt: dr } : {};
    const ledgerRows = await LedgerEntry.find({ ...dateFilter }).lean();
    const totals = computeOutstanding(ledgerRows);
    const charges = await VehicleEntry.aggregate([{ $match: { status: 'posted', ...(req.query.from || req.query.to ? { entryDate: dr } : {}) } }, { $group: { _id: null, total: { $sum: '$feeAmount' }, count: { $sum: 1 } } }]);
    const wcharges = await WeighbridgeEntry.aggregate([{ $match: { status: 'posted', ...(req.query.from || req.query.to ? { entryDate: dr } : {}) } }, { $group: { _id: '$category', total: { $sum: '$feeAmount' }, count: { $sum: 1 } } }]);
    const pays = await Payment.aggregate([{ $match: { status: 'posted', ...(req.query.from || req.query.to ? { paymentDate: dr } : {}) } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    const exps = await Expense.aggregate([{ $match: { status: 'approved', ...(req.query.from || req.query.to ? { expenseDate: dr } : {}) } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    ok(res, { period: { from: req.query.from || null, to: req.query.to || null }, ledgerTotals: totals, vehicleFees: charges[0] || { total: 0, count: 0 }, weighbridgeByCategory: wcharges, payments: pays[0] || { total: 0, count: 0 }, approvedExpenses: exps[0] || { total: 0, count: 0 } });
  } catch (e) { next(e); }
});
r.get('/audit-logs', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.action) filter.action = req.query.action; if (req.query.recordType) filter.recordType = req.query.recordType;
    const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
export default r;
