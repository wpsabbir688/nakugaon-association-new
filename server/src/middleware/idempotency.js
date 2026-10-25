import { prisma } from '../db/prisma.js';
// Returns cached response if this user already completed this key on this endpoint.
export async function checkIdempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string') return next();
  req.idempotencyKey = key;
  try {
    const rec = await prisma.idempotencyRecord.findUnique({ where: { userId_endpoint_key: { userId: req.user.id, endpoint: req.path, key } } });
    if (rec && rec.response) return res.status(rec.status || 200).json(rec.response);
  } catch { /* never block on idempotency lookup failure */ }
  next();
}
export async function storeIdempotency(req, status, body) {
  if (!req.idempotencyKey || !req.user) return;
  try {
    // JSON round-trip: Prisma Json columns need plain JSON (Dates become the
    // same ISO strings Express would have sent on the wire anyway).
    const response = JSON.parse(JSON.stringify(body));
    await prisma.idempotencyRecord.upsert({
      where: { userId_endpoint_key: { userId: req.user.id, endpoint: req.path, key: req.idempotencyKey } },
      update: {},
      create: { userId: req.user.id, endpoint: req.path, key: req.idempotencyKey, response, status },
    });
  } catch { /* ignore */ }
}
