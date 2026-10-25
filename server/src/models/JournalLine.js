import mongoose from 'mongoose';
const s = new mongoose.Schema({
  journal: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', required: true },
  account: { type: String, required: true }, // account code, e.g. 1100
  debit: { type: Number, default: 0, validate: Number.isInteger },
  credit: { type: Number, default: 0, validate: Number.isInteger },
}, { timestamps: true });
s.index({ journal: 1 }); s.index({ account: 1 });
export const JournalLine = mongoose.model('JournalLine', s);
