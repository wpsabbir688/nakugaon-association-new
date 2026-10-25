import { badRequest } from '../errors.js';
export const validate = (schema, where = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[where]);
  if (!parsed.success) return next(badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  req[where] = parsed.data; next();
};
