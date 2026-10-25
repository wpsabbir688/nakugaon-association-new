import { describe, it, expect } from 'vitest';
import { computeOutstanding, isBalanced, assertBalanced, allocatePayment, checkOverpayment } from '../../server/src/services/accounting.js';
describe('computeOutstanding', () => {
  it('opening + charges - payments - credits', () => {
    const rows = [
      { kind: 'opening', debit: 500, credit: 0, status: 'posted' },
      { kind: 'charge', debit: 200, credit: 0, status: 'posted' },
      { kind: 'charge', debit: 300, credit: 0, status: 'posted' },
      { kind: 'payment', debit: 0, credit: 400, status: 'posted' },
    ];
    const t = computeOutstanding(rows);
    expect(t.outstanding).toBe(600); expect(t.charges).toBe(500); expect(t.payments).toBe(400);
  });
  it('reversal rows offset the original even though the original is marked reversed', () => {
    const rows = [
      { kind: 'charge', debit: 200, credit: 0, status: 'reversed' }, // original, kept for audit
      { kind: 'charge', debit: 0, credit: 200, status: 'posted' }, // negating reversal row
    ];
    expect(computeOutstanding(rows).outstanding).toBe(0);
  });
  it('a reversed payment restores outstanding (original + reversal cancel)', () => {
    const rows = [
      { kind: 'charge', debit: 100, credit: 0, status: 'posted' },
      { kind: 'payment', debit: 0, credit: 60, status: 'reversed' },
      { kind: 'payment', debit: 60, credit: 0, status: 'posted' }, // payment reversal row
    ];
    const t = computeOutstanding(rows);
    expect(t.payments).toBe(0); expect(t.outstanding).toBe(100);
  });
  it('unapplied credit is tracked separately, not subtracted from outstanding', () => {
    const rows = [{ kind: 'charge', debit: 100, credit: 0, status: 'posted' }, { kind: 'unapplied', debit: 0, credit: 50, status: 'posted' }];
    const t = computeOutstanding(rows); expect(t.outstanding).toBe(100); expect(t.unappliedCredit).toBe(50);
  });
});
describe('journal balance', () => {
  it('balanced passes, unbalanced throws and never posts', () => {
    expect(isBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }])).toBe(true);
    expect(isBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 99 }])).toBe(false);
    expect(() => assertBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 99 }])).toThrow();
    expect(() => assertBalanced([{ debit: 100.5, credit: 0 }, { debit: 0, credit: 100.5 }])).toThrow();
  });
});
describe('allocation + overpayment', () => {
  it('FIFO allocation across oldest charges', () => {
    const { allocations, unallocated } = allocatePayment(250, [{ id: 'a', remaining: 100 }, { id: 'b', remaining: 200 }]);
    expect(allocations).toEqual([{ chargeId: 'a', amount: 100 }, { chargeId: 'b', amount: 150 }]); expect(unallocated).toBe(0);
  });
  it('rejects overpayment by default, allows advance only when enabled', () => {
    expect(() => checkOverpayment(100, 150, false)).toThrow(/exceeds outstanding/);
    expect(checkOverpayment(100, 150, true)).toEqual({ applied: 100, advance: 50 });
    expect(() => checkOverpayment(100, 0, true)).toThrow();
  });
});
