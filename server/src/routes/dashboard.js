import { Router } from 'express';
import { Member } from '../models/Member.js';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { WeighbridgeEntry } from '../models/WeighbridgeEntry.js';
import { Payment } from '../models/Payment.js';
import { Expense } from '../models/Expense.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { ok } from '../errors.js';
import { computeOutstanding } from '../services/accounting.js';
import { dateRange } from './helpers.js';
const r = Router(); r.use(requireAuth, requireRole(...STAFF));
r.get('/summary', async (req, res, next) => {
  try {
    const dr = dateRange(req.query);
    const dateMatch = (field) => (Object.keys(dr).length ? { [field]: dr } : {});
    const [members, ledgerRows, v, w, p, e] = await Promise.all([
      Member.countDocuments({ status: 'active' }),
      LedgerEntry.find({}).lean(), // append-only sum
      VehicleEntry.aggregate([{ $match: { status: 'posted', ...dateMatch('entryDate') } }, { $group: { _id: null, total: { $sum: '$feeAmount' }, count: { $sum: 1 } } }]),
      WeighbridgeEntry.aggregate([{ $match: { status: 'posted', ...dateMatch('entryDate') } }, { $group: { _id: null, total: { $sum: '$feeAmount' }, count: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: { status: 'posted', ...dateMatch('paymentDate') } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { status: 'approved', ...dateMatch('expenseDate') } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);
    const totals = computeOutstanding(ledgerRows);
    ok(res, { activeMembers: members, totalOutstanding: totals.outstanding, totalCharges: totals.charges, totalPayments: totals.payments, totalUnappliedCredit: totals.unappliedCredit, vehicleFees: v[0] || { total: 0, count: 0 }, weighbridgeFees: w[0] || { total: 0, count: 0 }, payments: p[0] || { total: 0, count: 0 }, approvedExpenses: e[0] || { total: 0, count: 0 } });
  } catch (err) { next(err); }
});
r.get('/charts', async (req, res, next) => {
  try {
    const dr = dateRange(req.query);
    const match = (field) => (Object.keys(dr).length ? { [field]: dr } : {});
    const byDay = (Model, field, amountField) => Model.aggregate([{ $match: { status: 'posted', ...match(field) } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } }, total: { $sum: `$${amountField}` }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    const [vehicleDaily, weighDaily, paymentDaily] = await Promise.all([byDay(VehicleEntry, 'entryDate', 'feeAmount'), byDay(WeighbridgeEntry, 'entryDate', 'feeAmount'), byDay(Payment, 'paymentDate', 'amount')]);
    const weighByCategory = await WeighbridgeEntry.aggregate([{ $match: { status: 'posted', ...match('entryDate') } }, { $group: { _id: '$category', total: { $sum: '$feeAmount' }, count: { $sum: 1 } } }]);
    ok(res, { vehicleDaily, weighbridgeDaily: weighDaily, paymentDaily, weighbridgeByCategory: weighByCategory });
  } catch (err) { next(err); }
});
export default r;
