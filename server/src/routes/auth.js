import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { serUser } from '../db/serialize.js';
import { signToken, cookieOptions, requireAuth, COOKIE_NAME } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { ok, badRequest, unauthorized, notFound, ApiError } from '../errors.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { writeAudit } from '../middleware/audit.js';
const r = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
r.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user || user.status !== 'active' || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw unauthorized('Invalid email or password');
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    ok(res, { id: String(user.id), name: user.name, email: user.email, role: user.role, member: user.memberId ? String(user.memberId) : null });
  } catch (e) { next(e); }
});
r.post('/logout', (req, res) => { res.clearCookie(COOKIE_NAME, { path: '/' }); ok(res, { loggedOut: true }); });
// Change the LOGGED-IN user's own password only. There is no user-id parameter,
// so one account can never change another account's password through this route.
// Session limitation (documented, not faked): auth tokens are stateless JWTs with
// no token version / revocation list, so tokens issued before a change stay
// valid until they expire. This route clears the caller's cookie and the client
// clears its session and redirects to login; other devices/sessions are NOT
// invalidated. Any outstanding reset token is also cleared.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128).optional(),
}).refine((d) => !d.confirmPassword || d.confirmPassword === d.newPassword, { message: 'New passwords do not match', path: ['confirmPassword'] });
r.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.status !== 'active') throw unauthorized('Account is not active');
    if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw unauthorized('Current password is incorrect');
    if (req.body.newPassword === req.body.currentPassword) throw badRequest('New password must be different from the current password');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(req.body.newPassword, 12), resetTokenHash: null, resetTokenExpiresAt: null } });
    // Audit entry carries actor/action/timestamp only — never any password value.
    await writeAudit({ actor: req.user, action: 'PASSWORD_CHANGE', recordType: 'User', recordId: String(user.id), after: { passwordChanged: true } });
    res.clearCookie(COOKIE_NAME, { path: '/' });
    ok(res, { passwordChanged: true });
  } catch (e) { next(e); }
});
r.get('/me', requireAuth, async (req, res) => { ok(res, req.user); });
r.post('/forgot-password', authLimiter, validate(z.object({ email: z.string().email() })), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: crypto.createHash('sha256').update(token).digest('hex'), resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
      if (env.smtpConfigured) logger.info('password reset requested; SMTP configured (sending is not implemented in this slice — configure mailer before claiming delivery)', { email: req.body.email });
      else logger.info('password reset requested (LOG-ONLY: no SMTP configured, no email sent)', { email: req.body.email });
    }
    // Honest generic response: never confirm whether the email exists, and never claim an email was sent when SMTP is absent.
    ok(res, { message: env.smtpConfigured ? 'If the account exists, reset instructions were requested.' : 'Password reset is log-only: no SMTP is configured, so no email was sent. Contact an administrator.' });
  } catch (e) { next(e); }
});
r.post('/reset-password', authLimiter, validate(z.object({ token: z.string().min(10), password: z.string().min(8) })), async (req, res, next) => {
  try {
    const hash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const user = await prisma.user.findFirst({ where: { resetTokenHash: hash, resetTokenExpiresAt: { gt: new Date() } } });
    if (!user) throw badRequest('Invalid or expired reset token');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(req.body.password, 12), resetTokenHash: null, resetTokenExpiresAt: null } });
    await writeAudit({ actor: { id: String(user.id), role: user.role, email: user.email }, action: 'PASSWORD_RESET', recordType: 'User', recordId: String(user.id) });
    ok(res, { reset: true });
  } catch (e) { next(e); }
});
// Admin user management (staff only; role changes audited). No self-demotion guard bypass: SUPER_ADMIN only for role changes.
r.get('/users', requireAuth, async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role)) throw new ApiError(403, 'FORBIDDEN', 'Forbidden');
    const users = await prisma.user.findMany();
    ok(res, users.map((u) => serUser(u)));
  } catch (e) { next(e); }
});
r.post('/users', requireAuth, validate(z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8), role: z.enum(['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR', 'MEMBER']), memberId: z.string().optional() })), async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Forbidden');
    let member = null;
    if (req.body.memberId) { member = await prisma.member.findUnique({ where: { memberId: req.body.memberId } }); if (!member) throw notFound('Member not found'); }
    const user = await prisma.user.create({ data: { name: req.body.name, email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12), role: req.body.role, memberId: member?.id || null } });
    await writeAudit({ actor: req.user, action: 'USER_CREATE', recordType: 'User', recordId: String(user.id), after: { email: user.email, role: user.role } });
    ok(res, { id: String(user.id), email: user.email, role: user.role }, 201);
  } catch (e) { next(e); }
});
r.patch('/users/:id/role', requireAuth, validate(z.object({ role: z.enum(['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR', 'MEMBER']) })), async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Forbidden');
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound('User not found');
    const before = { role: user.role };
    await prisma.user.update({ where: { id: user.id }, data: { role: req.body.role } });
    await writeAudit({ actor: req.user, action: 'ROLE_CHANGE', recordType: 'User', recordId: String(user.id), before, after: { role: req.body.role } });
    ok(res, { id: String(user.id), role: req.body.role });
  } catch (e) { next(e); }
});
export default r;
