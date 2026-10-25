import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Single Prisma client for the process. DATABASE_URL comes from env only
// (see config/env.js) — never hardcode a connection string here. The URL
// must be DIRECT (non-pooled): pooled URLs reject Prisma interactive
// transactions, which the accounting layer relies on.
// Placeholder only so importing this module never crashes when DATABASE_URL
// is unset (e.g. a test runner that sets it later); `npm start` still
// refuses to boot without a real DATABASE_URL via assertEnv(), and any
// query against the placeholder fails loudly instead of touching real data.
export const prisma = new PrismaClient({ datasources: { db: { url: env.databaseUrl || 'postgresql://127.0.0.1:5433/placeholder' } } });
export default prisma;
