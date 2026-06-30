import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface MetricCounter {
  value: number;
  labels: Record<string, string>;
}

class MetricsService {
  private pool: Pool | null = null;
  private counters: Map<string, MetricCounter> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime: number = Date.now();

  initialize(pool: Pool): void {
    this.pool = pool;
  }

  increment(name: string, labels: Record<string, string> = {}): void {
    const key = `${name}:${JSON.stringify(labels)}`;
    const existing = this.counters.get(key);
    if (existing) {
      existing.value++;
    } else {
      this.counters.set(key, { value: 1, labels });
    }
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = `${name}:${JSON.stringify(labels)}`;
    const existing = this.histograms.get(key);
    if (existing) {
      existing.push(value);
    } else {
      this.histograms.set(key, [value]);
    }
  }

  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.increment('http_requests_total', { method, path, status: String(statusCode), status_group: statusGroup });
    this.observe('http_request_duration_ms', durationMs, { method, path });
  }

  async generateMetrics(): Promise<string> {
    const lines: string[] = [];
    const now = Date.now();

    lines.push('# HELP tds_geo_up Server uptime status');
    lines.push('# TYPE tds_geo_up gauge');
    lines.push(`tds_geo_up 1`);

    const uptime = Math.floor((now - this.startTime) / 1000);
    lines.push('# HELP tds_geo_uptime_seconds Server uptime in seconds');
    lines.push('# TYPE tds_geo_uptime_seconds gauge');
    lines.push(`tds_geo_uptime_seconds ${uptime}`);

    lines.push('# HELP tds_geo_build_info Build metadata');
    lines.push('# TYPE tds_geo_build_info gauge');
    lines.push(`tds_geo_build_info{version="${process.env.npm_package_version || 'unknown'}",node="${process.version}"} 1`);

    if (this.pool) {
      try {
        const poolStatus = await this.pool.query('SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = $1', ['active']);
        const activeConn = parseInt(poolStatus.rows[0]?.count || '0', 10);
        lines.push('# HELP tds_geo_db_active_connections Active database connections');
        lines.push('# TYPE tds_geo_db_active_connections gauge');
        lines.push(`tds_geo_db_active_connections ${activeConn}`);

        const totalResult = await this.pool.query('SELECT COUNT(*) as count FROM pg_stat_activity');
        const totalConn = parseInt(totalResult.rows[0]?.count || '0', 10);
        lines.push('# HELP tds_geo_db_total_connections Total database connections');
        lines.push('# TYPE tds_geo_db_total_connections gauge');
        lines.push(`tds_geo_db_total_connections ${totalConn}`);
      } catch {
        lines.push('# HELP tds_geo_db_up Database connectivity');
        lines.push('# TYPE tds_geo_db_up gauge');
        lines.push(`tds_geo_db_up 0`);
      }
    }

    const counterGroups = new Map<string, MetricCounter[]>();
    for (const [, metric] of this.counters) {
      const name = metric.labels.path ? 'http_requests_total' : 'unknown_counter';
      const group = counterGroups.get(name) || [];
      group.push(metric);
      counterGroups.set(name, group);
    }

    for (const [name, metrics] of counterGroups.entries()) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      for (const m of metrics) {
        const labelStr = Object.entries(m.labels)
          .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
          .join(',');
        if (labelStr) {
          lines.push(`${name}{${labelStr}} ${m.value}`);
        } else {
          lines.push(`${name} ${m.value}`);
        }
      }
    }

    const histGroups = new Map<string, number[]>();
    for (const [key, values] of this.histograms) {
      const sep = key.lastIndexOf(':');
      const name = key.substring(0, sep);
      const group = histGroups.get(name) || [];
      group.push(...values);
      histGroups.set(name, group);
    }

    for (const [name, values] of histGroups.entries()) {
      if (values.length === 0) continue;
      const sorted = [...values].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const count = sorted.length;
      const p50 = sorted[Math.floor(count * 0.5)];
      const p90 = sorted[Math.floor(count * 0.9)];
      const p99 = sorted[Math.floor(count * 0.99)];

      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} summary`);
      lines.push(`${name}{quantile="0.5"} ${p50}`);
      lines.push(`${name}{quantile="0.9"} ${p90}`);
      lines.push(`${name}{quantile="0.99"} ${p99}`);
      lines.push(`${name}_sum ${sum}`);
      lines.push(`${name}_count ${count}`);
    }

    const mem = process.memoryUsage();
    lines.push('# HELP tds_geo_memory_bytes Process memory usage');
    lines.push('# TYPE tds_geo_memory_bytes gauge');
    lines.push(`tds_geo_memory_bytes{type="rss"} ${mem.rss}`);
    lines.push(`tds_geo_memory_bytes{type="heapTotal"} ${mem.heapTotal}`);
    lines.push(`tds_geo_memory_bytes{type="heapUsed"} ${mem.heapUsed}`);
    lines.push(`tds_geo_memory_bytes{type="external"} ${mem.external}`);

    lines.push('# HELP tds_geo_event_loop_lag Event loop lag');
    lines.push('# TYPE tds_geo_event_loop_lag gauge');
    lines.push(`tds_geo_event_loop_lag 0`);

    if (this.pool) {
      try {
        const errCount = await this.pool.query(
          "SELECT COUNT(*) as count FROM activity_logs WHERE level = 'error' AND created_at >= NOW() - INTERVAL '24 hours'"
        );
        const errs = parseInt(errCount.rows[0]?.count || '0', 10);
        lines.push('# HELP tds_geo_errors_24h Error count in last 24 hours');
        lines.push('# TYPE tds_geo_errors_24h gauge');
        lines.push(`tds_geo_errors_24h ${errs}`);
      } catch {
        //
      }

      try {
        const articleStats = await this.pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM articles WHERE status = 'generated') as pending,
            (SELECT COUNT(*)::int FROM articles WHERE status = 'published') as published
        `);
        const row = articleStats.rows[0];
        lines.push('# HELP tds_geo_articles_total Article counts');
        lines.push('# TYPE tds_geo_articles_total gauge');
        lines.push(`tds_geo_articles_total{status="pending"} ${row?.pending || 0}`);
        lines.push(`tds_geo_articles_total{status="published"} ${row?.published || 0}`);
      } catch {
        //
      }

      try {
        const sitesResult = await this.pool.query('SELECT COUNT(*)::int as count FROM connected_sites');
        lines.push('# HELP tds_geo_connected_sites_total Total connected sites');
        lines.push('# TYPE tds_geo_connected_sites_total gauge');
        lines.push(`tds_geo_connected_sites_total ${sitesResult.rows[0]?.count || 0}`);
      } catch {
        //
      }
    }

    return lines.join('\n');
  }
}

export default new MetricsService();
