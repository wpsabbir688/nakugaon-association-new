import { prisma } from '../db/prisma.js';
import { badRequest } from '../errors.js';
// Effective rule: latest effectiveFrom <= now, not ended, active. Never recalculates history.
// `db` is a Prisma client or an interactive-transaction client.
export async function effectiveFeeRule(scope, category, at = new Date(), db = null) {
  const client = db || prisma;
  const rule = await client.feeRule.findFirst({
    where: { scope, category, active: true, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!rule) throw badRequest(`No effective fee rule for ${scope}/${category} — an admin must create one first`, 'NO_FEE_RULE');
  return rule;
}
