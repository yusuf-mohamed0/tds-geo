// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Department Manager — Base Class
// Shared logic for all 8 department managers:
// task decomposition, subtask execution via BullMQ, result aggregation
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { addJob, QueueNames } from '../../utils/queue';
import {
  DepartmentName,
  DepartmentTask,
  TaskResult,
  Subtask,
  DecomposedTask,
  DepartmentHealth,
  DepartmentMetrics,
  IDepartmentManager,
  priorityToNumber,
} from './types';

export abstract class DepartmentManager implements IDepartmentManager {
  public abstract readonly department: DepartmentName;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly managedQueues: QueueNames[];

  protected pool: Pool | null = null;
  protected taskCounters: Map<string, { processed: number; failed: number; totalMs: number }> = new Map();

  async initialize(pool: Pool): Promise<void> {
    this.pool = pool;
    logger.info(`Department Manager initialized: ${this.name} [${this.department}]`, {
      queues: this.managedQueues.map(q => q.toString()),
    });
  }

  /**
   * Handle an incoming task from the CEO.
   * 1. Decompose into subtasks
   * 2. Execute subtasks
   * 3. Return aggregated result
   */
  async handleTask(task: DepartmentTask): Promise<TaskResult> {
    const startTime = Date.now();
    const taskId = task.id || uuidv4();

    logger.info(`[${this.name}] Handling task: ${task.type}`, { taskId, priority: task.priority });

    try {
      const decomposed = await this.decompose(task);

      if (decomposed.subtasks.length === 0) {
        return {
          taskId,
          type: task.type,
          success: true,
          durationMs: Date.now() - startTime,
          data: { skipped: true, reason: 'No subtasks to execute' },
        };
      }

      const result = await this.execute(task, decomposed);

      // Track counters
      this.incrementCounter(task.type, result.success, Date.now() - startTime);

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.incrementCounter(task.type, false, duration);

      logger.error(`[${this.name}] Task failed: ${task.type}`, {
        taskId,
        error: (err as Error).message,
        duration,
      });

      return {
        taskId,
        type: task.type,
        success: false,
        durationMs: duration,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Execute a decomposed task:
   * - Runs subtasks grouped by dependency (parallel groups → sequential groups)
   * - Each subtask can be dispatched via BullMQ addJob or run inline
   */
  async execute(task: DepartmentTask, decomposed: DecomposedTask): Promise<TaskResult> {
    const startTime = Date.now();
    const results: Map<string, any> = new Map();
    const warnings: string[] = [];
    let globalError: string | undefined;

    // Build a lookup from subtask type → subtask
    const subtaskMap = new Map<string, Subtask>();
    for (const st of decomposed.subtasks) {
      subtaskMap.set(st.type, st);
    }

    // Execute parallel groups sequentially (each group runs in parallel internally)
    for (const group of decomposed.parallelGroups) {
      const groupSubtasks = group
        .map(type => subtaskMap.get(type))
        .filter((s): s is Subtask => !!s);

      // Check dependencies within this group
      const canRun = groupSubtasks.filter(st => {
        if (!st.dependsOn || st.dependsOn.length === 0) return true;
        return st.dependsOn.every(dep => results.has(dep));
      });

      if (canRun.length === 0) continue;

      // Execute subtasks in parallel
      const groupResults = await Promise.allSettled(
        canRun.map(async (st) => {
          if (st.queueName) {
            // Dispatch to BullMQ
            const job = await addJob(st.queueName, st.type, {
              ...st.payload,
              traceId: task.traceId,
              clientId: task.clientId,
              userId: task.userId,
            }, {
              priority: priorityToNumber(st.priority),
            });
            return { type: st.type, queued: true, jobId: job.id, data: st.payload };
          } else {
            // Run inline
            const result = await this.runSubtaskInline(st, task);
            return { type: st.type, ...result };
          }
        })
      );

      for (let i = 0; i < groupResults.length; i++) {
        const gr = groupResults[i];
        if (gr.status === 'fulfilled') {
          results.set(gr.value.type, gr.value);
        } else {
          const errorMsg = gr.reason?.message || 'Subtask failed';
          const failedType = canRun[i]?.type || 'unknown';
          warnings.push(`Subtask "${failedType}" failed: ${errorMsg}`);
          // Propagate error for critical tasks
          if (task.priority === 'critical') {
            globalError = errorMsg;
          }
        }
      }

      if (globalError) break;
    }

    const duration = Date.now() - startTime;

    if (globalError) {
      return {
        taskId: task.id,
        type: task.type,
        success: false,
        durationMs: duration,
        error: globalError,
        warnings,
        data: { subtaskResults: Array.from(results.entries()) },
      };
    }

    return {
      taskId: task.id,
      type: task.type,
      success: true,
      durationMs: duration,
      data: {
        subtaskResults: Array.from(results.entries()),
        aggregatedData: this.aggregateResults(results),
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Decompose a task into subtasks.
   * Must be implemented by each manager.
   */
  abstract decompose(task: DepartmentTask): Promise<DecomposedTask>;

  /**
   * Aggregate results from multiple subtasks into a single result.
   * Override in specific managers for custom aggregation.
   */
  protected aggregateResults(results: Map<string, any>): Record<string, unknown> {
    const aggregated: Record<string, unknown> = {};
    for (const [key, value] of results) {
      aggregated[key] = value;
    }
    return aggregated;
  }

  /**
   * Run a subtask inline (synchronously within the manager process).
   * Override in specific managers for inline execution logic.
   */
  protected async runSubtaskInline(_subtask: Subtask, _task: DepartmentTask): Promise<Record<string, unknown>> {
    return { executed: false, reason: 'No inline handler' };
  }

  // ══════════════════════════════════════════════════════════════
  // HEALTH & METRICS
  // ══════════════════════════════════════════════════════════════

  async getHealth(): Promise<DepartmentHealth> {
    if (!this.pool) {
      return {
        department: this.department,
        status: 'degraded',
        workerCount: 0,
        activeJobs: 0,
        failedJobs24h: 0,
        avgLatencyMs: 0,
        queueDepths: {},
      };
    }

    try {
      const queueNames = this.managedQueues.map(q => q.toString());

      // Query queue depths + failure counts for managed queues
      const result = await this.pool.query(`
        SELECT
          type as queue_name,
          COUNT(*) FILTER (WHERE status = 'active' OR status = 'queued')::int as depth,
          COUNT(*) FILTER (WHERE status = 'failed' AND queued_at >= NOW() - INTERVAL '24 hours')::int as failed_24h,
          COALESCE(AVG(queue_latency_ms) FILTER (WHERE queued_at >= NOW() - INTERVAL '1 hour'), 0)::int as avg_latency_ms
        FROM jobs
        WHERE type = ANY($1::text[])
        GROUP BY type
      `, [queueNames]);

      const queueDepths: Record<string, number> = {};
      let totalActive = 0;
      let totalFailed24h = 0;
      let totalLatencyMs = 0;
      let queueCount = 0;

      for (const row of result.rows) {
        queueDepths[row.queue_name] = parseInt(row.depth) || 0;
        totalActive += parseInt(row.depth) || 0;
        totalFailed24h += parseInt(row.failed_24h) || 0;
        totalLatencyMs += parseInt(row.avg_latency_ms) || 0;
        queueCount++;
      }

      // Ensure all managed queues are represented
      for (const qn of queueNames) {
        if (queueDepths[qn] === undefined) queueDepths[qn] = 0;
      }

      const avgLatencyMs = queueCount > 0 ? Math.round(totalLatencyMs / queueCount) : 0;
      const status = totalFailed24h > 10 ? 'unhealthy' : totalFailed24h > 3 ? 'degraded' : 'healthy';

      return {
        department: this.department,
        status,
        workerCount: queueNames.length,
        activeJobs: totalActive,
        failedJobs24h: totalFailed24h,
        avgLatencyMs,
        queueDepths,
      };
    } catch (err) {
      logger.error(`[${this.name}] Health check failed`, { error: (err as Error).message });
      return {
        department: this.department,
        status: 'unhealthy',
        workerCount: this.managedQueues.length,
        activeJobs: 0,
        failedJobs24h: 0,
        avgLatencyMs: 0,
        queueDepths: {},
      };
    }
  }

  async getMetrics(): Promise<DepartmentMetrics> {
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalMs = 0;
    let taskCount = 0;

    for (const [, counter] of this.taskCounters) {
      totalProcessed += counter.processed;
      totalFailed += counter.failed;
      totalMs += counter.totalMs;
      taskCount++;
    }

    const avgMs = taskCount > 0 ? Math.round(totalMs / taskCount) : 0;

    const health = await this.getHealth();
    const totalJobs = Object.values(health.queueDepths).reduce((a, b) => a + b, 0);

    return {
      department: this.department,
      tasksProcessed: totalProcessed,
      tasksFailed: totalFailed,
      avgProcessingMs: avgMs,
      throughputPerMin: totalProcessed > 0 ? totalProcessed / (Math.max(totalMs, 1) / 60000) : 0,
      queueBacklog: totalJobs,
      workerUtilization: (totalProcessed > 0 || totalJobs > 0)
        ? totalProcessed / (totalProcessed + totalJobs)
        : 0,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  protected log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    const fn = level === 'warn' ? logger.warn : level === 'error' ? logger.error : logger.info;
    fn(`[${this.name}] ${message}`, { department: this.department, ...meta });
  }

  private incrementCounter(type: string, success: boolean, durationMs: number): void {
    const existing = this.taskCounters.get(type) || { processed: 0, failed: 0, totalMs: 0 };
    existing.processed++;
    if (!success) existing.failed++;
    existing.totalMs += durationMs;
    this.taskCounters.set(type, existing);
  }
}
