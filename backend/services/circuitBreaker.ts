// ══════════════════════════════════════════════════════════════════
// Circuit Breaker & Resilience Service
// Graceful degradation, retry logic, dead-letter queues,
// distributed locks, circuit breakers
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { CircuitBreakerState, DeadLetterJob } from '../types';

interface CircuitBreakerOptions {
  threshold?: number;
  recoveryTimeoutSeconds?: number;
  halfOpenMaxRequests?: number;
}

type CircuitState = 'closed' | 'open' | 'half_open';

class CircuitBreaker {
  private breakers: Map<string, {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureAt: number;
    lastSuccessAt: number;
    openedAt: number;
    threshold: number;
    recoveryTimeout: number;
  }> = new Map();

  /**
   * Execute a function with circuit breaker protection.
   */
  async call<T>(
    name: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<T> {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureAt: 0,
        lastSuccessAt: 0,
        openedAt: 0,
        threshold: options?.threshold || 5,
        recoveryTimeout: (options?.recoveryTimeoutSeconds || 30) * 1000
      };
      this.breakers.set(name, breaker);
    }

    // Check if circuit is open
    const isOpen = breaker.state === 'open';
    if (isOpen) {
      const timeSinceOpened = Date.now() - breaker.openedAt;
      if (timeSinceOpened >= breaker.recoveryTimeout) {
        logger.info(`Circuit ${name}: transitioning from open to half-open (timeout elapsed)`);
        breaker.state = 'half_open';
      } else {
        logger.warn(`Circuit ${name}: open, using fallback`, {
          failuresRemaining: breaker.threshold - breaker.failureCount,
          timeSinceOpenedMs: timeSinceOpened,
          recoveryMs: breaker.recoveryTimeout
        });
        if (fallback) return fallback();
        throw new Error(`Circuit breaker "${name}" is open`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(name, breaker);
      return result;
    } catch (err) {
      this.onFailure(name, breaker);
      if (breaker.state === 'open') {
        if (fallback) return fallback();
      }
      throw err;
    }
  }

  private onSuccess(name: string, breaker: {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureAt: number;
    lastSuccessAt: number;
    openedAt: number;
    threshold: number;
    recoveryTimeout: number;
  }): void {
    breaker.successCount++;
    breaker.lastSuccessAt = Date.now();

    if (breaker.state === 'half_open') {
      if (breaker.successCount >= 3) {
        logger.info(`Circuit ${name}: half-open -> closed (success threshold reached)`);
        breaker.state = 'closed';
        breaker.failureCount = 0;
        breaker.successCount = 0;
      }
    } else if (breaker.state === 'closed') {
      // Reset failure count on success
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }

  private onFailure(name: string, breaker: {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureAt: number;
    lastSuccessAt: number;
    openedAt: number;
    threshold: number;
    recoveryTimeout: number;
  }): void {
    breaker.failureCount++;
    breaker.lastFailureAt = Date.now();

    if (breaker.state === 'closed' && breaker.failureCount >= breaker.threshold) {
      logger.warn(`Circuit ${name}: closed -> open (${breaker.failureCount} failures)`);
      breaker.state = 'open';
      breaker.openedAt = Date.now();
    } else if (breaker.state === 'half_open') {
      logger.warn(`Circuit ${name}: half_open -> open (failure during recovery)`);
      breaker.state = 'open';
      breaker.openedAt = Date.now();
    }
  }

  getState(name: string): { state: CircuitState; failureCount: number; isOpen: boolean } {
    const breaker = this.breakers.get(name);
    if (!breaker) return { state: 'closed', failureCount: 0, isOpen: false };
    return { state: breaker.state, failureCount: breaker.failureCount, isOpen: breaker.state === 'open' };
  }

  reset(name: string): void {
    this.breakers.delete(name);
    logger.info(`Circuit ${name}: reset`);
  }
}

// ══════════════════════════════════════════════════════════════════
// RESILIENCE SERVICE
// ══════════════════════════════════════════════════════════════════

class ResilienceService {
  private pool: Pool | null = null;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private circuitBreaker = new CircuitBreaker();
  private distributedLocks: Map<string, { owner: string; acquiredAt: number; ttlMs: number }> = new Map();

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Resilience Service initialized');
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  // ══════════════════════════════════════════════════════════════
  // RETRY WITH BACKOFF
  // ══════════════════════════════════════════════════════════════

  async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      shouldRetry?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts || 3;
    const baseDelayMs = options.baseDelayMs || 1000;
    const maxDelayMs = options.maxDelayMs || 30000;
    const shouldRetry = options.shouldRetry || (() => true);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;

        if (attempt === maxAttempts || !shouldRetry(lastError)) {
          break;
        }

        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1),
          maxDelayMs
        );
        const jitter = Math.random() * delay * 0.1;
        const totalDelay = delay + jitter;

        logger.warn(`Retry attempt ${attempt}/${maxAttempts} after ${Math.round(totalDelay)}ms`, {
          error: lastError.message
        });

        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }

    throw lastError || new Error('Retry failed');
  }

  // ══════════════════════════════════════════════════════════════
  // DEAD-LETTER QUEUE MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async sendToDeadLetter(job: Omit<DeadLetterJob, 'id' | 'failed_at'>): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO dead_letter_queue (job_type, job_data, error_message, failed_attempts, retry_later_at, is_resolved)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [job.job_type, JSON.stringify(job.job_data), job.error_message || null,
         job.failed_attempts, job.retry_later_at || null]
      );
      logger.warn(`Job sent to dead-letter queue`, { jobType: job.job_type, attempts: job.failed_attempts });
    } catch (err) {
      logger.error('Failed to store dead-letter job', { error: (err as Error).message });
    }
  }

  async retryDeadLetterJob(jobId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `UPDATE dead_letter_queue SET is_resolved = true, retry_later_at = NOW() WHERE id = $1`,
      [jobId]
    );
  }

  async getDeadLetterJobs(resolved: boolean = false): Promise<DeadLetterJob[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM dead_letter_queue WHERE is_resolved = $1 ORDER BY failed_at DESC LIMIT 100',
      [resolved]
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // DISTRIBUTED LOCKS (via DB or in-memory)
  // ══════════════════════════════════════════════════════════════

  async acquireDistributedLock(
    lockName: string,
    owner: string,
    ttlMs: number = 30000
  ): Promise<boolean> {
    if (!this.pool) {
      // In-memory fallback
      const existing = this.distributedLocks.get(lockName);
      if (existing && (Date.now() - existing.acquiredAt) < existing.ttlMs) {
        if (existing.owner !== owner) return false;
        // Refresh lock
        existing.acquiredAt = Date.now();
        return true;
      }
      this.distributedLocks.set(lockName, { owner, acquiredAt: Date.now(), ttlMs });
      return true;
    }

    // Try to acquire via advisory lock (PostgreSQL)
    try {
      const result = await this.pool.query(
        `SELECT pg_try_advisory_lock($1) as acquired`,
        [this.hashLockName(lockName)]
      );
      return result.rows[0]?.acquired || false;
    } catch (err) {
      logger.warn('Distributed lock acquisition failed', { lockName, error: (err as Error).message });
      return false;
    }
  }

  async releaseDistributedLock(lockName: string, owner: string): Promise<void> {
    if (!this.pool) {
      const existing = this.distributedLocks.get(lockName);
      if (existing?.owner === owner) {
        this.distributedLocks.delete(lockName);
      }
      return;
    }

    try {
      await this.pool.query(
        `SELECT pg_advisory_unlock($1)`,
        [this.hashLockName(lockName)]
      );
    } catch (err) {
      logger.warn('Distributed lock release failed', { lockName, error: (err as Error).message });
    }
  }

  private hashLockName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // ══════════════════════════════════════════════════════════════
  // CIRCUIT BREAKER DB SYNC
  // ══════════════════════════════════════════════════════════════

  async syncCircuitBreakerState(name: string): Promise<CircuitBreakerState | null> {
    if (!this.pool) return null;

    const cb = this.circuitBreaker.getState(name);
    try {
      const result = await this.pool.query(
        `INSERT INTO circuit_breaker_state (circuit_name, state, failure_count, threshold, recovery_timeout_seconds)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (circuit_name) DO UPDATE
         SET state = $2, failure_count = $3, updated_at = NOW()
         RETURNING *`,
        [name, cb.state, cb.failureCount, 5, 30]
      );
      return result.rows[0];
    } catch (err) {
      logger.warn('Failed to sync circuit breaker state', { error: (err as Error).message });
      return null;
    }
  }

  async getJobMetrics(): Promise<{
    totalFailed: number;
    totalInDeadLetter: number;
    activeRetries: number;
  }> {
    if (!this.pool) return { totalFailed: 0, totalInDeadLetter: 0, activeRetries: 0 };

    const [failedJobs, deadLetter, retries] = await Promise.all([
      this.pool.query("SELECT COUNT(*) as count FROM jobs WHERE status = 'failed'"),
      this.pool.query('SELECT COUNT(*) as count FROM dead_letter_queue WHERE is_resolved = false'),
      this.pool.query('SELECT COUNT(*) as count FROM dead_letter_queue WHERE retry_later_at > NOW()')
    ]);

    return {
      totalFailed: parseInt(failedJobs.rows[0]?.count || '0'),
      totalInDeadLetter: parseInt(deadLetter.rows[0]?.count || '0'),
      activeRetries: parseInt(retries.rows[0]?.count || '0')
    };
  }

  async close(): Promise<void> {
    this.distributedLocks.clear();
  }
}

export default new ResilienceService();
