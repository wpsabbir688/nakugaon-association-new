import mongoose from 'mongoose';
const s = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  kind: { type: String, enum: ['opening', 'charge', 'payment', 'credit', 'unapplied'], required: true },
  sourceType: { type: String, required: true }, // VehicleEntry|WeighbridgeEntry|Payment|OpeningBalance|Credit
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  debit: { type: Number, default: 0, validate: Number.isInteger },
  credit: { type: Number, default: 0, validate: Number.isInteger },
  description: { type: String, default: '' },
  status: { type: String, enum: ['posted', 'reversed'], default: 'posted' },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
  postedAt: { type: Date, default: Date.now },
}, { timestamps: true });
s.index({ member: 1, postedAt: 1 }); s.index({ sourceType: 1, sourceId: 1 });
export const LedgerEntry = mongoose.model('LedgerEntry', s);
