import mongoose from 'mongoose';
import { logger } from './logger.js';
export async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('mongodb connected');
}
export async function disconnectDb() { await mongoose.disconnect(); }
export const isReplicaSet = () => {
  // Best-effort detection: memory replset / Atlas report a setName on the topology.
  try { const t = mongoose.connection?.client?.topology; return Boolean(t?.s?.options?.replicaSet || t?.description?.setName); } catch { return false; }
};
