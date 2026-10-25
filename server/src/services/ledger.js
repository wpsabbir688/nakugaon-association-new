import { assertBalanced, computeOutstanding } from './accounting.js';
import { prisma } from '../db/prisma.js';
// Transaction convention (Prisma): withTransaction runs fn(tx) inside a
// real interactive transaction. This requires a DIRECT (non-pooled)
// Postgres URL — pooled URLs reject interactive transactions, and the
// server refuses to start without DATABASE_URL for exactly this reason.
// There is no sequential-write fallback: a failed transaction aborts loudly.
export async function withTransaction(fn) {
  return prisma.$transaction(async (tx) => fn(tx));
}
const dbOf = (db) => db || prisma;
export async function postJournal({ memo, sourceType, sourceId, member, memberId, lines }, db = null) {
  assertBalanced(lines);
  const client = dbOf(db);
  const journal = await client.journalEntry.create({ data: { memo, sourceType, sourceId: sourceId ? String(sourceId) : null, memberId: memberId || (member ? String(member) : null), status: 'posted' } });
  await client.journalLine.createMany({ data: lines.map((l) => ({ journalId: journal.id, ...l })) });
  return journal;
}
export async function postLedger({ member, memberId, kind, sourceType, sourceId, debit = 0, credit = 0, description }, db = null) {
  const client = dbOf(db);
  return client.ledgerEntry.create({ data: { memberId: memberId || String(member), kind, sourceType, sourceId: sourceId ? String(sourceId) : null, debit, credit, description, status: 'posted' } });
}
// Negating reversal of a ledger row + its journal: original kept, marked reversed.
export async function reverseLedgerAndJournal({ ledgerRows, journal, reason }, db = null) {
  const client = dbOf(db);
  for (const row of ledgerRows) {
    await client.ledgerEntry.create({ data: { memberId: row.memberId, kind: row.kind, sourceType: row.sourceType, sourceId: row.sourceId, debit: row.credit, credit: row.debit, description: `Reversal: ${reason}`, status: 'posted', reversalOfId: row.id } });
    await client.ledgerEntry.update({ where: { id: row.id }, data: { status: 'reversed' } });
  }
  if (journal) {
    const lines = await client.journalLine.findMany({ where: { journalId: journal.id } });
    const rev = await client.journalEntry.create({ data: { memo: `Reversal: ${reason}`, sourceType: journal.sourceType, sourceId: journal.sourceId, memberId: journal.memberId, status: 'posted', reversalOfId: journal.id } });
    await client.journalLine.createMany({ data: lines.map((l) => ({ journalId: rev.id, account: l.account, debit: l.credit, credit: l.debit })) });
    await client.journalEntry.update({ where: { id: journal.id }, data: { status: 'reversed' } });
    return rev;
  }
  return null;
}
export async function memberOutstanding(memberId, db = null) {
  const client = dbOf(db);
  // Append-only: reversals negate originals in the sum.
  const rows = await client.ledgerEntry.findMany({ where: { memberId: String(memberId) } });
  return computeOutstanding(rows);
}
export async function outstandingCharges(memberId, db = null) {
  const client = dbOf(db);
  // Oldest unpaid posted charges (vehicle + weighbridge) with remaining = fee - paid.
  const mk = async (model, type) => {
    const rows = await client[model].findMany({ where: { memberId: String(memberId), status: 'posted' }, orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }] });
    return rows.map((r) => ({ type, doc: r, remaining: r.feeAmount - (r.amountPaid || 0) })).filter((x) => x.remaining > 0);
  };
  const [v, w] = await Promise.all([mk('vehicleEntry', 'vehicle'), mk('weighbridgeEntry', 'weighbridge')]);
  return [...v, ...w].sort((a, b) => new Date(a.doc.entryDate) - new Date(b.doc.entryDate));
}
