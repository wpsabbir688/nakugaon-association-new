import bcrypt from 'bcryptjs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../../server/src/db/prisma.js';
import { createApp } from '../../server/src/app.js';
import { bootstrap } from '../../server/src/services/bootstrap.js';

// Tests run against PostgreSQL only. Run vitest with DATABASE_URL pointing
// at a disposable local/test database, e.g.:
//   DATABASE_URL='postgresql://nakugaon@127.0.0.1:5433/nakugaon_test' \
//     ./server/node_modules/.bin/vitest run tests
// setup() DROPS the whole public schema and re-applies migrations, so
// NEVER point DATABASE_URL at a real or shared database here.
export async function startTestDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for tests (disposable local/test Postgres only)');
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../server');
  execSync('./node_modules/.bin/prisma migrate deploy', { cwd: serverDir, stdio: 'inherit', env: { ...process.env } });
  await bootstrap();
  return createApp();
}
export async function stopTestDb() { await prisma.$disconnect(); }
export async function makeStaff(role = 'SUPER_ADMIN') {
  return prisma.user.create({ data: { name: 'Staff', email: `staff-${role.toLowerCase()}@test.local`, passwordHash: await bcrypt.hash('password123', 10), role } });
}
export async function makeMember() {
  const { nextMemberId } = await import('../../server/src/services/ids.js');
  const id = await nextMemberId();
  return prisma.member.create({ data: { memberId: id, fullName: 'Test Member', businessName: 'Test Biz' } });
}
