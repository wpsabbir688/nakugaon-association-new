// PURE accounting rules — no DB, no imports. Unit-tested without MongoDB.
// Outstanding = Opening + Posted Charges - Posted Payments - Approved Credits.
// APPEND-ONLY convention: the ledger is never mutated. A reversal creates a
// separate negating row and marks the original 'reversed' for display, but the
// sum runs over ALL rows: original + reversal cancel exactly. (Summing only
// 'posted' rows would double-count: the original's effect would vanish AND the
// reversal's negation would still apply.)
export function computeOutstanding(ledgerEntries) {
  let opening = 0, charges = 0, payments = 0, credits = 0, unappliedCredit = 0;
  for (const e of ledgerEntries || []) {
    const net = (e.debit || 0) - (e.credit || 0);
    if (e.kind === 'opening') opening += net;
    else if (e.kind === 'charge') charges += net;
    else if (e.kind === 'payment') payments -= net; // payment rows are credit-heavy: net negative
    else if (e.kind === 'credit') credits -= net;
    else if (e.kind === 'unapplied') unappliedCredit += -(net); // stored as credit: net negative
  }
  // payments/credits stored as credit amounts: outstanding contribution is -credit.
  // The loop above already converts: payment net is negative, so payments accumulates positive paid amount.
  return { opening, charges, payments, credits, unappliedCredit, outstanding: opening + charges - payments - credits };
}
export function isBalanced(lines) {
  const d = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const c = lines.reduce((s, l) => s + (l.credit || 0), 0);
  return d === c && d > 0;
}
export function assertBalanced(lines) {
  if (!Array.isArray(lines) || lines.length < 2) throw Object.assign(new Error('Journal needs at least two lines'), { status: 400, code: 'UNBALANCED_JOURNAL' });
  for (const l of lines) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit) || l.debit < 0 || l.credit < 0) throw Object.assign(new Error('Journal lines must be non-negative integer BDT'), { status: 400, code: 'VALIDATION_ERROR' });
    if (l.debit > 0 && l.credit > 0) throw Object.assign(new Error('A journal line cannot be both debit and credit'), { status: 400, code: 'UNBALANCED_JOURNAL' });
  }
  if (!isBalanced(lines)) throw Object.assign(new Error('Unbalanced journal entry: debits must equal credits — refusing to post'), { status: 400, code: 'UNBALANCED_JOURNAL' });
}
// FIFO allocation of a payment across oldest unpaid charges. Pure + testable.
export function allocatePayment(paymentAmount, charges) {
  // charges: [{id, remaining}] sorted oldest-first by caller.
  const allocations = []; let left = paymentAmount;
  for (const ch of charges) {
    if (left <= 0) break;
    const take = Math.min(left, ch.remaining);
    if (take > 0) { allocations.push({ chargeId: ch.id, amount: take }); left -= take; }
  }
  return { allocations, unallocated: left };
}
export function checkOverpayment(outstanding, paymentAmount, allowAdvance) {
  if (!Number.isInteger(paymentAmount) || paymentAmount <= 0) throw Object.assign(new Error('Payment amount must be a positive integer BDT'), { status: 400, code: 'VALIDATION_ERROR' });
  if (paymentAmount > outstanding && !allowAdvance) throw Object.assign(new Error(`Payment ${paymentAmount} exceeds outstanding ${outstanding}; advance payments are not enabled`), { status: 400, code: 'OVERPAYMENT' });
  const applied = Math.min(paymentAmount, outstanding);
  return { applied, advance: paymentAmount - applied };
}
export const REDACTED_FIELDS = new Set(['passwordHash', 'password', 'resetTokenHash', 'resetToken', 'bankAccount', 'bankDetails', 'privateNotes', 'token']);
export function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) out[k] = REDACTED_FIELDS.has(k) ? '[REDACTED]' : (v && typeof v === 'object' ? redact(v) : v);
  return out;
}
