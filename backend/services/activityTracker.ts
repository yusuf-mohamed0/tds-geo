// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Kivo Activity Tracker
// Records exactly who did what, when, and where —
// across web, Shopify, API, workers, connectors,
// and system processes. Feeds the Sentinel
// auto-fix engine from a single activity_events table.
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export type ActivitySurface = 'web' | 'shopify' | 'api' | 'worker' | 'connector' | 'system';
export type ActivityActorType = 'user' | 'client' | 'connector' | 'shopify' | 'anonymous' | 'system';

export interface ActivityEvent {
  surface: ActivitySurface;
  actorType: ActivityActorType;
  actorId?: string | null;
  clientId?: string | null;
  action: string;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  success?: boolean;
  durationMs?: number | null;
  shop?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

const ACTIVITY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surface TEXT NOT NULL DEFAULT 'web',
  actor_type TEXT NOT NULL DEFAULT 'anonymous',
  actor_id TEXT,
  client_id TEXT,
  action TEXT NOT NULL,
  route TEXT,
  method TEXT,
  status_code INT,
  success BOOLEAN NOT NULL DEFAULT true,
  duration_ms INT,
  shop TEXT,
  ip TEXT,
  user_agent TEXT,
  error_type TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_activity_events_occurred ON activity_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_client ON activity_events (client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_action ON activity_events (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_surface ON activity_events (surface, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_success ON activity_events (success, occurred_at DESC);
`;

// ════════════════════════════════════════════════
// Route → semantic action classifier
// ════════════════════════════════════════════════

function stripRoutingTokens(segments: string[]): string[] {
  return segments
    .map(s => (s.startsWith(':') ? ':id' : s))
    .filter(s => s !== '' && s !== 'api');
}

export function classifyAction(method: string, path: string): string {
  const base = path.split('?')[0];
  const segments = stripRoutingTokens(base.split('/'));
  if (segments.length === 0) return 'root.health';

  if (segments[0] === 'health') return 'system.health';
  if (segments[0] === 'metrics') return 'system.metrics';
  if (segments[0] === 'docs') return 'system.docs';
  if (segments[0] === 'assets') return 'system.assets';
  if (segments[0] === 'csrf') return 'security.csrf';

  const resource = segments[0];
  const verb = method.toUpperCase();
  const label = (verb === 'GET' && segments.length === 1) ? 'list'
    : verb === 'GET' ? 'view'
    : verb === 'POST' ? 'create'
    : verb === 'PUT' || verb === 'PATCH' ? 'update'
    : verb === 'DELETE' ? 'delete'
    : 'action';

  return `${resource}.${label === 'create' && segments.length > 1 ? 'action' : label}`;
}

class ActivityTrackerService {
  private pool: Pool | null = null;
  private schemaInitialized = false;
  private schemaReady: Promise<void> | null = null;

  initialize(pool: Pool): Promise<void> {
    this.pool = pool;
    return this.ensureSchemaReady();
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('ActivityTrackerService not initialized');
    return this.pool;
  }

  private async ensureSchemaReady(): Promise<void> {
    if (this.schemaInitialized) return;
    if (!this.schemaReady) {
      this.schemaReady = this.getPool().query(ACTIVITY_SCHEMA_SQL)
        .then(() => {
          this.schemaInitialized = true;
          logger.info('Activity tracking storage ready');
        })
        .catch((err) => {
          this.schemaReady = null;
          throw err;
        });
    }
    await this.schemaReady;
  }

  async record(event: ActivityEvent): Promise<void> {
    try {
      await this.getPool().query(
        `INSERT INTO activity_events
         (surface, actor_type, actor_id, client_id, action, route, method, status_code, success,
          duration_ms, shop, ip, user_agent, error_type, error_message, metadata, occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          event.surface, event.actorType, event.actorId || null, event.clientId || null,
          event.action, event.route || null, event.method || null, event.statusCode || null,
          event.success !== false,
          event.durationMs || null, event.shop || null, event.ip || null, event.userAgent || null,
          event.errorType || null, event.errorMessage || null,
          JSON.stringify(event.metadata || {}), event.occurredAt || new Date()
        ]
      );
    } catch (err) {
      logger.warn('Failed to record activity event', { error: (err as Error).message, action: event.action });
    }
  }

  // ── Batch insert (used by telemetry endpoint) ──
  async recordBatch(events: ActivityEvent[], fallbackMeta?: { ip?: string | null; userAgent?: string | null }): Promise<void> {
    if (!events || events.length === 0) return;
    try {
      await this.getPool().query('BEGIN');
      try {
        for (const ev of events) {
          await this.getPool().query(
            `INSERT INTO activity_events
             (surface, actor_type, actor_id, client_id, action, route, method, status_code, success,
              duration_ms, shop, ip, user_agent, error_type, error_message, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [
              ev.surface, ev.actorType, ev.actorId || null, ev.clientId || null,
              ev.action, ev.route || null, ev.method || null, ev.statusCode || null,
              ev.success !== false,
              ev.durationMs || null, ev.shop || null,
              ev.ip || fallbackMeta?.ip || null, ev.userAgent || fallbackMeta?.userAgent || null,
              ev.errorType || null, ev.errorMessage || null, JSON.stringify(ev.metadata || {})
            ]
          );
        }
        await this.getPool().query('COMMIT');
      } catch (err) {
        await this.getPool().query('ROLLBACK');
        throw err;
      }
    } catch (err) {
      logger.warn('Failed to record activity batch', { error: (err as Error).message, count: events.length });
    }
  }

  // ── Feed / analytics queries ──
  async getFeed(options: {
    limit?: number;
    surface?: string;
    actorType?: string;
    actorId?: string;
    clientId?: string;
    success?: boolean;
    since?: string;
    action?: string;
  } = {}): Promise<ActivityEvent[]> {
    const limit = Math.min(Math.max(options.limit || 50, 1), 200);
    const conditions: string[] = [];
    const params: any[] = [];

    const add = (clause: string, value: unknown) => {
      params.push(value);
      conditions.push(`${clause} = $${params.length}`);
    };

    if (options.surface) add('surface', options.surface);
    if (options.actorType) add('actor_type', options.actorType);
    if (options.actorId) add('actor_id', options.actorId);
    if (options.clientId) add('client_id', options.clientId);
    if (options.action) add('action', options.action);
    if (options.success !== undefined) add('success', options.success);
    if (options.since) {
      params.push(options.since);
      conditions.push(`occurred_at >= NOW() - $${params.length}::interval`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.getPool().query(
      `SELECT id, surface, actor_type, actor_id, client_id, action, route, method, status_code,
              success, duration_ms, shop, ip, user_agent, error_type, error_message, metadata, occurred_at
       FROM activity_events ${where} ORDER BY occurred_at DESC LIMIT ${limit}`,
      params
    );
    return result.rows.map(r => this.mapRow(r));
  }

  private mapRow(r: any): ActivityEvent {
    return {
      surface: r.surface,
      actorType: r.actor_type,
      actorId: r.actor_id,
      clientId: r.client_id,
      action: r.action,
      route: r.route,
      method: r.method,
      statusCode: r.status_code,
      success: r.success,
      durationMs: r.duration_ms,
      shop: r.shop,
      ip: r.ip,
      userAgent: r.user_agent,
      errorType: r.error_type,
      errorMessage: r.error_message,
      metadata: r.metadata || {},
      occurredAt: r.occurred_at
    };
  }

  async getSummary(since: string = '24 hours'): Promise<Record<string, number>> {
    const result = await this.getPool().query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE success = false)::int AS errors,
         COUNT(*) FILTER (WHERE surface = 'web')::int AS web,
         COUNT(*) FILTER (WHERE surface = 'shopify')::int AS shopify,
         COUNT(*) FILTER (WHERE surface = 'api')::int AS api,
         COUNT(*) FILTER (WHERE surface = 'worker')::int AS worker,
         COUNT(*) FILTER (WHERE surface = 'connector')::int AS connector,
         COUNT(*) FILTER (WHERE surface = 'system')::int AS system,
         COUNT(DISTINCT actor_id)::int AS unique_actors,
         COUNT(DISTINCT client_id)::int AS unique_clients,
         ROUND(AVG(duration_ms)::numeric, 1)::float AS avg_duration_ms
       FROM activity_events WHERE occurred_at >= NOW() - $1::interval`,
      [since]
    );
    return result.rows[0] || {};
  }

  async getTopActions(since: string = '24 hours', limit: number = 10): Promise<Array<{ action: string; count: number; errors: number }>> {
    const result = await this.getPool().query(
      `SELECT action, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE success = false)::int AS errors
       FROM activity_events WHERE occurred_at >= NOW() - $1::interval
       GROUP BY action ORDER BY count DESC LIMIT $2`,
      [since, Math.min(Math.max(limit, 1), 50)]
    );
    return result.rows;
  }

  async getRecentErrors(options: { since?: string; limit?: number; surface?: string } = {}): Promise<ActivityEvent[]> {
    return this.getFeed({
      success: false,
      since: options.since || '10 minutes',
      limit: options.limit || 100,
      surface: options.surface
    });
  }
}

export default new ActivityTrackerService();