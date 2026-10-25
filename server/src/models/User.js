import mongoose from 'mongoose';
export const ROLES = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR', 'MEMBER'];
const s = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  resetTokenHash: { type: String, default: null, select: false },
  resetTokenExpiresAt: { type: Date, default: null },
}, { timestamps: true });
export const User = mongoose.model('User', s);
