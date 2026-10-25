import { SiteSetting } from '../models/SiteSetting.js';
export async function getSettings(session = null) {
  let s = await SiteSetting.findOne({ key: 'site' }, null, session ? { session } : {});
  if (!s) { const docs = await SiteSetting.create([{ key: 'site' }], session ? { session } : {}); s = docs[0]; }
  return s;
}
