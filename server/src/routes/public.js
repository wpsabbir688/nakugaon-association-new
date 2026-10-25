import { Router } from 'express';
import { z } from 'zod';
import { Member } from '../models/Member.js';
import { Notice } from '../models/Notice.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { Leader } from '../models/Leader.js';
import { validate } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimit.js';
import { ok, notFound } from '../errors.js';
import { parsePagination, pageResponse, searchFilter } from '../utils/pagination.js';
import { publicMemberProjection, resolveMember } from './helpers.js';
import { getSettings } from '../services/settings.js';
import { memberOutstanding } from '../services/ledger.js';
const r = Router();
r.get('/members', async (req, res, next) => {
  try { const { page, limit, skip, search } = parsePagination(req.query); const filter = { status: 'active', ...searchFilter(search, ['fullName', 'businessName']) };
    const settings = await getSettings();
    const [items, total] = await Promise.all([Member.find(filter).sort({ fullName: 1 }).skip(skip).limit(limit).lean(), Member.countDocuments(filter)]);
    const out = [];
    for (const m of items) { const p = publicMemberProjection(m); if (settings.publicBalanceDisclosure) { const t = await memberOutstanding(m._id); p.outstanding = t.outstanding; } out.push(p); }
    ok(res, pageResponse(out, total, { page, limit })); } catch (e) { next(e); }
});
r.get('/members/:memberId', async (req, res, next) => {
  try { const m = await resolveMember(req.params.memberId); if (m.status !== 'active') throw notFound('Member not found'); const settings = await getSettings(); const p = publicMemberProjection(m); if (settings.publicBalanceDisclosure) { const t = await memberOutstanding(m._id); p.outstanding = t.outstanding; } ok(res, p); } catch (e) { next(e); }
});
// Public leaders: active leaders only, approved fields only — NEVER mobile.
r.get('/leaders', async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query);
    const [items, total] = await Promise.all([Leader.find({ active: true }).sort({ displayOrder: 1, createdAt: 1 }).skip(skip).limit(limit).select('_id nameBn nameEn designationBn designationEn firm displayOrder photoUrl active').lean(), Leader.countDocuments({ active: true })]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.get('/notices', async (req, res, next) => {
  try { const { page, limit, skip } = parsePagination(req.query); const filter = { status: 'published' };
    const [items, total] = await Promise.all([Notice.find(filter).sort({ pinned: -1, publishedAt: -1 }).skip(skip).limit(limit).lean(), Notice.countDocuments(filter)]); ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.get('/settings', async (req, res, next) => {
  try { const s = await getSettings(); ok(res, { associationName: s.associationName, associationNameBn: s.associationNameBn, contactPhone: s.contactPhone, contactEmail: s.contactEmail, address: s.address, registrationNo: s.registrationNo, committee: s.committee, statistics: s.statistics }); } catch (e) { next(e); }
});
r.post('/contact', contactLimiter, validate(z.object({ name: z.string().min(1), phone: z.string().optional().default(''), email: z.string().email().optional().or(z.literal('')).default(''), message: z.string().min(1).max(2000) })), async (req, res, next) => {
  try { const m = await ContactMessage.create(req.body); ok(res, { received: true, id: String(m._id) }, 201); } catch (e) { next(e); }
});
export default r;
