import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface CsrfToken {
  token: string;
  expiresAt: number;
}

const tokens = new Map<string, CsrfToken>();
const TOKEN_TTL = 3600_000; // 1 hour
const CLEANUP_INTERVAL = 300_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, t] of tokens) {
    if (t.expiresAt <= now) tokens.delete(key);
  }
}, CLEANUP_INTERVAL);

function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(`${sessionId}:${token}`, { token, expiresAt: Date.now() + TOKEN_TTL });
  return token;
}

function validateCsrfToken(sessionId: string, token: string): boolean {
  const key = `${sessionId}:${token}`;
  const stored = tokens.get(key);
  if (!stored) return false;
  if (stored.expiresAt <= Date.now()) {
    tokens.delete(key);
    return false;
  }
  tokens.delete(key);
  return true;
}

function getCsrfSessionId(req: Request): string {
  // csrfProtection runs before route-level authentication, so use the same
  // request-scoped key when issuing and validating browser CSRF tokens.
  return req.ip || 'unknown';
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Skip for auth routes (no session yet — login/register are pre-auth)
  if (req.originalUrl.startsWith('/api/auth/')) {
    next();
    return;
  }

  // Skip for embedded app routes (Shopify session token auth)
  if (req.originalUrl.startsWith('/api/embedded/')) {
    next();
    return;
  }

  // Low-risk browser beacon endpoint. Payload is strictly validated by the
  // activity route and only appends telemetry rows.
  if (req.originalUrl.startsWith('/api/telemetry')) {
    next();
    return;
  }

  const sessionId = getCsrfSessionId(req);
  const token = req.headers['x-csrf-token'] as string;

  if (!token) {
    logger.warn('CSRF token missing', {
      method: req.method,
      path: req.originalUrl,
      sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 8) : 'unknown',
    });
    res.status(403).json({ error: 'Missing CSRF token. Set X-CSRF-Token header.' });
    return;
  }

  if (!validateCsrfToken(String(sessionId), token)) {
    logger.warn('CSRF token invalid', {
      method: req.method,
      path: req.originalUrl,
    });
    res.status(403).json({ error: 'Invalid or expired CSRF token.' });
    return;
  }

  next();
}

export function csrfTokenHandler(req: Request, res: Response): void {
  const sessionId = getCsrfSessionId(req);
  const token = generateCsrfToken(String(sessionId));
  res.json({ csrfToken: token, expiresIn: TOKEN_TTL / 1000 });
}
