const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
export const env = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  // PostgreSQL only. Must be a DIRECT (non-pooled) URL: pooled URLs reject
  // Prisma interactive transactions. NEVER point this at the old live
  // `nakugaon` Neon database — this project needs its own separate database.
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
};
export function assertEnv() {
  if (!env.databaseUrl) throw new Error('DATABASE_URL is required (PostgreSQL, direct non-pooled URL)');
  if (env.nodeEnv === 'production' && !env.jwtSecret) throw new Error('JWT_SECRET is required in production');
  if (!env.jwtSecret) console.warn('[warn] JWT_SECRET is not set — using an insecure dev fallback. Never do this in production.');
}
