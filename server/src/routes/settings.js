import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, ADMIN_ONLY } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, forbidden } from '../errors.js';
import { getSettings } from '../services/settings.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ associationName: z.string().optional(), associationNameBn: z.string().optional(), contactPhone: z.string().optional(), contactEmail: z.string().email().optional().or(z.literal('')), address: z.string().optional(), registrationNo: z.string().optional(), committee: z.array(z.any()).optional(), statistics: z.record(z.any()).optional(), allowAdvancePayments: z.boolean().optional(), publicBalanceDisclosure: z.boolean().optional() });
r.get('/', requireRole(...ADMIN_ONLY), async (req, res, next) => { try { ok(res, await getSettings()); } catch (e) { next(e); } });
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
