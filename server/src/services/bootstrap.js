import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
const CHART = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1100', name: 'Member Receivables', type: 'asset' },
  { code: '2100', name: 'Unapplied Member Credits', type: 'liability' },
  { code: '4000', name: 'Vehicle Fee Income', type: 'income' },
  { code: '4100', name: 'Weighbridge Fee Income', type: 'income' },
  { code: '5000', name: 'Operating Expense', type: 'expense' },
];
// Contract weighbridge rates — config, not fake member/payment data.
const DEFAULT_WEIGH = { bhutan: 100, bangladeshi: 200, 'lorry-crab': 100, trolley: 300 };
export async function bootstrap() {
  for (const a of CHART) await prisma.account.upsert({ where: { code: a.code }, update: {}, create: a });
  const count = await prisma.feeRule.count({ where: { scope: 'weighbridge' } });
  if (count === 0) {
    const from = new Date('2026-01-01T00:00:00.000Z');
    for (const [category, amount] of Object.entries(DEFAULT_WEIGH)) await prisma.feeRule.create({ data: { scope: 'weighbridge', category, amount, effectiveFrom: from, reason: 'Initial contract rate' } });
    logger.info('seeded default weighbridge fee rules (contract rates)');
  }
  // Quantity-based vehicle entries: one entry = N vehicles at the
  // effective 'standard' rate. Idempotent like the weighbridge seeding above.
  const vehicleCount = await prisma.feeRule.count({ where: { scope: 'vehicle' } });
  if (vehicleCount === 0) {
    await prisma.feeRule.create({ data: { scope: 'vehicle', category: 'standard', amount: 50, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), reason: 'Initial contract rate' } });
    logger.info('seeded default vehicle fee rule (standard, 50 BDT/vehicle)');
  }
}
