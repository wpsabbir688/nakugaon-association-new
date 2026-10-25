import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ser } from '../db/serialize.js';
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
    const [items, total] = await Promise.all([prisma.leader.findMany({ where: filter, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], skip, take: limit }), prisma.leader.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...ADMIN_ONLY), validate(schema), async (req, res, next) => {
  try { const doc = await prisma.leader.create({ data: req.body });
    await writeAudit({ actor: req.user, action: 'LEADER_CREATE', recordType: 'Leader', recordId: String(doc.id), after: ser(doc) }); ok(res, ser(doc), 201); } catch (e) { next(e); }
});
r.patch('/:id', requireRole(...ADMIN_ONLY), validate(schema.partial()), async (req, res, next) => {
  try { const doc = await prisma.leader.findUnique({ where: { id: req.params.id } }); if (!doc) throw notFound('Leader not found'); const before = ser(doc);
    const updated = await prisma.leader.update({ where: { id: doc.id }, data: req.body });
    // No hard delete anywhere: "Remove" in the UI is PATCH { active: false }.
    const archived = before.active && updated.active === false;
    await writeAudit({ actor: req.user, action: archived ? 'LEADER_ARCHIVE' : 'LEADER_UPDATE', recordType: 'Leader', recordId: String(doc.id), before, after: ser(updated) }); ok(res, ser(updated)); } catch (e) { next(e); }
});
export default r;
