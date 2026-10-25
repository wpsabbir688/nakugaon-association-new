import mongoose from 'mongoose';
const s = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, default: 'general', trim: true },
  amount: { type: Number, required: true, validate: Number.isInteger },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'reversed'], default: 'pending' },
  expenseDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });
s.index({ status: 1, expenseDate: -1 });
export const Expense = mongoose.model('Expense', s);
