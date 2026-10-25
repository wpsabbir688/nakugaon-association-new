export function assertIntBDT(value, field = 'amount') {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw Object.assign(new Error(`${field} must be an integer BDT amount (whole taka)`), { status: 400, code: 'VALIDATION_ERROR' });
  return value;
}
export function assertNonNegativeInt(value, field = 'amount') { assertIntBDT(value, field); if (value < 0) throw Object.assign(new Error(`${field} must not be negative`), { status: 400, code: 'VALIDATION_ERROR' }); return value; }
