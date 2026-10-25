import { Router } from 'express';
import { z } from 'zod';
import { Member } from '../models/Member.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok, badRequest, conflict } from '../errors.js';
import { parsePagination, pageResponse, searchFilter } from '../utils/pagination.js';
import { resolveMember, enforceMemberAccess } from './helpers.js';
import { nextMemberId } from '../services/ids.js';
import { withTransaction, postLedger } from '../services/ledger.js';
import { computeOutstanding } from '../services/accounting.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router();
r.use(requireAuth);
const memberSchema = z.object({ fullName: z.string().min(1), businessName: z.string().optional().default(''), phone: z.string().optional().default(''), email: z.string().email().optional().or(z.literal('')).default(''), address: z.string().optional().default(''), membershipType: z.enum(['importer', 'exporter', 'both', 'other']).optional().default('importer'), privateNotes: z.string().optional().default(''), bankDetails: z.string().optional().default('') });
r.get('/', requireRole(...STAFF), async (req, res, next) => {
  try { const { page, limit, skip, search } = parsePagination(req.query); const filter = { ...searchFilter(search, ['fullName', 'businessName', 'phone', 'memberId']) }; if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([Member.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Member.countDocuments(filter)]);
    ok(res, pageResponse(items, total, { page, limit })); } catch (e) { next(e); }
});
r.post('/', requireRole(...STAFF), validate(memberSchema), async (req, res, next) => {
  try {
    const member = await withTransaction(async (session) => {
      const memberId = await nextMemberId(session);
      const docs = await Member.create([{ ...req.body, memberId }], session ? { session } : {});
      return docs[0];
    });
    await writeAudit({ actor: req.user, action: 'MEMBER_CREATE', recordType: 'Member', recordId: String(member._id), after: { memberId: member.memberId, fullName: member.fullName } });
    ok(res, member, 201);
  } catch (e) { next(e); }
});
async function loadMember(req, res, next) { try { req.memberDoc = await resolveMember(req.params.memberId); await enforceMemberAccess(req, req.memberDoc); next(); } catch (e) { next(e); } }
r.get('/:memberId', loadMember, async (req, res) => { ok(res, req.memberDoc); });
r.patch('/:memberId', requireRole(...STAFF), loadMember, validate(memberSchema.partial()), async (req, res, next) => {
  try {
    const before = req.memberDoc.toObject();
    // Never allow memberId/status changes through this endpoint.
    const safe = { ...req.body }; delete safe.memberId; delete safe.status;
    Object.assign(req.memberDoc, safe); await req.memberDoc.save();
    await writeAudit({ actor: req.user, action: 'MEMBER_UPDATE', recordType: 'Member', recordId: String(req.memberDoc._id), before, after: req.memberDoc.toObject() });
    ok(res, req.memberDoc);
  } catch (e) { next(e); }
});
r.post('/:memberId/archive', requireRole('SUPER_ADMIN', 'MANAGER'), loadMember, validate(z.object({ reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const before = { status: req.memberDoc.status };
    req.memberDoc.status = 'archived'; req.memberDoc.archivedAt = new Date(); req.memberDoc.archivedReason = req.body.reason; await req.memberDoc.save();
    await writeAudit({ actor: req.user, action: 'MEMBER_ARCHIVE', recordType: 'Member', recordId: String(req.memberDoc._id), reason: req.body.reason, before, after: { status: 'archived' } });
    ok(res, req.memberDoc);
  } catch (e) { next(e); }
});
// Opening balance: auditable setup only, and only before any posted charge exists.
r.post('/:memberId/opening-balance', requireRole('SUPER_ADMIN', 'ACCOUNTANT'), loadMember, validate(z.object({ amount: z.number().int(), reason: z.string().min(1) })), async (req, res, next) => {
  try {
    const charges = await LedgerEntry.countDocuments({ member: req.memberDoc._id, kind: 'charge', status: 'posted' });
    if (charges > 0) throw badRequest('Opening balance cannot be set after posted charges exist', 'OPENING_BALANCE_LOCKED');
    const existing = await LedgerEntry.countDocuments({ member: req.memberDoc._id, kind: 'opening' });
    if (existing > 0) throw conflict('Opening balance already recorded for this member');
    await withTransaction(async (session) => { await postLedger({ member: req.memberDoc._id, kind: 'opening', sourceType: 'OpeningBalance', sourceId: null, debit: req.body.amount > 0 ? req.body.amount : 0, credit: req.body.amount < 0 ? -req.body.amount : 0, description: `Opening balance: ${req.body.reason}` }, session); });
    await writeAudit({ actor: req.user, action: 'OPENING_BALANCE_SET', recordType: 'Member', recordId: String(req.memberDoc._id), reason: req.body.reason, after: { amount: req.body.amount } });
    ok(res, { memberId: req.memberDoc.memberId, openingBalance: req.body.amount }, 201);
  } catch (e) { next(e); }
});
r.get('/:memberId/statement', loadMember, async (req, res, next) => {
  try {
    const rows = await LedgerEntry.find({ member: req.memberDoc._id }).sort({ postedAt: 1, createdAt: 1 }).lean();
    const totals = computeOutstanding(rows); // append-only: reversal rows negate originals
    const statement = { member: req.memberDoc, ledger: rows, totals };
    if (req.user.role === 'MEMBER') { /* own statement only — enforced in loadMember */ }
    ok(res, statement);
  } catch (e) { next(e); }
});
export default r;
