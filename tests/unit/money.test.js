import { describe, it, expect } from 'vitest';
import { assertIntBDT } from '../../server/src/services/../utils/money.js';
describe('integer BDT', () => {
  it('accepts integers, rejects floats/strings', () => {
    expect(assertIntBDT(100)).toBe(100);
    expect(() => assertIntBDT(100.5)).toThrow();
    expect(() => assertIntBDT('100')).toThrow();
  });
});
