import { prisma } from '../db/prisma.js';
import { redact } from '../services/accounting.js';
// `db` is a Prisma client or an interactive-transaction client, so audit
// rows join the same transaction as the business write when one is running.
export async function writeAudit({ actor, action, recordType, recordId, reason = '', before = null, after = null }, db = null) {
  const client = db || prisma;
  await client.auditLog.create({
    data: {
      actorId: actor?.id || '', actorRole: actor?.role || '', actorEmail: actor?.email || '',
      action, recordType, recordId: recordId ? String(recordId) : '', reason,
      before: before ? redact(before) : null, after: after ? redact(after) : null,
    },
  });
}
