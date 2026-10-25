import { prisma } from '../db/prisma.js';
import { notFound, forbidden } from '../errors.js';
import { ser } from '../db/serialize.js';
// Resolve a member by NAK id (memberId) or by row id.
export async function resolveMember(param, db = null) {
  const client = db || prisma;
  const m = await client.member.findFirst({ where: { OR: [{ id: param }, { memberId: param }] } });
  if (!m) throw notFound('Member not found');
  return m;
}
export async function enforceMemberAccess(req, memberDoc) {
  if (req.user.role === 'MEMBER' && String(memberDoc.id) !== req.user.memberId) throw forbidden('Members can access only their own records');
}
export const publicMemberProjection = (m) => ({ memberId: m.memberId, fullName: m.fullName, businessName: m.businessName, membershipType: m.membershipType, status: m.status, joinedAt: m.joinedAt });
export const staffMemberView = (m) => ser(m);
// Prisma-style date range for a field filter: {} when no bounds given.
export const dateRange = (query) => {
  if (!query.from && !query.to) return {};
  const f = {};
  if (query.from) f.gte = new Date(query.from);
  if (query.to) f.lte = new Date(query.to);
  if (!query.from) f.gte = new Date('1970-01-01');
  return f;
};
