import { Counter } from '../models/Counter.js';
export async function nextSeq(key, session = null) {
  const doc = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true, session: session || undefined });
  return doc.seq;
}
export async function nextMemberId(session = null) {
  const seq = await nextSeq('member', session);
  return `NAK-${String(seq).padStart(4, '0')}`;
}
export async function nextReceiptNo(session = null) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = await nextSeq(`receipt-${ymd}`, session);
  return `REC-${ymd}-${String(seq).padStart(4, '0')}`;
}
