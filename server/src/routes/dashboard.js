import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { ok } from '../errors.js';
import { computeOutstanding } from '../services/accounting.js';
import { dateRange } from './helpers.js';
const r = Router(); r.use(requireAuth, requireRole(...STAFF));
const sumAgg = async (model, field, dateField, status, dr) => {
  const hasRange = Object.keys(dr).length > 0;
  const agg = await prisma[model].aggregate({ where: { status, ...(hasRange ? { [dateField]: dr } : {}) }, _sum: { [field]: true }, _count: { _all: true } });
  return { _id: null, total: agg._sum[field] || 0, count: agg._count._all };
};
r.get('/summary', async (req, res, next) => {
  try {
    const dr = dateRange(req.query);
    const [members, ledgerRows, v, w, p, e] = await Promise.all([
      prisma.member.count({ where: { status: 'active' } }),
      prisma.ledgerEntry.findMany(), // append-only sum
      sumAgg('vehicleEntry', 'feeAmount', 'entryDate', 'posted', dr),
      sumAgg('weighbridgeEntry', 'feeAmount', 'entryDate', 'posted', dr),
      sumAgg('payment', 'amount', 'paymentDate', 'posted', dr),
      sumAgg('expense', 'amount', 'expenseDate', 'approved', dr),
    ]);
    const totals = computeOutstanding(ledgerRows);
    ok(res, { activeMembers: members, totalOutstanding: totals.outstanding, totalCharges: totals.charges, totalPayments: totals.payments, totalUnappliedCredit: totals.unappliedCredit, vehicleFees: v, weighbridgeFees: w, payments: p, approvedExpenses: e });
  } catch (err) { next(err); }
});
const byDay = async (model, field, amountField, dr) => {
  const hasRange = Object.keys(dr).length > 0;
  const rows = await prisma[model].findMany({ where: { status: 'posted', ...(hasRange ? { [field]: dr } : {}) }, select: { [field]: true, [amountField]: true } });
  const map = {};
  for (const row of rows) {
    // Mongo $dateToString used UTC; toISOString gives the same UTC date.
    const day = new Date(row[field]).toISOString().slice(0, 10);
    map[day] = map[day] || { _id: day, total: 0, count: 0 };
    map[day].total += row[amountField]; map[day].count += 1;
  }
  return Object.values(map).sort((a, b) => String(a._id).localeCompare(String(b._id)));
};
r.get('/charts', async (req, res, next) => {
  try {
    const dr = dateRange(req.query);
    const hasRange = Object.keys(dr).length > 0;
    const [vehicleDaily, weighDaily, paymentDaily] = await Promise.all([byDay('vehicleEntry', 'entryDate', 'feeAmount', dr), byDay('weighbridgeEntry', 'entryDate', 'feeAmount', dr), byDay('payment', 'paymentDate', 'amount', dr)]);
    const wgroups = await prisma.weighbridgeEntry.groupBy({ by: ['category'], where: { status: 'posted', ...(hasRange ? { entryDate: dr } : {}) }, _sum: { feeAmount: true }, _count: { _all: true } });
    const weighbridgeByCategory = wgroups.map((g) => ({ _id: g.category, total: g._sum.feeAmount || 0, count: g._count._all }));
    ok(res, { vehicleDaily, weighbridgeDaily: weighDaily, paymentDaily, weighbridgeByCategory });
  } catch (err) { next(err); }
});
export default r;
