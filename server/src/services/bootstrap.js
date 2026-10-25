import { Account } from '../models/Account.js';
import { FeeRule } from '../models/FeeRule.js';
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
  for (const a of CHART) await Account.updateOne({ code: a.code }, { $setOnInsert: a }, { upsert: true });
  const count = await FeeRule.countDocuments({ scope: 'weighbridge' });
  if (count === 0) {
    const from = new Date('2026-01-01T00:00:00.000Z');
    for (const [category, amount] of Object.entries(DEFAULT_WEIGH)) await FeeRule.create({ scope: 'weighbridge', category, amount, effectiveFrom: from, reason: 'Initial contract rate' });
    logger.info('seeded default weighbridge fee rules (contract rates)');
  }
  // Quantity-based vehicle entries (Phase 8): one entry = N vehicles at the
  // effective 'standard' rate. Idempotent like the weighbridge seeding above.
  const vehicleCount = await FeeRule.countDocuments({ scope: 'vehicle' });
  if (vehicleCount === 0) {
    await FeeRule.create({ scope: 'vehicle', category: 'standard', amount: 50, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), reason: 'Initial contract rate' });
    logger.info('seeded default vehicle fee rule (standard, 50 BDT/vehicle)');
  }
}
