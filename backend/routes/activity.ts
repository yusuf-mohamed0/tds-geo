// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Kivo Activity & Auto-Fix Routes
//  - POST /api/telemetry            (browser beacon, low-risk ingest)
//  - GET  /api/observability/activity            (admin feed)
//  - GET  /api/observability/activity/summary    (admin totals)
//  - GET  /api/observability/activity/top-actions
//  - GET/POST /api/observability/autofix/*       (admin)
// ──────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import activityTracker, { ActivityEvent, ActivitySurface, ActivityActorType } from '../services/activityTracker';
import autoFixService from '../services/autoFixService';
import { logger } from '../utils/logger';
import { redactJson } from '../utils/redact';

const TELEMETRY_RATE_WINDOW = 60_000;
const TELEMETRY_RATE_MAX = 60;
const telemetryHits = new Map<string, { count: number; windowStart: number }>();

function telemetryAllowed(ip: string): boolean {
  const now = Date.now();
  const hit = telemetryHits.get(ip);
  if (!hit || now - hit.windowStart > TELEMETRY_RATE_WINDOW) {
    telemetryHits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  hit.count += 1;
  return hit.count <= TELEMETRY_RATE_MAX;
}

const SURFACES: ActivitySurface[] = ['web', 'shopify', 'api', 'worker', 'connector', 'system'];
const ACTOR_TYPES: ActivityActorType[] = ['user', 'client', 'connector', 'shopify', 'anonymous', 'system'];

function cleanEvent(raw: any): ActivityEvent | null {
  if (!raw || typeof raw !== 'object' || typeof raw.action !== 'string') return null;
  if (!raw.action || raw.action.length > 200) return null;

  const surface: ActivitySurface = SURFACES.includes(raw.surface) ? raw.surface : 'web';
  const actorType: ActivityActorType = ACTOR_TYPES.includes(raw.actorType) ? raw.actorType : 'anonymous';
  const success = raw.success === false ? false : true;

  return {
    surface,
    actorType,
    actorId: typeof raw.actorId === 'string' ? raw.actorId.slice(0, 200) : null,
    clientId: typeof raw.clientId === 'string' ? raw.clientId.slice(0, 100) : null,
    action: raw.action.slice(0, 200),
    route: typeof raw.route === 'string' ? raw.route.slice(0, 500) : null,
    method: typeof raw.method === 'string' ? raw.method.slice(0, 10) : null,
    statusCode: typeof raw.statusCode === 'number' ? raw.statusCode : null,
    success,
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : null,
    shop: typeof raw.shop === 'string' ? raw.shop.slice(0, 255) : null,
    ip: typeof raw.ip === 'string' ? raw.ip.slice(0, 64) : null,
    userAgent: typeof raw.userAgent === 'string' ? raw.userAgent.slice(0, 500) : null,
    errorType: typeof raw.errorType === 'string' ? raw.errorType.slice(0, 200) : null,
    errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage.slice(0, 4000) : null,
    metadata: redactJson(raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}) as Record<string, unknown>
  };
}

export function createActivityRoutes(pool: Pool): Router {
  const router = Router();

  // ════════════════════════════════════════════
  // TELEMETRY (no auth — low-risk, strictly validated ingest)
  // Accepts { events: [...] } or a single event object.
  // ════════════════════════════════════════════
  router.post('/telemetry', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!telemetryAllowed(ip)) {
      res.status(429).json({ error: 'Telemetry rate limit exceeded' });
      return;
    }

    try {
      const body = req.body;
      const rawEvents = Array.isArray(body) ? body : body?.events;
      const events: ActivityEvent[] = [];
      if (Array.isArray(rawEvents)) {
        for (const raw of rawEvents.slice(0, 100)) {
          const ev = cleanEvent(raw);
          if (ev) {
            ev.ip = ev.ip || ip;
            ev.userAgent = ev.userAgent || (req.headers['user-agent'] as string) || null;
            events.push(ev);
          }
        }
      } else {
        const ev = cleanEvent(body);
        if (ev) {
          ev.ip = ev.ip || ip;
          ev.userAgent = ev.userAgent || (req.headers['user-agent'] as string) || null;
          events.push(ev);
        }
      }

      if (events.length > 0) {
        await activityTracker.recordBatch(events);
      }
      res.json({ ok: true, recorded: events.length });
    } catch (err) {
      logger.warn('Telemetry ingest failed', { error: (err as Error).message });
      res.status(500).json({ error: 'Telemetry ingest failed' });
    }
  });

  // ════════════════════════════════════════════
  // ACTIVITY FEED (admin)
  // ════════════════════════════════════════════
  router.get('/activity', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const events = await activityTracker.getFeed({
        limit: parseInt(req.query.limit as string) || 50,
        surface: req.query.surface as string | undefined,
        actorType: req.query.actorType as string | undefined,
        actorId: req.query.actorId as string | undefined,
        clientId: req.query.clientId as string | undefined,
        action: req.query.action as string | undefined,
        success: req.query.success === undefined ? undefined : req.query.success === 'true',
        since: req.query.since as string | undefined
      });
      res.json({ success: true, data: events });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/activity/summary', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
      const summary = await activityTracker.getSummary(_req.query.since as string || '24 hours');
      res.json({ success: true, data: summary });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/activity/top-actions', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const actions = await activityTracker.getTopActions(req.query.since as string || '24 hours', parseInt(req.query.limit as string) || 10);
      res.json({ success: true, data: actions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ════════════════════════════════════════════
  // AUTO-FIX (admin)
  // ════════════════════════════════════════════
  router.get('/autofix/runs', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const runs = await autoFixService.getRecentRuns(parseInt(req.query.limit as string) || 50);
      res.json({ success: true, data: runs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/autofix/pending', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
      const pending = await autoFixService.getPendingApprovals();
      res.json({ success: true, data: pending });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/autofix/summary', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
      const summary = await autoFixService.getSummary();
      res.json({ success: true, data: summary });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/autofix/scan', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
      const result = await autoFixService.scan();
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/autofix/:id/approve', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const ok = await autoFixService.approve(id, user?.userId || user?.email || null);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/autofix/:id/resolve', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await autoFixService.resolve(id, String(req.body?.outcome || 'resolved'), req.body?.success !== false);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}