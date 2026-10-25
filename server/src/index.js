import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env, assertEnv } from './config/env.js';
import { bootstrap } from './services/bootstrap.js';
import { logger } from './config/logger.js';
assertEnv();
connectDb().then(async () => { await bootstrap(); createApp().listen(env.port, () => logger.info(`nakugaon server listening on ${env.port}`)); }).catch((e) => { logger.error('startup failed', { error: e.message }); process.exit(1); });
