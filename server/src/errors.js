export class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
export const badRequest = (msg, code = 'VALIDATION_ERROR') => new ApiError(400, code, msg);
export const unauthorized = (msg = 'Authentication required') => new ApiError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Forbidden') => new ApiError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found') => new ApiError(404, 'NOT_FOUND', msg);
export const conflict = (msg, code = 'CONFLICT') => new ApiError(409, code, msg);
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Duplicate value for a unique field' } });
  if (err?.code === 'P2025') return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
  const status = err?.status || 500;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', msg: err?.message, stack: err?.stack }));
  res.status(status).json({ success: false, error: { code: err?.code || 'INTERNAL_ERROR', message: status >= 500 ? 'Internal server error' : err.message } });
}
export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
