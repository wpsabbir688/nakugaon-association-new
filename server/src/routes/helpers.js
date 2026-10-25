import mongoose from 'mongoose';
import { Member } from '../models/Member.js';
import { notFound, forbidden } from '../errors.js';
export async function resolveMember(param, session = null) {
  const q = mongoose.Types.ObjectId.isValid(param) && param.length === 24
    ? Member.findOne({ $or: [{ _id: param }, { memberId: param }] })
    : Member.findOne({ memberId: param });
  if (session) q.session(session);
  const m = await q.exec();
  if (!m) throw notFound('Member not found');
  return m;
}
export async function enforceMemberAccess(req, memberDoc) {
  if (req.user.role === 'MEMBER' && String(memberDoc._id) !== req.user.memberId) throw forbidden('Members can access only their own records');
}
export const publicMemberProjection = (m) => ({ memberId: m.memberId, fullName: m.fullName, businessName: m.businessName, membershipType: m.membershipType, status: m.status, joinedAt: m.joinedAt });
export const staffMemberView = (m) => { const o = m.toObject ? m.toObject() : m; return o; };
export const dateRange = (query) => {
  const f = {};
  if (query.from || query.to) { f.$gte = query.from ? new Date(query.from) : new Date('1970-01-01'); if (query.to) f.$lte = new Date(query.to); }
  return f;
};
