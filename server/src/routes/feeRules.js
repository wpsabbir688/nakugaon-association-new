import { Router } from 'express';
import { z } from 'zod';
import { FeeRule } from '../models/FeeRule.js';
import { requireAuth, requireRole, STAFF, STAFF_NO_OPERATOR } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ scope: z.enum(['vehicle', 'weighbridge']), category: z.string().min(1), amount: z.number().int().min(0), effectiveFrom: z.string().datetime().or(z.date()), effectiveTo: z.string().datetime().or(z.date()).nullable().optional(), reason: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.scope) filter.scope = req.query.scope; if (req.query.category) filter.category = req.query.category;
    const [items, total] = await Promise.all([FeeRule.find(filter).sort({ effectiveFrom: -1 }).skip(skip).limit(limit).lean(), FeeRule.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF_NO_OPERATOR), validate(schema), async (req, res, next) => {
  try { const rule = await FeeRule.create({ ...req.body, effectiveFrom: new Date(req.body.effectiveFrom), effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null, createdBy: req.user.id });
    await writeAudit({ actor: req.user, action: 'FEE_RULE_CREATE', recordType: 'FeeRule', recordId: String(rule._id), reason: req.body.reason, after: rule.toObject() }); ok(res, rule, 201); } catch (e) { next(e); }
});
r.patch('/:id', requireRole(...STAFF_NO_OPERATOR), validate(schema.partial()), async (req, res, next) => {
  try { const rule = await FeeRule.findById(req.params.id); if (!rule) throw notFound('Fee rule not found'); const before = rule.toObject();
    Object.assign(rule, { ...req.body, ...(req.body.effectiveFrom ? { effectiveFrom: new Date(req.body.effectiveFrom) } : {}), ...(req.body.effectiveTo !== undefined ? { effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null } : {}) }); await rule.save();
    await writeAudit({ actor: req.user, action: 'FEE_RULE_UPDATE', recordType: 'FeeRule', recordId: String(rule._id), reason: req.body.reason || '', before, after: rule.toObject() }); ok(res, rule); } catch (e) { next(e); }
});
export default r;
