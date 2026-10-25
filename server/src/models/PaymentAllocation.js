import mongoose from 'mongoose';
const s = new mongoose.Schema({
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  chargeType: { type: String, enum: ['vehicle', 'weighbridge'], required: true },
  chargeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true, validate: Number.isInteger },
  status: { type: String, enum: ['posted', 'reversed'], default: 'posted' },
}, { timestamps: true });
s.index({ payment: 1 }); s.index({ chargeType: 1, chargeId: 1 });
export const PaymentAllocation = mongoose.model('PaymentAllocation', s);
