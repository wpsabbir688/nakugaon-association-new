import { Router } from 'express';
import { z } from 'zod';
import { Notice } from '../models/Notice.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, notFound } from '../errors.js';
import { parsePagination, pageResponse } from '../utils/pagination.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router();
const schema = z.object({ title: z.string().min(1), body: z.string().min(1), language: z.enum(['bn', 'en', 'both']).optional().default('bn'), pinned: z.boolean().optional().default(false) });
r.get('/', requireAuth, requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = {}; if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([Notice.find(filter).sort({ pinned: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), Notice.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireAuth, requireRole(...STAFF), validate(schema), async (req, res, next) => {
  try { const n = await Notice.create({ ...req.body, createdBy: req.user.id }); await writeAudit({ actor: req.user, action: 'NOTICE_CREATE', recordType: 'Notice', recordId: String(n._id), after: { title: n.title } }); ok(res, n, 201); } catch (e) { next(e); }
});
r.patch('/:id', requireAuth, requireRole(...STAFF), validate(schema.partial()), async (req, res, next) => {
  try { const n = await Notice.findById(req.params.id); if (!n) throw notFound('Notice not found'); const before = n.toObject(); Object.assign(n, req.body); await n.save(); await writeAudit({ actor: req.user, action: 'NOTICE_UPDATE', recordType: 'Notice', recordId: String(n._id), before, after: n.toObject() }); ok(res, n); } catch (e) { next(e); }
});
for (const [action, status] of [['publish', 'published'], ['unpublish', 'draft'], ['archive', 'archived']]) {
  r.post(`/:id/${action}`, requireAuth, requireRole(...STAFF), async (req, res, next) => {
    try { const n = await Notice.findById(req.params.id); if (!n) throw notFound('Notice not found'); const before = { status: n.status }; n.status = status; if (status === 'published') n.publishedAt = new Date(); await n.save(); await writeAudit({ actor: req.user, action: `NOTICE_${action.toUpperCase()}`, recordType: 'Notice', recordId: String(n._id), before, after: { status } }); ok(res, n); } catch (e) { next(e); }
  });
}
r.post('/:id/pin', requireAuth, requireRole(...STAFF), validate(z.object({ pinned: z.boolean() })), async (req, res, next) => {
  try { const n = await Notice.findById(req.params.id); if (!n) throw notFound('Notice not found'); n.pinned = req.body.pinned; await n.save(); ok(res, n); } catch (e) { next(e); }
});
export default r;
