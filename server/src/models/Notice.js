import mongoose from 'mongoose';
const s = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  language: { type: String, enum: ['bn', 'en', 'both'], default: 'bn' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  pinned: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
s.index({ status: 1, pinned: -1, publishedAt: -1 });
export const Notice = mongoose.model('Notice', s);
