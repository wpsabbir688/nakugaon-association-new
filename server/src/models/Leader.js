import mongoose from 'mongoose';
// Elected leaders / committee members as a managed entity. Starts EMPTY —
// no names are seeded or imported from any other system (see DATA RULE).
const s = new mongoose.Schema({
  nameBn: { type: String, required: true, trim: true },
  nameEn: { type: String, default: '', trim: true },
  designationBn: { type: String, required: true, trim: true },
  designationEn: { type: String, default: '', trim: true },
  firm: { type: String, default: '', trim: true },
  displayOrder: { type: Number, default: 0 },
  mobile: { type: String, default: '', trim: true },
  photoUrl: { type: String, default: '', trim: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });
s.index({ displayOrder: 1 });
export const Leader = mongoose.model('Leader', s);
