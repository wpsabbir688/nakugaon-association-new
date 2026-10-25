import { prisma } from '../db/prisma.js';
export async function getSettings(db = null) {
  const client = db || prisma;
  let s = await client.siteSetting.findUnique({ where: { key: 'site' } });
  if (!s) s = await client.siteSetting.create({ data: { key: 'site' } });
  return s;
}
