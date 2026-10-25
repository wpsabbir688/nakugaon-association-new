import { prisma } from '../db/prisma.js';
import { logger } from './logger.js';
export async function connectDb() {
  await prisma.$connect();
  logger.info('postgres connected');
}
export async function disconnectDb() { await prisma.$disconnect(); }
// True when the database answers a trivial query (used by /settings/status).
export async function dbConnected() {
  try { await prisma.$queryRaw`SELECT 1`; return true; } catch { return false; }
}
