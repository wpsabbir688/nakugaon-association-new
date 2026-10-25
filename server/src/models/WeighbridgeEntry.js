import mongoose from 'mongoose';
const s = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  vehicleNumber: { type: String, required: true, trim: true },
  category: { type: String, enum: ['bhutan', 'bangladeshi', 'lorry-crab', 'trolley'], required: true },
  weightKg: { type: Number, default: null },
  feeAmount: { type: Number, required: true, validate: Number.isInteger },
  feeRule: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeRule', default: null },
  amountPaid: { type: Number, default: 0, validate: Number.isInteger },
  status: { type: String, enum: ['posted', 'reversed'], default: 'posted' },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'WeighbridgeEntry', default: null },
  reversalReason: { type: String, default: '' },
  entryDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });
s.index({ member: 1, entryDate: -1 }); s.index({ category: 1 });
export const WeighbridgeEntry = mongoose.model('WeighbridgeEntry', s);
