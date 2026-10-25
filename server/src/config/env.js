const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
export const env = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nakugaon',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
};
export function assertEnv() {
  if (env.nodeEnv === 'production' && !env.jwtSecret) throw new Error('JWT_SECRET is required in production');
  if (!env.jwtSecret) console.warn('[warn] JWT_SECRET is not set — using an insecure dev fallback. Never do this in production.');
}
