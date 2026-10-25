import { Router } from 'express';
import { z } from 'zod';
import { Leader } from '../models/Leader.js';
import { requireAuth, requireRole, STAFF, ADMIN_ONLY } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({
  nameBn: z.string().min(1), nameEn: z.string().optional().default(''),
  designationBn: z.string().min(1), designationEn: z.string().optional().default(''),
  firm: z.string().optional().default(''), displayOrder: z.number().int().optional().default(0),
  mobile: z.string().optional().default(''), photoUrl: z.string().optional().default(''),
  active: z.boolean().optional(),
});
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {};
    if (req.query.active === 'true') filter.active = true; if (req.query.active === 'false') filter.active = false;
    const [items, total] = await Promise.all([Leader.find(filter).sort({ displayOrder: 1, createdAt: 1 }).skip(skip).limit(limit).lean(), Leader.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...ADMIN_ONLY), validate(schema), async (req, res, next) => {
  try { const doc = await Leader.create(req.body);
    await writeAudit({ actor: req.user, action: 'LEADER_CREATE', recordType: 'Leader', recordId: String(doc._id), after: doc.toObject() }); ok(res, doc, 201); } catch (e) { next(e); }
});
r.patch('/:id', requireRole(...ADMIN_ONLY), validate(schema.partial()), async (req, res, next) => {
  try { const doc = await Leader.findById(req.params.id); if (!doc) throw notFound('Leader not found'); const before = doc.toObject();
    Object.assign(doc, req.body); await doc.save();
    // No hard delete anywhere: "Remove" in the UI is PATCH { active: false }.
    const archived = before.active && doc.active === false;
    await writeAudit({ actor: req.user, action: archived ? 'LEADER_ARCHIVE' : 'LEADER_UPDATE', recordType: 'Leader', recordId: String(doc._id), before, after: doc.toObject() }); ok(res, doc); } catch (e) { next(e); }
});
export default r;
