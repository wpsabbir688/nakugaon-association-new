import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ser } from '../db/serialize.js';
import { requireAuth, requireRole, STAFF, STAFF_NO_OPERATOR } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router(); r.use(requireAuth);
const schema = z.object({ scope: z.enum(['vehicle', 'weighbridge']), category: z.string().min(1), amount: z.number().int().min(0), effectiveFrom: z.string().datetime().or(z.date()), effectiveTo: z.string().datetime().or(z.date()).nullable().optional(), reason: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.scope) filter.scope = req.query.scope; if (req.query.category) filter.category = req.query.category;
    const [items, total] = await Promise.all([prisma.feeRule.findMany({ where: filter, orderBy: { effectiveFrom: 'desc' }, skip, take: limit }), prisma.feeRule.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF_NO_OPERATOR), validate(schema), async (req, res, next) => {
  try { const rule = await prisma.feeRule.create({ data: { ...req.body, effectiveFrom: new Date(req.body.effectiveFrom), effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null, createdById: req.user.id } });
    await writeAudit({ actor: req.user, action: 'FEE_RULE_CREATE', recordType: 'FeeRule', recordId: String(rule.id), reason: req.body.reason, after: ser(rule) }); ok(res, ser(rule), 201); } catch (e) { next(e); }
});
r.patch('/:id', requireRole(...STAFF_NO_OPERATOR), validate(schema.partial()), async (req, res, next) => {
  try { const rule = await prisma.feeRule.findUnique({ where: { id: req.params.id } }); if (!rule) throw notFound('Fee rule not found'); const before = ser(rule);
    const updated = await prisma.feeRule.update({ where: { id: rule.id }, data: { ...req.body, ...(req.body.effectiveFrom ? { effectiveFrom: new Date(req.body.effectiveFrom) } : {}), ...(req.body.effectiveTo !== undefined ? { effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null } : {}) } });
    await writeAudit({ actor: req.user, action: 'FEE_RULE_UPDATE', recordType: 'FeeRule', recordId: String(rule.id), reason: req.body.reason || '', before, after: ser(updated) }); ok(res, ser(updated)); } catch (e) { next(e); }
});
export default r;
