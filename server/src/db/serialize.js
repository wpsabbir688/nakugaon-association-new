// Serialize Prisma rows into the /api/v1 wire shape the MongoDB layer
// produced, so the React client needs no changes:
//   - every row gets `_id` (the Prisma `id` value) alongside `id`
//   - populated relations (e.g. `member`) are serialized recursively
//   - User rows never carry passwordHash / resetTokenHash
//   - AuditLog actor columns collapse back into an `actor` object
// Dates stay as Date objects here; Express JSON-encodes them as ISO strings,
// exactly as Mongoose documents serialized before.
const HIDDEN = new Set(['passwordHash', 'resetTokenHash']);
export function ser(row) {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(ser);
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (HIDDEN.has(k)) continue;
    if (k === 'member' && v && typeof v === 'object') out.member = ser(v);
    else if (k === 'memberId' && typeof v === 'string') out.memberId = v;
    else out[k] = v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && v.id !== undefined ? ser(v) : v;
  }
  if (row.id !== undefined) out._id = row.id;
  // Wire aliases: the Mongo layer exposed relation fields under their
  // Mongoose names (member / feeRule / createdBy / ...), while Prisma
  // columns are memberId / feeRuleId / createdById / .... Alias them so
  // create-responses and tests see the same field names as before.
  if (row.memberId && !row.member) out.member = row.memberId;
  if (row.feeRuleId) out.feeRule = row.feeRuleId;
  if (row.createdById) out.createdBy = row.createdById;
  if (row.receivedById) out.receivedBy = row.receivedById;
  if (row.approvedById) out.approvedBy = row.approvedById;
  if (row.uploadedById) out.uploadedBy = row.uploadedById;
  return out;
}
export function serAudit(row) {
  if (!row) return row;
  const o = ser(row);
  const hasActor = row.actorId || row.actorRole || row.actorEmail;
  o.actor = hasActor ? { id: row.actorId || '', role: row.actorRole || '', email: row.actorEmail || '' } : null;
  delete o.actorId; delete o.actorRole; delete o.actorEmail;
  return o;
}
export function serUser(row) {
  if (!row) return row;
  const o = ser(row);
  delete o.memberId;
  // The client/auth shape uses `member` as the linked member id (or null).
  o.member = row.memberId || null;
  return o;
}
