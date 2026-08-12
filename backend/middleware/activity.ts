// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Kivo HTTP Request Activity Middleware
// Records WHO did WHAT, WHEN, and whether it
// failed — for every API request. Runs after the
// request-logging middleware; resolves the actor
// from the authenticated JWT (or API key) on
// response finish, so route-level auth applies.
// ──────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import activityTracker, { classifyAction } from '../services/activityTracker';

// Paths we never record (health churn, static, telemetry self-feed)
const SKIP_PREFIXES = [
  '/health',
  '/metrics',
  '/api/telemetry',
  '/assets/',
  '/docs',
  '/swagger',
  '/favicon',
  '/api/csrf/token',
];

const STATIC_SUFFIXES = ['.js', '.css', '.png', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.map', '.jpg', '.jpeg', '.gif'];

function shouldSkip(path: string, surface: string): boolean {
  if (surface === 'web') return false;
  for (const p of SKIP_PREFIXES) {
    if (path.startsWith(p)) return true;
  }
  const base = path.split('?')[0];
  for (const s of STATIC_SUFFIXES) {
    if (base.endsWith(s)) return true;
  }
  return false;
}

export function activityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const rawPath = req.originalUrl || req.url || '';
  const base = rawPath.split('?')[0];
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const userAgent = (req.headers['user-agent'] as string) || null;

  // Determine surface from route prefix
  const surface = base.startsWith('/api/embedded') ? 'shopify'
    : base.startsWith('/api/connector') || req.headers['x-api-key'] ? 'connector'
    : base.startsWith('/api/') ? 'web'
    : 'web';

  if (shouldSkip(base, surface)) {
    next();
    return;
  }

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const user = (req as any).user;
    const client = (req as any).client;

    const actorType = user?.role === 'connector' ? 'connector' as const
      : user ? 'user' as const
      : 'anonymous' as const;

    // Anonymize query strings; never store tokens or credentials
    const route = base;

    activityTracker.record({
      surface,
      actorType,
      actorId: user?.userId || (surface === 'connector' ? 'connector' : null),
      clientId: user?.clientId || client?.id || null,
      action: classifyAction(req.method, base),
      route,
      method: req.method,
      statusCode,
      success: statusCode < 400,
      durationMs,
      ip,
      userAgent,
      errorType: statusCode >= 500 ? `http_${statusCode}` : null,
      errorMessage: statusCode >= 500 ? `HTTP ${statusCode} on ${req.method} ${route}` : null,
      metadata: { embedded: false }
    }).catch(() => {});
  });

  next();
}