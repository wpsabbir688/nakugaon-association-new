import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized, forbidden } from '../errors.js';
import { User } from '../models/User.js';
export const COOKIE_NAME = 'nakugaon_token';
export function signToken(user) { return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret || 'dev-only-insecure-secret', { expiresIn: env.jwtExpiresIn }); }
export function cookieOptions() { return { httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production', path: '/', maxAge: 7 * 24 * 3600 * 1000 }; }
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) throw unauthorized();
    const payload = jwt.verify(token, env.jwtSecret || 'dev-only-insecure-secret');
    const user = await User.findById(payload.sub).lean();
    if (!user || user.status !== 'active') throw unauthorized('Account is not active');
    req.user = { id: String(user._id), role: user.role, email: user.email, memberId: user.member ? String(user.member) : null, name: user.name };
    next();
  } catch (e) { next(e?.name === 'JsonWebTokenError' || e?.name === 'TokenExpiredError' ? unauthorized('Invalid or expired session') : e); }
}
export const requireRole = (...roles) => (req, res, next) => (req.user && roles.includes(req.user.role) ? next() : next(forbidden()));
export const STAFF = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR'];
export const STAFF_NO_OPERATOR = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'];
export const ADMIN_ONLY = ['SUPER_ADMIN', 'MANAGER'];
// MEMBER users may only touch their own member record.
export function requireMemberSelf(req, res, next) {
  if (req.user.role !== 'MEMBER') return next();
  const target = req.params.memberId;
  if (!target) return next();
  // target may be a NAK id or ObjectId; resolve in route — here enforce when it equals linked member ObjectId.
  if (req.user.memberId && target === req.user.memberId) return next();
  req.memberSelfCheck = true; // route resolves NAK id then enforces
  next();
}
export async function enforceMemberScope(req, memberObjectId) {
  if (req.user.role === 'MEMBER' && String(memberObjectId) !== req.user.memberId) throw forbidden('Members can access only their own records');
}
