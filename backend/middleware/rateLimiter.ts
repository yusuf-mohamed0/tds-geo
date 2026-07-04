// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ClientBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, ClientBucket>();

const CLEANUP_INTERVAL = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export interface ClientRateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  name?: string;
}

function getClientId(req: Request): string | null {
  const user = (req as any).user;
  if (user?.clientId) return `client:${user.clientId}`;
  if (user?.userId) return `user:${user.userId}`;
  if (user?.id) return `user:${user.id}`;
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) return `apikey:${apiKey.slice(0, 8)}`;
  return req.ip || 'unknown';
}

export function clientRateLimit(options: ClientRateLimitOptions) {
  const name = options.name || 'client';
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    if (!clientId) {
      next();
      return;
    }

    const key = `${name}:${clientId}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;

    const remaining = Math.max(0, options.max - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (bucket.count > options.max) {
      logger.warn('Client rate limit exceeded', {
        clientId,
        limit: options.max,
        windowMs: options.windowMs,
        path: req.originalUrl,
      });
      res.status(429).json({
        error: options.message || 'Too many requests. Please slow down.',
        retryAfter: resetSeconds,
      });
      return;
    }

    next();
  };
}
