import mongoose from 'mongoose';
const s = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
  kind: { type: String, enum: ['photo', 'document'], required: true },
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
s.index({ member: 1 });
export const FileMetadata = mongoose.model('FileMetadata', s);
