// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Log Repository
// ──────────────────────────────────────────────

import { Pool } from 'pg';

export interface LogEntry {
  clientId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  level?: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowLogEntry {
  clientId: string;
  articleId?: string;
  workflowType: string;
  stage?: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  tokenUsage?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export function createLogRepo(pool: Pool) {
  async function logActivity(entry: LogEntry): Promise<string> {
    try {
      const result = await pool.query(
        `INSERT INTO activity_logs (client_id, action, entity_type, entity_id, level, message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          entry.clientId, entry.action, entry.entityType || null,
          entry.entityId || null, entry.level || 'info',
          entry.message, JSON.stringify(entry.metadata || {})
        ]
      );
      return result.rows[0].id;
    } catch (err) {
      // Don't throw on log failure — logging should never break the app
      return '';
    }
  }

  async function startWorkflow(entry: WorkflowLogEntry): Promise<string> {
    const result = await pool.query(
      `INSERT INTO workflow_logs (client_id, article_id, workflow_type, stage, status, started_at)
       VALUES ($1, $2, $3, $4, 'running', NOW()) RETURNING id`,
      [entry.clientId, entry.articleId || null, entry.workflowType, entry.stage || null]
    );
    return result.rows[0].id;
  }

  async function completeWorkflow(id: string, entry: Partial<WorkflowLogEntry>): Promise<void> {
    await pool.query(
      `UPDATE workflow_logs SET status = $1, completed_at = NOW(),
       duration_ms = $2, token_usage = $3, metrics = $4,
       error_message = $5, metadata = $6
       WHERE id = $7`,
      [
        entry.status || 'completed', entry.durationMs || 0,
        JSON.stringify(entry.tokenUsage || {}), JSON.stringify(entry.metrics || {}),
        entry.errorMessage || null, JSON.stringify(entry.metadata || {}),
        id
      ]
    );
  }

  async function getRecentWorkflows(clientId: string, limit = 20): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM workflow_logs
       WHERE client_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [clientId, limit]
    );
    return result.rows;
  }

  async function getRecentActivity(clientId: string, options: {
    level?: string;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ rows: any[]; total: number }> {
    const { level, action, limit = 50, offset = 0 } = options;
    const params: any[] = [clientId];
    const conditions = ['client_id = $1'];

    if (level) {
      params.push(level);
      conditions.push(`level = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const countResult = await pool.query(`SELECT COUNT(*) FROM activity_logs WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM activity_logs WHERE ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { rows: result.rows, total };
  }

  async function getSystemErrors(limit = 50, offset = 0): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM activity_logs
       WHERE level = 'error'
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  return { logActivity, startWorkflow, completeWorkflow, getRecentWorkflows, getRecentActivity, getSystemErrors };
}

export type LogRepo = ReturnType<typeof createLogRepo>;
