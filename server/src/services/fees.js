import { FeeRule } from '../models/FeeRule.js';
import { badRequest } from '../errors.js';
// Effective rule: latest effectiveFrom <= now, not ended, active. Never recalculates history.
export async function effectiveFeeRule(scope, category, at = new Date(), session = null) {
  const q = FeeRule.findOne({ scope, category, active: true, effectiveFrom: { $lte: at }, $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }] }).sort({ effectiveFrom: -1 });
  if (session) q.session(session);
  const rule = await q.exec();
  if (!rule) throw badRequest(`No effective fee rule for ${scope}/${category} — an admin must create one first`, 'NO_FEE_RULE');
  return rule;
}
