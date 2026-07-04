// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from './logger';

let redisClient: any = null;

export async function checkRedisHealth(): Promise<string> {
  if (!process.env.REDIS_URL) {
    return 'not_configured';
  }

  try {
    if (!redisClient) {
      const Redis = require('ioredis');
      redisClient = new Redis(process.env.REDIS_URL, {
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
      });
    }

    const ping = await redisClient.ping();
    return ping === 'PONG' ? 'healthy' : 'unhealthy';
  } catch {
    return 'unhealthy';
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      logger.warn('Redis close error', { error: (err as Error).message });
    }
    redisClient = null;
  }
}
