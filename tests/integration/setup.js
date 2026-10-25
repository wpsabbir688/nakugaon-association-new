import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../../server/src/app.js';
import { bootstrap } from '../../server/src/services/bootstrap.js';
import { User } from '../../server/src/models/User.js';
import { Member } from '../../server/src/models/Member.js';
let replset;
export async function startTestDb() {
  if (process.env.TEST_MONGODB_URI) {
    // Manual replica set (e.g. mongod --replSet rs0 started from a local binary):
    // used when mongodb-memory-server's own downloader/startup cannot run on this VM.
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    await mongoose.connection.db.dropDatabase(); // clean slate for the suite
    replset = null;
  } else {
    replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replset.getUri());
  }
  await bootstrap();
  const app = createApp();
  return app;
}
export async function stopTestDb() { await mongoose.disconnect(); if (replset) await replset.stop(); }
export async function makeStaff(role = 'SUPER_ADMIN') {
  const u = await User.create({ name: 'Staff', email: `staff-${role.toLowerCase()}@test.local`, passwordHash: await bcrypt.hash('password123', 10), role });
  return u;
}
export async function makeMember() {
  const { nextMemberId } = await import('../../server/src/services/ids.js');
  const id = await nextMemberId();
  return Member.create({ memberId: id, fullName: 'Test Member', businessName: 'Test Biz' });
}
