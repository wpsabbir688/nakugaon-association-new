import mongoose from 'mongoose';
const s = new mongoose.Schema({
  memberId: { type: String, required: true, unique: true }, // NAK-0001, atomic, never reused
  fullName: { type: String, required: true, trim: true },
  businessName: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  address: { type: String, default: '' },
  membershipType: { type: String, enum: ['importer', 'exporter', 'both', 'other'], default: 'importer' },
  status: { type: String, enum: ['active', 'suspended', 'archived'], default: 'active' },
  joinedAt: { type: Date, default: Date.now },
  privateNotes: { type: String, default: '' },
  bankDetails: { type: String, default: '' },
  archivedAt: { type: Date, default: null },
  archivedReason: { type: String, default: '' },
}, { timestamps: true });
export const Member = mongoose.model('Member', s);
