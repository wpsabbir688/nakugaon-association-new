// Seed admin ONLY via env vars. Never a default password in code.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run seed:admin
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD, name = process.env.ADMIN_NAME || 'Administrator';
if (!email || !password) { console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required'); process.exit(1); }
if (password.length < 8) { console.error('ADMIN_PASSWORD must be at least 8 characters'); process.exit(1); }
await mongoose.connect(env.mongodbUri);
const existing = await User.findOne({ email: email.toLowerCase() });
if (existing) { console.error('An account with that email already exists — refusing to overwrite'); await mongoose.disconnect(); process.exit(1); }
await User.create({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN' });
console.log(`SUPER_ADMIN created: ${email}`);
await mongoose.disconnect();
