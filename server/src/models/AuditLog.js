import mongoose from 'mongoose';
const s = new mongoose.Schema({
  actor: { id: { type: String, default: '' }, role: { type: String, default: '' }, email: { type: String, default: '' } },
  action: { type: String, required: true },
  recordType: { type: String, required: true },
  recordId: { type: String, default: '' },
  reason: { type: String, default: '' },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });
s.index({ recordType: 1, recordId: 1, createdAt: -1 }); s.index({ action: 1, createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', s);
