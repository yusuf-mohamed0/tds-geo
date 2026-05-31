// ══════════════════════════════════════════════════════════════════
// Enterprise Security Service
// RBAC, audit logging, rate limiting, secret rotation,
// tenant isolation, permission management
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { AuditLogEntry, PermissionEntry, RateLimitConfig, UserRole } from '../types';

interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

class EnterpriseSecurityService {
  private pool: Pool | null = null;
  private rateLimitBuckets: Map<string, { count: number; windowStart: number }> = new Map();

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Enterprise Security Service initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // AUDIT LOGGING
  // ══════════════════════════════════════════════════════════════

  async logAudit(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO audit_log (client_id, user_id, session_id, action, resource_type, resource_id, details, ip_address, user_agent, severity, outcome)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          entry.client_id || null,
          entry.user_id || null,
          entry.session_id || null,
          entry.action,
          entry.resource_type || null,
          entry.resource_id || null,
          JSON.stringify(entry.details || {}),
          entry.ip_address || null,
          entry.user_agent || null,
          entry.severity || 'info',
          entry.outcome || 'success'
        ]
      );
    } catch (err) {
      logger.error('Audit log write failed', { action: entry.action, error: (err as Error).message });
    }
  }

  async getAuditLog(options: {
    clientId?: string;
    userId?: string;
    action?: string;
    resourceType?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ entries: AuditLogEntry[]; total: number }> {
    if (!this.pool) return { entries: [], total: 0 };

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (options.clientId) {
      conditions.push(`client_id = $${paramIndex++}`);
      params.push(options.clientId);
    }
    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }
    if (options.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(options.action);
    }
    if (options.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(options.resourceType);
    }
    if (options.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(options.severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM audit_log ${whereClause}`, params
    );

    params.push(limit);
    params.push(offset);

    const result = await this.pool.query(
      `SELECT * FROM audit_log ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      entries: result.rows,
      total: parseInt(countResult.rows[0]?.total || '0')
    };
  }

  // ══════════════════════════════════════════════════════════════
  // RBAC PERMISSION MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async checkPermission(role: UserRole, resource: string, action: string): Promise<boolean> {
    if (!this.pool) return true; // Allow if no DB

    // Super admin has full access
    if (role === 'super_admin') return true;

    try {
      const result = await this.pool.query(
        `SELECT is_granted FROM permission_matrix
         WHERE role = $1 AND resource = $2 AND action = $3`,
        [role, resource, action]
      );

      if (result.rows.length === 0) {
        // Fallback: check wildcard permissions
        const wildcard = await this.pool.query(
          `SELECT is_granted FROM permission_matrix
           WHERE role = $1 AND (resource = '*' OR resource = $2) AND action = $3`,
          [role, resource, action]
        );
        return wildcard.rows.length > 0 && wildcard.rows[0].is_granted;
      }

      return result.rows[0].is_granted;
    } catch (err) {
      logger.warn('Permission check failed, allowing', { role, resource, action, error: (err as Error).message });
      return true;
    }
  }

  async setPermission(permission: Omit<PermissionEntry, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO permission_matrix (role, resource, action, is_granted)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (role, resource, action)
       DO UPDATE SET is_granted = $4`,
      [permission.role, permission.resource, permission.action, permission.is_granted]
    );
  }

  async getPermissions(role?: UserRole): Promise<PermissionEntry[]> {
    if (!this.pool) return [];
    if (role) {
      const result = await this.pool.query(
        'SELECT * FROM permission_matrix WHERE role = $1 ORDER BY resource, action',
        [role]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      'SELECT * FROM permission_matrix ORDER BY role, resource, action'
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // RATE LIMITING
  // ══════════════════════════════════════════════════════════════

  async checkRateLimit(clientId: string, endpoint: string): Promise<RateLimitCheck> {
    if (!this.pool) return { allowed: true, remaining: 100, resetAt: new Date(Date.now() + 60000) };

    const config = await this.pool.query(
      'SELECT * FROM rate_limit_config WHERE client_id = $1',
      [clientId]
    );

    if (config.rows.length === 0) {
      return { allowed: true, remaining: 60, resetAt: new Date(Date.now() + 60000) };
    }

    const cfg = config.rows[0];
    const bucketKey = `${clientId}:${endpoint}:minute`;
    const now = Date.now();

    // Sliding window rate limiting (in-memory for speed)
    const bucket = this.rateLimitBuckets.get(bucketKey);
    const requestsPerMin = parseInt(cfg.requests_per_minute) || 60;
    const burstLimit = parseInt(cfg.burst_limit) || 10;

    if (bucket && now - bucket.windowStart < 60000) {
      if (bucket.count >= requestsPerMin + burstLimit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(bucket.windowStart + 60000)
        };
      }
      bucket.count++;
    } else {
      this.rateLimitBuckets.set(bucketKey, { count: 1, windowStart: now });
    }

    const remaining = Math.max(0, requestsPerMin + burstLimit - (bucket?.count || 1));

    // Periodically clean up stale buckets
    if (this.rateLimitBuckets.size > 10000) {
      this.cleanupRateLimitBuckets();
    }

    return {
      allowed: true,
      remaining,
      resetAt: new Date((bucket?.windowStart || now) + 60000)
    };
  }

  private cleanupRateLimitBuckets(): void {
    const now = Date.now();
    for (const [key, bucket] of this.rateLimitBuckets.entries()) {
      if (now - bucket.windowStart > 120000) { // 2 minutes stale
        this.rateLimitBuckets.delete(key);
      }
    }
  }

  async getRateLimitConfig(clientId: string): Promise<RateLimitConfig | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM rate_limit_config WHERE client_id = $1',
      [clientId]
    );
    return result.rows[0] || null;
  }

  async setRateLimitConfig(config: Omit<RateLimitConfig, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO rate_limit_config (client_id, requests_per_minute, requests_per_hour, requests_per_day, burst_limit, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id)
       DO UPDATE SET requests_per_minute = $2, requests_per_hour = $3, requests_per_day = $4, burst_limit = $5, is_active = $6, updated_at = NOW()`,
      [config.client_id, config.requests_per_minute, config.requests_per_hour, config.requests_per_day, config.burst_limit, config.is_active]
    );
  }

  // ══════════════════════════════════════════════════════════════
  // SECRET ROTATION
  // ══════════════════════════════════════════════════════════════

  async recordSecretRotation(record: {
    clientId: string;
    secretType: string;
    currentValueHash: string;
    previousValueHash?: string;
    rotatedBy?: string;
    reason?: string;
    expiresAt?: Date;
  }): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO secret_rotation (client_id, secret_type, previous_value_hash, current_value_hash, rotated_by, rotation_reason, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [record.clientId, record.secretType, record.previousValueHash || null, record.currentValueHash,
       record.rotatedBy || null, record.reason || null, record.expiresAt || null]
    );
    logger.info(`Secret rotated for client ${record.clientId}`, { secretType: record.secretType });
  }

  // ══════════════════════════════════════════════════════════════
  // TENANT ISOLATION HELPERS
  // ══════════════════════════════════════════════════════════════

  /**
   * Verify that a resource belongs to a specific client (tenant isolation).
   */
  async verifyTenantAccess(resourceType: string, resourceId: string, clientId: string): Promise<boolean> {
    if (!this.pool) return true;

    try {
      let query: string;
      switch (resourceType) {
        case 'article':
          query = 'SELECT client_id FROM articles WHERE id = $1';
          break;
        case 'client':
          query = 'SELECT id FROM clients WHERE id = $1';
          break;
        case 'keyword':
          query = 'SELECT client_id FROM keywords WHERE id = $1';
          break;
        default:
          return true; // Allow access to unknown resources
      }

      const result = await this.pool.query(query, [resourceId]);
      if (result.rows.length === 0) return false;

      return result.rows[0].client_id === clientId || result.rows[0].id === clientId;
    } catch (err) {
      logger.warn('Tenant verification failed', { resourceType, resourceId, error: (err as Error).message });
      return true;
    }
  }

  async close(): Promise<void> {
    this.rateLimitBuckets.clear();
  }
}

export default new EnterpriseSecurityService();
