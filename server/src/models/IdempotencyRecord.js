import mongoose from 'mongoose';
const s = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint: { type: String, required: true },
  key: { type: String, required: true },
  response: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: Number, default: 200 },
}, { timestamps: true });
s.index({ user: 1, endpoint: 1, key: 1 }, { unique: true });
export const IdempotencyRecord = mongoose.model('IdempotencyRecord', s);
