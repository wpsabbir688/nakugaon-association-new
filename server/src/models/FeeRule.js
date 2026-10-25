import mongoose from 'mongoose';
const s = new mongoose.Schema({
  scope: { type: String, enum: ['vehicle', 'weighbridge'], required: true },
  category: { type: String, required: true, trim: true }, // weighbridge: bhutan|bangladeshi|lorry-crab|trolley; vehicle: free-form category
  amount: { type: Number, required: true, min: 0, validate: Number.isInteger },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, default: null },
  reason: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });
s.index({ scope: 1, category: 1, effectiveFrom: -1 });
export const FeeRule = mongoose.model('FeeRule', s);
