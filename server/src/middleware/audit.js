import { AuditLog } from '../models/AuditLog.js';
import { redact } from '../services/accounting.js';
export async function writeAudit({ actor, action, recordType, recordId, reason = '', before = null, after = null }, session = null) {
  const doc = { actor: actor ? { id: actor.id, role: actor.role, email: actor.email } : null, action, recordType, recordId: recordId ? String(recordId) : '', reason, before: before ? redact(before) : null, after: after ? redact(after) : null };
  await AuditLog.create([doc], session ? { session } : {});
}
