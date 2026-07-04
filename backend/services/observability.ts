// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Observability & Monitoring Service
// OpenTelemetry tracing, metrics snapshots, AI latency tracking,
// worker performance analytics, system alerts
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { TraceSpan, MetricsSnapshot, AiLatencyRecord, SystemAlert, WorkerPerformance } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface SpanOptions {
  name: string;
  traceId?: string;
  parentSpanId?: string;
  kind?: string;
  attributes?: Record<string, unknown>;
  resourceAttrs?: Record<string, unknown>;
}

class ObservabilityService {
  private pool: Pool | null = null;
  private activeSpans: Map<string, { spanId: string; traceId: string; startTime: Date; spanName: string }> = new Map();
  private metricsBuffer: MetricsSnapshot[] = [];
  private bufferFlushInterval: ReturnType<typeof setInterval> | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    // Flush metrics buffer every 10 seconds
    this.bufferFlushInterval = setInterval(() => this.flushMetricsBuffer(), 10000);
    logger.info('Observability & Monitoring Service initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // DISTRIBUTED TRACING (OpenTelemetry-style)
  // ══════════════════════════════════════════════════════════════

  startSpan(options: SpanOptions): string {
    const spanId = uuidv4();
    const traceId = options.traceId || uuidv4().replace(/-/g, '');
    const startTime = new Date();

    this.activeSpans.set(spanId, { spanId, traceId, startTime, spanName: options.name });

    logger.debug(`[Trace] Start span: ${options.name}`, { spanId, traceId, parentSpanId: options.parentSpanId });

    return spanId;
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok', statusMessage?: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.warn(`Span ${spanId} not found for endSpan`);
      return;
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - span.startTime.getTime();

    this.storeSpan({
      id: spanId,
      trace_id: span.traceId,
      parent_span_id: undefined,
      span_name: span.spanName,
      service_name: 'backend',
      span_kind: 'internal',
      status,
      status_message: statusMessage,
      start_time: span.startTime,
      end_time: endTime,
      duration_ms: durationMs,
      attributes: {},
      resource_attrs: {},
      events: [],
      created_at: new Date()
    });

    this.activeSpans.delete(spanId);

    logger.debug(`[Trace] End span: duration=${durationMs}ms, status=${status}`);
  }

  private async storeSpan(span: TraceSpan): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO trace_spans (id, trace_id, parent_span_id, span_name, service_name, span_kind, status, status_message, start_time, end_time, duration_ms, attributes, resource_attrs, events)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [span.id, span.trace_id, span.parent_span_id || null, span.span_name, span.service_name,
         span.span_kind, span.status, span.status_message || null,
         span.start_time, span.end_time, span.duration_ms,
         JSON.stringify(span.attributes), JSON.stringify(span.resource_attrs), JSON.stringify(span.events)]
      );
    } catch (err) {
      logger.warn('Failed to store span', { error: (err as Error).message });
    }
  }

  async getTrace(traceId: string): Promise<TraceSpan[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM trace_spans WHERE trace_id = $1 ORDER BY start_time ASC',
      [traceId]
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // METRICS COLLECTION
  // ══════════════════════════════════════════════════════════════

  recordMetric(
    name: string,
    value: number,
    type: 'counter' | 'gauge' | 'histogram' | 'summary' = 'counter',
    labels: Record<string, string> = {},
    unit?: string
  ): void {
    this.metricsBuffer.push({
      id: '',
      metric_name: name,
      metric_type: type,
      value,
      labels,
      unit,
      recorded_at: new Date(),
      created_at: new Date()
    });
  }

  recordAILatency(record: Omit<AiLatencyRecord, 'id' | 'created_at'>): void {
    this.recordMetric('ai_latency_ms', record.latency_ms, 'gauge', {
      provider: record.provider,
      model: record.model || 'unknown',
      operation: record.operation,
      success: String(record.success)
    }, 'milliseconds');

    this.recordMetric('ai_cost_usd', record.cost_usd, 'counter', {
      client_id: record.client_id,
      provider: record.provider,
      model: record.model || 'unknown'
    }, 'USD');

    // Store in DB
    this.storeAiLatencyRecord(record);
  }

  private async storeAiLatencyRecord(record: Omit<AiLatencyRecord, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO ai_latency_records (client_id, provider, model, operation, prompt_tokens, completion_tokens, total_tokens, latency_ms, cost_usd, success, error_type, queue_wait_ms, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [record.client_id, record.provider, record.model || null, record.operation,
         record.prompt_tokens, record.completion_tokens, record.total_tokens,
         record.latency_ms, record.cost_usd, record.success, record.error_type || null,
         record.queue_wait_ms || null, JSON.stringify(record.metadata || {})]
      );
    } catch (err) {
      logger.warn('Failed to store AI latency record', { error: (err as Error).message });
    }
  }

  recordWorkerPerformance(perf: Omit<WorkerPerformance, 'id'>): void {
    this.recordMetric('worker_throughput', perf.throughput_per_min, 'gauge', {
      worker_name: perf.worker_name,
      job_type: perf.job_type
    }, 'jobs/min');

    this.recordMetric('worker_avg_latency_ms', perf.avg_processing_ms, 'gauge', {
      worker_name: perf.worker_name,
      job_type: perf.job_type
    }, 'milliseconds');

    this.storeWorkerPerformance(perf);
  }

  private async storeWorkerPerformance(perf: Omit<WorkerPerformance, 'id'>): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO worker_performance (worker_name, job_type, jobs_processed, jobs_failed, avg_processing_ms, p95_processing_ms, p99_processing_ms, throughput_per_min, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [perf.worker_name, perf.job_type, perf.jobs_processed, perf.jobs_failed,
         perf.avg_processing_ms, perf.p95_processing_ms, perf.p99_processing_ms,
         perf.throughput_per_min, perf.recorded_at]
      );
    } catch (err) {
      logger.warn('Failed to store worker performance', { error: (err as Error).message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // SYSTEM ALERTS
  // ══════════════════════════════════════════════════════════════

  async createAlert(alert: Omit<SystemAlert, 'id' | 'status' | 'created_at'>): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO system_alerts (alert_name, severity, status, message, details, metric_value, threshold_value)
         VALUES ($1, $2, 'active', $3, $4, $5, $6)`,
        [alert.alert_name, alert.severity, alert.message, JSON.stringify(alert.details || {}),
         alert.metric_value || null, alert.threshold_value || null]
      );

      // Log critical alerts immediately
      if (alert.severity === 'critical') {
        logger.error(`[CRITICAL ALERT] ${alert.alert_name}: ${alert.message}`);
      } else if (alert.severity === 'warning') {
        logger.warn(`[ALERT] ${alert.alert_name}: ${alert.message}`);
      }
    } catch (err) {
      logger.error('Failed to create alert', { error: (err as Error).message });
    }
  }

  async acknowledgeAlert(alertId: string, userId?: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `UPDATE system_alerts
       SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1`,
      [alertId, userId || null]
    );
  }

  async resolveAlert(alertId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `UPDATE system_alerts
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1`,
      [alertId]
    );
  }

  async getActiveAlerts(severity?: string): Promise<SystemAlert[]> {
    if (!this.pool) return [];
    let query = 'SELECT * FROM system_alerts WHERE status = \'active\'';
    const params: string[] = [];

    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }

    query += ' ORDER BY severity DESC, created_at DESC LIMIT 50';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // DASHBOARD QUERIES
  // ══════════════════════════════════════════════════════════════

  async getDashboardMetrics(clientId?: string): Promise<{
    totalRequests24h: number;
    errorRate24h: number;
    avgLatency7d: number;
    totalCost7d: number;
    activeWorkers: number;
    queueDepth: number;
  }> {
    if (!this.pool) {
      return { totalRequests24h: 0, errorRate24h: 0, avgLatency7d: 0, totalCost7d: 0, activeWorkers: 0, queueDepth: 0 };
    }

    const results = await Promise.all([
      // Total AI requests in last 24h
      this.pool.query(
        `SELECT COUNT(*) as count FROM ai_latency_records
         WHERE created_at >= NOW() - INTERVAL '24 hours'${clientId ? ' AND client_id = $1' : ''}`,
        clientId ? [clientId] : []
      ),
      // Error rate in last 24h
      this.pool.query(
        `SELECT ROUND(AVG(CASE WHEN success = false THEN 1.0 ELSE 0.0 END) * 100, 2) as rate
         FROM ai_latency_records WHERE created_at >= NOW() - INTERVAL '24 hours'`,
        []
      ),
      // Average latency in last 7 days
      this.pool.query(
        `SELECT ROUND(AVG(latency_ms)::numeric, 0) as avg_latency FROM ai_latency_records
         WHERE created_at >= NOW() - INTERVAL '7 days'`,
        []
      ),
      // Total cost in last 7 days
      this.pool.query(
        `SELECT ROUND(SUM(cost_usd)::numeric, 2) as total_cost FROM ai_latency_records
         WHERE created_at >= NOW() - INTERVAL '7 days'`,
        []
      ),
      // Latest worker performance
      this.pool.query(
        "SELECT COUNT(*) as count FROM worker_performance WHERE recorded_at >= NOW() - INTERVAL '1 hour'",
        []
      ),
      // Queue depth (from jobs table)
      this.pool.query(
        `SELECT COUNT(*) as count FROM jobs WHERE status = 'queued' OR status = 'active'`,
        []
      )
    ]);

    return {
      totalRequests24h: parseInt(results[0].rows[0]?.count || '0'),
      errorRate24h: parseFloat(results[1].rows[0]?.rate || '0'),
      avgLatency7d: parseInt(results[2].rows[0]?.avg_latency || '0'),
      totalCost7d: parseFloat(results[3].rows[0]?.total_cost || '0'),
      activeWorkers: parseInt(results[4].rows[0]?.count || '0'),
      queueDepth: parseInt(results[5].rows[0]?.count || '0')
    };
  }

  async getAILatencyOverTime(hours: number = 24): Promise<Array<{ hour: string; avgLatency: number; totalCalls: number; errorRate: number }>> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT DATE_TRUNC('hour', created_at) as hour,
              ROUND(AVG(latency_ms)::numeric, 0) as avg_latency,
              COUNT(*) as total_calls,
              ROUND(AVG(CASE WHEN success = false THEN 100.0 ELSE 0.0 END), 2) as error_rate
       FROM ai_latency_records
       WHERE created_at >= NOW() - ($1::text || ' hours')::interval
       GROUP BY DATE_TRUNC('hour', created_at)
       ORDER BY hour DESC
       LIMIT 48`,
      [String(hours)]
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // HEALTH CHECKS
  // ══════════════════════════════════════════════════════════════

  async checkSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: string; detail: string }>;
  }> {
    if (!this.pool) {
      return { status: 'degraded', checks: [{ name: 'database', status: 'error', detail: 'No database pool' }] };
    }

    const checks: Array<{ name: string; status: string; detail: string }> = [];

    try {
      await this.pool.query('SELECT 1');
      checks.push({ name: 'database', status: 'ok', detail: 'Connected' });
    } catch (err) {
      checks.push({ name: 'database', status: 'error', detail: (err as Error).message });
    }

    // Check recent error rate
    try {
      const errorResult = await this.pool.query(
        `SELECT ROUND(AVG(CASE WHEN success = false THEN 1.0 ELSE 0.0 END) * 100, 2) as rate
         FROM ai_latency_records WHERE created_at >= NOW() - INTERVAL '5 minutes'`
      );
      const errorRate = parseFloat(errorResult.rows[0]?.rate || '0');
      if (errorRate > 50) {
        checks.push({ name: 'ai-error-rate', status: 'error', detail: `Error rate: ${errorRate}%` });
      } else if (errorRate > 20) {
        checks.push({ name: 'ai-error-rate', status: 'warning', detail: `Error rate: ${errorRate}%` });
      } else {
        checks.push({ name: 'ai-error-rate', status: 'ok', detail: `Error rate: ${errorRate}%` });
      }
    } catch {
      checks.push({ name: 'ai-error-rate', status: 'unknown', detail: 'Could not measure' });
    }

    const hasErrors = checks.some(c => c.status === 'error');
    const hasWarnings = checks.some(c => c.status === 'warning');

    const status = hasErrors ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';
    return { status, checks };
  }

  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0 || !this.pool) return;

    const batch = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      for (const metric of batch) {
        await this.pool.query(
          `INSERT INTO metrics_snapshots (metric_name, metric_type, value, labels, unit, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [metric.metric_name, metric.metric_type, metric.value, JSON.stringify(metric.labels), metric.unit || null, metric.recorded_at]
        );
      }
    } catch (err) {
      logger.warn('Failed to flush metrics buffer', { count: batch.length, error: (err as Error).message });
    }
  }

  async close(): Promise<void> {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    await this.flushMetricsBuffer();
  }
}

export default new ObservabilityService();
