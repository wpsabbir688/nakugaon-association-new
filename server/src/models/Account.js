import mongoose from 'mongoose';
const s = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['asset', 'liability', 'income', 'expense'], required: true },
}, { timestamps: true });
export const Account = mongoose.model('Account', s);
