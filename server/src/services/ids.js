import { prisma } from '../db/prisma.js';
// Atomic sequence counter. Inside a Prisma interactive transaction the
// upsert-increment serializes on the row, so sequence values are never
// duplicated even under concurrency. `db` is a Prisma client or tx client.
export async function nextSeq(key, db = null) {
  const client = db || prisma;
  const doc = await client.counter.upsert({ where: { key }, update: { seq: { increment: 1 } }, create: { key, seq: 1 } });
  return doc.seq;
}
export async function nextMemberId(db = null) {
  const seq = await nextSeq('member', db);
  return `NAK-${String(seq).padStart(4, '0')}`;
}
export async function nextReceiptNo(db = null) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = await nextSeq(`receipt-${ymd}`, db);
  return `REC-${ymd}-${String(seq).padStart(4, '0')}`;
}
