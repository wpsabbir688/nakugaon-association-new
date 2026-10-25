import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ser } from '../db/serialize.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router();
const schema = z.object({ title: z.string().min(1), body: z.string().min(1), language: z.enum(['bn', 'en', 'both']).optional().default('bn'), pinned: z.boolean().optional().default(false) });
r.get('/', requireAuth, requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([prisma.notice.findMany({ where: filter, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], skip, take: limit }), prisma.notice.count({ where: filter })]); ok(res, pageResponse(items.map(ser), total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireAuth, requireRole(...STAFF), validate(schema), async (req, res, next) => {
  try { const n = await prisma.notice.create({ data: { ...req.body, createdById: req.user.id } }); await writeAudit({ actor: req.user, action: 'NOTICE_CREATE', recordType: 'Notice', recordId: String(n.id), after: { title: n.title } }); ok(res, ser(n), 201); } catch (e) { next(e); }
});
r.patch('/:id', requireAuth, requireRole(...STAFF), validate(schema.partial()), async (req, res, next) => {
  try { const n = await prisma.notice.findUnique({ where: { id: req.params.id } }); if (!n) throw notFound('Notice not found'); const before = ser(n); const updated = await prisma.notice.update({ where: { id: n.id }, data: req.body }); await writeAudit({ actor: req.user, action: 'NOTICE_UPDATE', recordType: 'Notice', recordId: String(n.id), before, after: ser(updated) }); ok(res, ser(updated)); } catch (e) { next(e); }
});
for (const [action, status] of [['publish', 'published'], ['unpublish', 'draft'], ['archive', 'archived']]) {
  r.post(`/:id/${action}`, requireAuth, requireRole(...STAFF), async (req, res, next) => {
    try { const n = await prisma.notice.findUnique({ where: { id: req.params.id } }); if (!n) throw notFound('Notice not found'); const before = { status: n.status }; const updated = await prisma.notice.update({ where: { id: n.id }, data: { status, ...(status === 'published' ? { publishedAt: new Date() } : {}) } }); await writeAudit({ actor: req.user, action: `NOTICE_${action.toUpperCase()}`, recordType: 'Notice', recordId: String(n.id), before, after: { status } }); ok(res, ser(updated)); } catch (e) { next(e); }
  });
}
r.post('/:id/pin', requireAuth, requireRole(...STAFF), validate(z.object({ pinned: z.boolean() })), async (req, res, next) => {
  try { const n = await prisma.notice.findUnique({ where: { id: req.params.id } }); if (!n) throw notFound('Notice not found'); const updated = await prisma.notice.update({ where: { id: n.id }, data: { pinned: req.body.pinned } }); ok(res, ser(updated)); } catch (e) { next(e); }
});
export default r;
