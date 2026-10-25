// Replace the SUPER_ADMIN set with a single env-provided account.
// Follows the exact pattern of seed-admin.js: env-only, no default password
// in code, password value never logged. Intended for deployment cutover when
// a seed/default admin must be removed before the site is shared publicly.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=<secret> ADMIN_NAME=... npm run replace:admin
// Behaviour: deletes every SUPER_ADMIN user EXCEPT the ADMIN_EMAIL account,
// then creates that account (bcrypt cost 12, role SUPER_ADMIN, name from
// ADMIN_NAME or 'Administrator') if it does not already exist. If an account
// with that email already exists with another role, it is promoted to
// SUPER_ADMIN rather than duplicated. Non-admin users are never touched.
// This script is NOT run automatically and must never be pointed at a live
// database except by an explicit deployment decision with host env vars.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD, name = process.env.ADMIN_NAME || 'Administrator';
if (!email || !password) { console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required'); process.exit(1); }
if (password.length < 8) { console.error('ADMIN_PASSWORD must be at least 8 characters'); process.exit(1); }
await mongoose.connect(env.mongodbUri);
const target = email.toLowerCase();
const removed = await User.deleteMany({ role: 'SUPER_ADMIN', email: { $ne: target } });
const existing = await User.findOne({ email: target });
if (!existing) {
  await User.create({ name, email: target, passwordHash: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN' });
  console.log(`SUPER_ADMIN created: ${target} (removed ${removed.deletedCount} other SUPER_ADMIN account(s))`);
} else if (existing.role !== 'SUPER_ADMIN') {
  existing.role = 'SUPER_ADMIN'; await existing.save();
  console.log(`SUPER_ADMIN promoted: ${target} (removed ${removed.deletedCount} other SUPER_ADMIN account(s))`);
} else {
  console.log(`SUPER_ADMIN kept: ${target} (removed ${removed.deletedCount} other SUPER_ADMIN account(s))`);
}
await mongoose.disconnect();
