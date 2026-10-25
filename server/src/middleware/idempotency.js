import { IdempotencyRecord } from '../models/IdempotencyRecord.js';
// Returns cached response if this user already completed this key on this endpoint.
export async function checkIdempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string') return next();
  req.idempotencyKey = key;
  try {
    const rec = await IdempotencyRecord.findOne({ user: req.user.id, endpoint: req.path, key }).lean();
    if (rec && rec.response) return res.status(rec.status || 200).json(rec.response);
  } catch { /* never block on idempotency lookup failure */ }
  next();
}
export async function storeIdempotency(req, status, body) {
  if (!req.idempotencyKey || !req.user) return;
  try { await IdempotencyRecord.updateOne({ user: req.user.id, endpoint: req.path, key: req.idempotencyKey }, { $setOnInsert: { response: body, status } }, { upsert: true }); } catch { /* ignore */ }
}
