import mongoose from 'mongoose';
import { assertBalanced } from './accounting.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { JournalLine } from '../models/JournalLine.js';
import { logger } from '../config/logger.js';
import { isReplicaSet } from '../config/db.js';
// Runs fn(session|null) inside a transaction when the deployment supports it.
// On a standalone mongod transactions are rejected: we fall back to sequential
// writes and LOG LOUDLY — this fallback must never be used in production.
export async function withTransaction(fn) {
  if (!isReplicaSet()) {
    // Try anyway: memory replset detection may miss; if it throws, fall back.
    try {
      const session = await mongoose.startSession();
      try { let out; await session.withTransaction(async () => { out = await fn(session); }); return out; }
      finally { await session.endSession(); }
    } catch (e) {
      if (/Transaction numbers are only allowed|replica set/i.test(e.message)) {
        logger.warn('TRANSACTION FALLBACK: deployment is not a replica set; writes are sequential, NOT atomic. Use Atlas/a replica set in production.', { error: e.message });
        return fn(null);
      }
      throw e;
    }
  }
  const session = await mongoose.startSession();
  try { let out; await session.withTransaction(async () => { out = await fn(session); }); return out; }
  finally { await session.endSession(); }
}
const opts = (s) => (s ? { session: s } : {});
export async function postJournal({ memo, sourceType, sourceId, member, lines }, session) {
  assertBalanced(lines);
  const [journal] = await JournalEntry.create([{ memo, sourceType, sourceId, member, status: 'posted' }], opts(session));
  await JournalLine.insertMany(lines.map((l) => ({ journal: journal._id, ...l })), opts(session));
  return journal;
}
export async function postLedger({ member, kind, sourceType, sourceId, debit = 0, credit = 0, description }, session) {
  const [row] = await LedgerEntry.create([{ member, kind, sourceType, sourceId, debit, credit, description, status: 'posted' }], opts(session));
  return row;
}
// Negating reversal of a ledger row + its journal: original kept, marked reversed.
export async function reverseLedgerAndJournal({ ledgerRows, journal, reason }, session) {
  for (const row of ledgerRows) {
    await LedgerEntry.create([{ member: row.member, kind: row.kind, sourceType: row.sourceType, sourceId: row.sourceId, debit: row.credit, credit: row.debit, description: `Reversal: ${reason}`, status: 'posted', reversalOf: row._id }], opts(session));
    await LedgerEntry.updateOne({ _id: row._id }, { $set: { status: 'reversed' } }, opts(session));
  }
  if (journal) {
    const lines = await JournalLine.find({ journal: journal._id }, null, opts(session));
    const [rev] = await JournalEntry.create([{ memo: `Reversal: ${reason}`, sourceType: journal.sourceType, sourceId: journal.sourceId, member: journal.member, status: 'posted', reversalOf: journal._id }], opts(session));
    await JournalLine.insertMany(lines.map((l) => ({ journal: rev._id, account: l.account, debit: l.credit, credit: l.debit })), opts(session));
    await JournalEntry.updateOne({ _id: journal._id }, { $set: { status: 'reversed' } }, opts(session));
    return rev;
  }
  return null;
}
export async function memberOutstanding(memberId, session = null) {
  const q = LedgerEntry.find({ member: memberId }); // append-only: reversals negate originals in the sum
  if (session) q.session(session);
  const rows = await q.lean();
  const { computeOutstanding } = await import('./accounting.js');
  return computeOutstanding(rows);
}
export async function outstandingCharges(memberId, session = null) {
  // Oldest unpaid posted charges (vehicle + weighbridge) with remaining = fee - paid.
  const { VehicleEntry } = await import('../models/VehicleEntry.js');
  const { WeighbridgeEntry } = await import('../models/WeighbridgeEntry.js');
  const mk = (Model, type) => { const q = Model.find({ member: memberId, status: 'posted' }).sort({ entryDate: 1, createdAt: 1 }); if (session) q.session(session); return q.lean().then((rows) => rows.map((r) => ({ type, doc: r, remaining: r.feeAmount - (r.amountPaid || 0) })).filter((x) => x.remaining > 0)); };
  const [v, w] = await Promise.all([mk(VehicleEntry, 'vehicle'), mk(WeighbridgeEntry, 'weighbridge')]);
  return [...v, ...w].sort((a, b) => new Date(a.doc.entryDate) - new Date(b.doc.entryDate));
}
