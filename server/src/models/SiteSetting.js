import mongoose from 'mongoose';
const s = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'site' },
  associationName: { type: String, default: '' },
  associationNameBn: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  address: { type: String, default: '' },
  registrationNo: { type: String, default: '' },
  committee: { type: Array, default: [] }, // stays EMPTY until association confirms
  statistics: { type: Object, default: {} }, // stays EMPTY until association confirms
  allowAdvancePayments: { type: Boolean, default: false },
  publicBalanceDisclosure: { type: Boolean, default: false },
}, { timestamps: true });
export const SiteSetting = mongoose.model('SiteSetting', s);
