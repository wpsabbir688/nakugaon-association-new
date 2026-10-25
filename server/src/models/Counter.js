import mongoose from 'mongoose';
const s = new mongoose.Schema({ key: { type: String, required: true, unique: true }, seq: { type: Number, default: 0 } }, { timestamps: true });
export const Counter = mongoose.model('Counter', s);
