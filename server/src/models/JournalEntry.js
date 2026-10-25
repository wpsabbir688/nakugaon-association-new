import mongoose from 'mongoose';
const s = new mongoose.Schema({
  memo: { type: String, default: '' },
  sourceType: { type: String, required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
  status: { type: String, enum: ['posted', 'reversed'], default: 'posted' },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  postedAt: { type: Date, default: Date.now },
}, { timestamps: true });
s.index({ sourceType: 1, sourceId: 1 }); s.index({ postedAt: -1 });
export const JournalEntry = mongoose.model('JournalEntry', s);
