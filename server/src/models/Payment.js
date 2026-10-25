import mongoose from 'mongoose';
const s = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true }, // REC-YYYYMMDD-####
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  amount: { type: Number, required: true, validate: Number.isInteger },
  appliedAmount: { type: Number, required: true, validate: Number.isInteger },
  advanceAmount: { type: Number, default: 0, validate: Number.isInteger },
  method: { type: String, enum: ['cash', 'bank', 'bkash', 'nagad', 'other'], default: 'cash' },
  reference: { type: String, default: '' },
  status: { type: String, enum: ['posted', 'reversed'], default: 'posted' },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  reversalReason: { type: String, default: '' },
  paymentDate: { type: Date, default: Date.now },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });
export const Payment = mongoose.model('Payment', s);
