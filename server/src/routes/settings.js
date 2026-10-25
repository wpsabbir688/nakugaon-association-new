import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, ADMIN_ONLY } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, forbidden } from '../errors.js';
import { getSettings } from '../services/settings.js';
import mongoose from 'mongoose';
import fs from 'fs';
import { Member } from '../models/Member.js';
import { VehicleEntry } from '../models/VehicleEntry.js';
import { WeighbridgeEntry } from '../models/WeighbridgeEntry.js';
import { Payment } from '../models/Payment.js';
import { Expense } from '../models/Expense.js';
import { Notice } from '../models/Notice.js';
import { Leader } from '../models/Leader.js';
import { AuditLog } from '../models/AuditLog.js';
// App identity only (name/version from package.json, read once at boot).
// No env values, secrets, or connection strings are ever returned.
let appInfo = { name: 'nakugaon-association-server', version: 'unknown' };
try { const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')); appInfo = { name: pkg.name || appInfo.name, version: pkg.version || appInfo.version }; } catch {}

import { writeAudit } from '../middleware/audit.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ associationName: z.string().optional(), associationNameBn: z.string().optional(), contactPhone: z.string().optional(), contactEmail: z.string().email().optional().or(z.literal('')), address: z.string().optional(), registrationNo: z.string().optional(), committee: z.array(z.any()).optional(), statistics: z.record(z.any()).optional(), allowAdvancePayments: z.boolean().optional(), publicBalanceDisclosure: z.boolean().optional() });
r.get('/', requireRole(...ADMIN_ONLY), async (req, res, next) => { try { ok(res, await getSettings()); } catch (e) { next(e); } });
r.get('/status', requireRole(...ADMIN_ONLY), async (req, res, next) => {
  try {
    const [members, vehicleEntries, weighbridgeEntries, payments, expenses, notices, leaders, auditLogs] = await Promise.all([
      Member.countDocuments(), VehicleEntry.countDocuments(), WeighbridgeEntry.countDocuments(),
      Payment.countDocuments(), Expense.countDocuments(), Notice.countDocuments(),
      Leader.countDocuments(), AuditLog.countDocuments(),
    ]);
    ok(res, { db: { connected: mongoose.connection.readyState === 1, readyState: mongoose.connection.readyState },
      counts: { members, vehicleEntries, weighbridgeEntries, payments, expenses, notices, leaders, auditLogs },
      app: appInfo });
  } catch (e) { next(e); }
});
r.patch('/', requireRole(...ADMIN_ONLY), validate(schema), async (req, res, next) => {
  try {
    const s = await getSettings(); const before = s.toObject();
    // Disclosure flag is SUPER_ADMIN-only (it exposes member balances publicly).
    if (req.body.publicBalanceDisclosure !== undefined && req.body.publicBalanceDisclosure !== s.publicBalanceDisclosure && req.user.role !== 'SUPER_ADMIN') throw forbidden('Only SUPER_ADMIN can change public balance disclosure');
    Object.assign(s, req.body); await s.save();
    await writeAudit({ actor: req.user, action: 'SETTINGS_UPDATE', recordType: 'SiteSetting', recordId: String(s._id), before, after: s.toObject() });
    ok(res, s);
  } catch (e) { next(e); }
});
export default r;
