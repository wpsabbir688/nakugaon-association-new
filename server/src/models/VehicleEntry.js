import mongoose from 'mongoose';
// Quantity-based vehicle entries (Phase 8): one entry = N vehicles, NO individual
// vehicle registration numbers required. feeAmount is kept (= totalCharge) so the
// existing payment-allocation, reporting and dashboard code that sums feeAmount
// keeps working unchanged.
const s = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  // Legacy per-vehicle fields: optional only, never required for a quantity entry.
  vehicleNumber: { type: String, default: '', trim: true },
  vehicleCategory: { type: String, default: 'standard', trim: true },
  driverName: { type: String, default: '' },
  feePerVehicle: { type: Number, required: true, min: 0, validate: Number.isInteger },
  totalCharge: { type: Number, required: true, min: 0, validate: Number.isInteger },
  feeAmount: { type: Number, required: true, validate: Number.isInteger },
  feeRule: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeRule', default: null },
  amountPaid: { type: Number, default: 0, validate: Number.isInteger },
  status: { type: String, enum: ['posted', 'reversed'], default: 'posted' },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleEntry', default: null },
  reversalReason: { type: String, default: '' },
  entryDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });
s.index({ member: 1, entryDate: -1 }); s.index({ vehicleNumber: 1 });
export const VehicleEntry = mongoose.model('VehicleEntry', s);
