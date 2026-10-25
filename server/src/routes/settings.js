import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, ADMIN_ONLY } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, forbidden } from '../errors.js';
import { getSettings } from '../services/settings.js';
import { dbConnected } from '../config/db.js';
import { prisma } from '../db/prisma.js';
import { ser } from '../db/serialize.js';
import fs from 'fs';
// App identity only (name/version from package.json, read once at boot).
// No env values, secrets, or connection strings are ever returned.
let appInfo = { name: 'nakugaon-association-server', version: 'unknown' };
try { const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')); appInfo = { name: pkg.name || appInfo.name, version: pkg.version || appInfo.version }; } catch {}

import { writeAudit } from '../middleware/audit.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ associationName: z.string().optional(), associationNameBn: z.string().optional(), contactPhone: z.string().optional(), contactEmail: z.string().email().optional().or(z.literal('')), address: z.string().optional(), registrationNo: z.string().optional(), committee: z.array(z.any()).optional(), statistics: z.record(z.any()).optional(), allowAdvancePayments: z.boolean().optional(), publicBalanceDisclosure: z.boolean().optional() });
r.get('/', requireRole(...ADMIN_ONLY), async (req, res, next) => { try { ok(res, ser(await getSettings())); } catch (e) { next(e); } });
r.get('/status', requireRole(...ADMIN_ONLY), async (req, res, next) => {
  try {
    const connected = await dbConnected();
    const [members, vehicleEntries, weighbridgeEntries, payments, expenses, notices, leaders, auditLogs] = await Promise.all([
      prisma.member.count(), prisma.vehicleEntry.count(), prisma.weighbridgeEntry.count(),
      prisma.payment.count(), prisma.expense.count(), prisma.notice.count(),
      prisma.leader.count(), prisma.auditLog.count(),
    ]);
    ok(res, { db: { connected, readyState: connected ? 1 : 0 },
      counts: { members, vehicleEntries, weighbridgeEntries, payments, expenses, notices, leaders, auditLogs },
      app: appInfo });
  } catch (e) { next(e); }
});
r.patch('/', requireRole(...ADMIN_ONLY), validate(schema), async (req, res, next) => {
  try {
    const s = await getSettings(); const before = ser(s);
    // Disclosure flag is SUPER_ADMIN-only (it exposes member balances publicly).
    if (req.body.publicBalanceDisclosure !== undefined && req.body.publicBalanceDisclosure !== s.publicBalanceDisclosure && req.user.role !== 'SUPER_ADMIN') throw forbidden('Only SUPER_ADMIN can change public balance disclosure');
    const updated = await prisma.siteSetting.update({ where: { id: s.id }, data: req.body });
    await writeAudit({ actor: req.user, action: 'SETTINGS_UPDATE', recordType: 'SiteSetting', recordId: String(s.id), before, after: ser(updated) });
    ok(res, ser(updated));
  } catch (e) { next(e); }
});
export default r;
