// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Kivo Sentinel Auto-Fix Engine
// Periodically scans failure activity, classifies
// the error, and applies the SAFEST recoverable
// fix automatically. Anything risky (config,
// credentials, DB, auth, payments) becomes a
// pending recommendation requiring approval.
// Every action is recorded in auto_fix_runs.
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import activityTracker, { ActivityEvent } from './activityTracker';
import { checkRedisHealth } from '../utils/redisHealth';

export type FixSeverity = 'info' | 'warning' | 'critical';
export type FixCategory = 'retryable' | 'credential' | 'config' | 'dependency' | 'data' | 'code' | 'other';

export interface AutoFixRun {
  id: number;
  runAt: Date;
  source: string;
  surface?: string | null;
  action?: string | null;
  clientId?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  severity: FixSeverity;
  category: FixCategory;
  fixApplied?: string | null;
  fixSuccess: boolean;
  requiresApproval: boolean;
  approved: boolean;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  outcome?: string | null;
  evidence: Record<string, unknown>;
}

const AUTO_FIX_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS auto_fix_runs (
  id BIGSERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  surface TEXT,
  action TEXT,
  client_id TEXT,
  error_type TEXT,
  error_message TEXT,
  severity TEXT NOT NULL DEFAULT 'warning',
  category TEXT NOT NULL DEFAULT 'other',
  fix_applied TEXT,
  fix_success BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  outcome TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_auto_fix_runs_time ON auto_fix_runs (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_fix_runs_pending ON auto_fix_runs (approved, requires_approval, run_at DESC);
`;

// Pattern → (category, autoAction) mapping. AutoAction is executed when SAFE.
interface ErrorRule {
  category: FixCategory;
  severity: FixSeverity;
  safeFix?: 'redis-reconnect' | 'transient-retry' | 'noop';
  requiresApproval?: boolean;
}

const ERROR_RULES: Array<{ test: RegExp; rule: ErrorRule }> = [
  { test: /redis|ioredis|ECONNREFUSED|ETIMEDOUT|connect ETIMEDOUT/i, rule: { category: 'dependency', severity: 'warning', safeFix: 'redis-reconnect' } },
  { test: /redis eviction|out of memory|OOM/i, rule: { category: 'dependency', severity: 'warning', safeFix: 'noop', requiresApproval: true } },
  { test: /database .*failed|migration .*failed|ERSTARTERROR|42P01|relation .* does not exist/i, rule: { category: 'data', severity: 'critical', safeFix: 'noop', requiresApproval: true } },
  { test: /ECONRESET|ECONNRESET|socket hung up|socket closed|timeout|Timed out/i, rule: { category: 'retryable', severity: 'warning', safeFix: 'transient-retry' } },
  { test: /credential|oauth.*invalid|token.*expired|401.*invalid|DataForSEO|API key/i, rule: { category: 'credential', severity: 'warning', safeFix: 'noop', requiresApproval: true } },
  { test: /4\d\d|Unauthorized|Forbidden|CSRF/i, rule: { category: 'config', severity: 'info', safeFix: 'noop' } },
];

function classifyError(message: string, action: string): ErrorRule {
  for (const { test, rule } of ERROR_RULES) {
    if (test.test(message) || test.test(action)) return rule;
  }
  return { category: 'other', severity: 'warning', safeFix: 'noop' };
}

class AutoFixService {
  private pool: Pool | null = null;
  private schemaInitialized = false;
  private schemaReady: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private scanIntervalMs = parseInt(process.env.AUTOFIX_SCAN_INTERVAL_MS || '120000', 10);
  private scanWindow = process.env.AUTOFIX_SCAN_WINDOW || '5 minutes';
  private running = false;

  initialize(pool: Pool): Promise<void> {
    this.pool = pool;
    return this.ensureSchemaReady();
  }

  start(intervalMs?: number): void {
    if (intervalMs) this.scanIntervalMs = intervalMs;
    this.stop();
    this.timer = setInterval(() => this.scan(), this.scanIntervalMs);
    this.timer.unref();
    logger.info('Sentinel auto-fix engine started', { scanIntervalMs: this.scanIntervalMs });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('AutoFixService not initialized');
    return this.pool;
  }

  private async ensureSchemaReady(): Promise<void> {
    if (this.schemaInitialized) return;
    if (!this.schemaReady) {
      this.schemaReady = this.getPool().query(AUTO_FIX_SCHEMA_SQL)
        .then(() => {
          this.schemaInitialized = true;
          logger.info('Auto-fix storage ready');
        })
        .catch((err) => {
          this.schemaReady = null;
          throw err;
        });
    }
    await this.schemaReady;
  }

  // ════════════════════════════════════════════
  // CORE SCAN
  // ════════════════════════════════════════════

  async scan(): Promise<{ scanned: number; fixed: number; pending: number }> {
    if (this.running) return { scanned: 0, fixed: 0, pending: 0 };
    if (!this.pool) return { scanned: 0, fixed: 0, pending: 0 };
    this.running = true;
    let scanned = 0, fixed = 0, pending = 0;
    try {
      await this.ensureSchemaReady();
      const errors = await activityTracker.getRecentErrors({ since: this.scanWindow, limit: 100 });
      scanned = errors.length;

      // De-duplicate by signature so one burst = one fix decision
      const buckets = new Map<string, ActivityEvent[]>();
      for (const ev of errors) {
        const sig = [ev.action, ev.errorType || 'unknown'].join('|');
        if (!buckets.has(sig)) buckets.set(sig, []);
        buckets.get(sig)!.push(ev);
      }

      for (const [, bucket] of buckets) {
        const sample = bucket[0];
        const msg = sample.errorMessage || '';
        const rule = classifyError(msg, sample.action || '');
        const status = await this.applyRule(sample, rule);
        if (status === 'fixed') fixed++;
        if (status === 'pending') pending++;
      }

      logger.info('Sentinel auto-fix scan complete', { scanned, fixed, pending, window: this.scanWindow });
    } catch (err) {
      logger.error('Sentinel auto-fix scan failed', { error: (err as Error).message });
    } finally {
      this.running = false;
    }
    return { scanned, fixed, pending };
  }

  private async applyRule(event: ActivityEvent, rule: ErrorRule): Promise<'fixed' | 'pending' | 'handled'> {
    const msg = event.errorMessage || '';
    const evidence: Record<string, unknown> = { capturedAt: new Date().toISOString(), eventAction: event.action, eventRoute: event.route };

    // ── Safe automatic fixes ──
    if (rule.safeFix === 'redis-reconnect') {
      const health = await checkRedisHealth();
      evidence.redisHealth = health;
      if (health !== 'healthy') {
        try {
          const { closeRedis } = await import('../utils/redisHealth');
          await closeRedis();
          const after = await checkRedisHealth();
          evidence.reconnectedAfter = after;
          const ok = after === 'healthy';
          await this.recordRun(event, rule, `Redis restart cycle attempted (${health} → ${after})`, ok, false, evidence);
          return 'fixed';
        } catch (err) {
          await this.recordRun(event, rule, `Redis reconnect failed: ${(err as Error).message}`, false, false, evidence);
          return 'handled';
        }
      }
      await this.recordRun(event, rule, 'Redis reported healthy — no action needed', true, false, evidence);
      return 'fixed';
    }

    if (rule.safeFix === 'transient-retry') {
      await this.recordRun(event, rule, 'Transient failure detected — backend auto-retry paths already active; monitored', true, false, evidence);
      return 'fixed';
    }

    if (rule.safeFix === 'noop') {
      // No safe auto-recovery; record event so it feeds the incident report.
      if (!rule.requiresApproval) {
        await this.recordRun(event, rule, 'Classified — no safe automatic action; logged for observation', true, false, evidence);
        return 'handled';
      }
    }

    // ── Risky → pending approval (dedupe within window) ──
    const existing = await this.getPool().query(
      `SELECT id FROM auto_fix_runs
       WHERE approved = false AND requires_approval = true
         AND error_type = $1 AND action = $2
         AND run_at >= NOW() - INTERVAL '12 hours'
       LIMIT 1`,
      [event.errorType || 'unknown', event.action || 'unknown']
    );
    if (existing.rows.length > 0) return 'handled';

    await this.recordRun(event, rule, null, false, true, evidence);
    return 'pending';
  }

  private async recordRun(event: ActivityEvent, rule: ErrorRule, fixApplied: string | null, fixSuccess: boolean, requiresApproval: boolean, evidence: Record<string, unknown>): Promise<void> {
    try {
      await this.getPool().query(
        `INSERT INTO auto_fix_runs
         (source, surface, action, client_id, error_type, error_message, severity, category, fix_applied, fix_success, requires_approval, outcome, evidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          'autofix-scan', event.surface, event.action || null, event.clientId || null,
          event.errorType || null, event.errorMessage?.slice(0, 4000) || null,
          rule.severity, rule.category, fixApplied, fixSuccess, requiresApproval,
          fixApplied ? 'auto-handled' : 'awaiting approval',
          JSON.stringify(evidence)
        ]
      );
      if (fixApplied) {
        logger.info(`[AUTOFIX] ${event.action || 'unknown'} → ${fixApplied}`, { severity: rule.severity, fixSuccess });
      }
    } catch (err) {
      logger.error('Failed to record auto-fix run', { error: (err as Error).message });
    }
  }

  // ════════════════════════════════════════════
  // QUERIES
  // ════════════════════════════════════════════

  async getRecentRuns(limit: number = 50): Promise<AutoFixRun[]> {
    const result = await this.getPool().query(
      `SELECT * FROM auto_fix_runs ORDER BY run_at DESC LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)]
    );
    return result.rows.map(this.mapRun);
  }

  async getPendingApprovals(): Promise<AutoFixRun[]> {
    const result = await this.getPool().query(
      'SELECT * FROM auto_fix_runs WHERE requires_approval = true AND approved = false ORDER BY run_at DESC LIMIT 200'
    );
    return result.rows.map(this.mapRun);
  }

  async getSummary(): Promise<{ total: number; fixed: number; pending: number; failed: number }> {
    const result = await this.getPool().query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE fix_success = true)::int AS fixed,
         COUNT(*) FILTER (WHERE requires_approval = true AND approved = false)::int AS pending,
         COUNT(*) FILTER (WHERE fix_success = false)::int AS failed
       FROM auto_fix_runs WHERE run_at >= NOW() - INTERVAL '24 hours'`
    );
    return result.rows[0] || { total: 0, fixed: 0, pending: 0, failed: 0 };
  }

  async approve(id: number, approvedBy?: string | null): Promise<boolean> {
    const result = await this.getPool().query(
      `UPDATE auto_fix_runs SET approved = true, approved_by = $2, approved_at = NOW(), outcome = 'approved for action'
       WHERE id = $1 AND requires_approval = true AND approved = false`,
      [id, approvedBy || null]
    );
    if ((result.rowCount || 0) > 0) {
      logger.info('[AUTOFIX] Recommendation approved', { id, approvedBy });
      return true;
    }
    return false;
  }

  async resolve(id: number, outcome: string, success: boolean): Promise<boolean> {
    const result = await this.getPool().query(
      `UPDATE auto_fix_runs SET outcome = $2, fix_success = $3, approved = true, approved_at = NOW()
       WHERE id = $1`,
      [id, outcome, success]
    );
    return (result.rowCount || 0) > 0;
  }

  private mapRun(r: any): AutoFixRun {
    return {
      id: r.id,
      runAt: r.run_at,
      source: r.source,
      surface: r.surface,
      action: r.action,
      clientId: r.client_id,
      errorType: r.error_type,
      errorMessage: r.error_message,
      severity: r.severity,
      category: r.category,
      fixApplied: r.fix_applied,
      fixSuccess: r.fix_success,
      requiresApproval: r.requires_approval,
      approved: r.approved,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      outcome: r.outcome,
      evidence: r.evidence || {}
    };
  }

  async close(): Promise<void> {
    this.stop();
  }
}

export default new AutoFixService();