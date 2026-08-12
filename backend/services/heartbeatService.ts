// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { connectorManager } from '../connector-manager';
import { sitesService } from './sitesService';

const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_TO = process.env.HEARTBEAT_EMAIL_TO || '';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '300000', 10); // 5 min default
const HEARTBEAT_DB_DEGRADED_MS = parseInt(process.env.HEARTBEAT_DB_DEGRADED_MS || '5000', 10);
const KIVO_PUBLIC_URL = process.env.TDS_PUBLIC_URL || process.env.SHOPIFY_APP_URL || 'https://ai.trafficdigitalsolutions.com';

interface HeartbeatReport {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'critical';
  summary: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    server: ServerMetrics;
    openai: CheckResult;
    ollama: CheckResult;
    connectors: CheckResult & { details: ConnectorStatus[] };
    connectedSites: CheckResult & { details: SiteStatus[] };
    recentErrors: CheckResult & { count: number };
  };
  duration_ms: number;
}

interface CheckResult {
  status: 'healthy' | 'degraded' | 'down' | 'not_configured';
  message: string;
}

interface ServerMetrics extends CheckResult {
  cpu?: string;
  memory?: string;
  disk?: string;
  uptime?: string;
  nodeVersion?: string;
}

interface ConnectorStatus {
  id: string;
  provider: string;
  healthy: boolean;
}

interface SiteStatus {
  domain: string;
  platform: string;
  health: string;
  status: string;
}

class HeartbeatService {
  private pool: Pool | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastReport: HeartbeatReport | null = null;
  private consecutiveFailures = 0;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('HeartbeatService initialized', { interval: HEARTBEAT_INTERVAL, emailTo: EMAIL_TO });
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.run(), HEARTBEAT_INTERVAL);
    this.run();
    logger.info('HeartbeatService: periodic checks started', { intervalMs: HEARTBEAT_INTERVAL });
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async run(): Promise<HeartbeatReport> {
    const start = Date.now();
    const report = await this.collectReport();
    report.duration_ms = Date.now() - start;
    this.lastReport = report;

    const isCritical = report.status === 'critical';
    const isDegraded = report.status === 'degraded';

    if (isCritical || isDegraded) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures <= 1 || this.consecutiveFailures % 3 === 0) {
        await this.sendAlertEmail(report).catch(err => {
          logger.error('HeartbeatService: failed to send alert email', { error: err.message });
        });
      }
    } else {
      this.consecutiveFailures = 0;
      if (this.lastReport?.status !== 'healthy') {
        await this.sendRecoveryEmail(report).catch(err => {
          logger.error('HeartbeatService: failed to send recovery email', { error: err.message });
        });
      }
    }

    logger.info('HeartbeatService: check complete', {
      status: report.status,
      duration: report.duration_ms,
      connectors: report.checks.connectors.details.length,
      errors: report.checks.recentErrors.count,
    });

    return report;
  }

  async getLastReport(): Promise<HeartbeatReport | null> {
    return this.lastReport;
  }

  async sendTestEmail(): Promise<void> {
    const report = await this.run();
    await this.sendEmail({
      subject: `🟢 [Kivo Pulse] Test Heartbeat — ${report.status.toUpperCase()} — ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      html: this.createEmailHtml(report),
    });
  }

  private async collectReport(): Promise<HeartbeatReport> {
    const pool = this.getPool();

    const [dbCheck, serverMetrics, openaiCheck, ollamaCheck, connectorCheck, sitesCheck, errorCheck] = await Promise.all([
      this.checkDatabase(pool),
      this.checkServer(),
      this.checkOpenAI(pool),
      this.checkOllama(pool),
      this.checkConnectors(),
      this.checkConnectedSites(pool),
      this.checkRecentErrors(pool),
    ]);

    const allHealthy = [dbCheck, openaiCheck, ollamaCheck, connectorCheck, sitesCheck, errorCheck]
      .every(c => c.status === 'healthy' || c.status === 'not_configured');

    const anyDown = [dbCheck, openaiCheck, ollamaCheck, connectorCheck, sitesCheck, errorCheck]
      .some(c => c.status === 'down');

    const status: 'healthy' | 'degraded' | 'critical' = anyDown ? 'critical' : allHealthy ? 'healthy' : 'degraded';

    const problems: string[] = [];
    if (dbCheck.status !== 'healthy') problems.push(`Database: ${dbCheck.message}`);
    if (openaiCheck.status !== 'healthy' && openaiCheck.status !== 'not_configured') problems.push(`OpenAI: ${openaiCheck.message}`);
    if (ollamaCheck.status !== 'healthy' && ollamaCheck.status !== 'not_configured') problems.push(`Ollama: ${ollamaCheck.message}`);
    if (connectorCheck.status !== 'healthy') problems.push(`Connectors: ${connectorCheck.message}`);
    if (sitesCheck.status !== 'healthy') problems.push(`Sites: ${sitesCheck.message}`);
    if (errorCheck.status !== 'healthy') problems.push(`Errors: ${errorCheck.message}`);

    const summary = problems.length > 0
      ? `⚠️ ${problems.length} issue(s) detected: ${problems.join(' | ')}`
      : '✅ All systems operational';

    return {
      timestamp: new Date().toISOString(),
      status,
      summary,
      checks: {
        database: dbCheck,
        redis: { status: 'not_configured', message: 'Redis not configured for heartbeat' },
        server: serverMetrics,
        openai: openaiCheck,
        ollama: ollamaCheck,
        connectors: connectorCheck,
        connectedSites: sitesCheck,
        recentErrors: errorCheck,
      },
      duration_ms: 0,
    };
  }

  private async checkDatabase(pool: Pool): Promise<CheckResult> {
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      const ms = Date.now() - start;
      return {
        status: ms < HEARTBEAT_DB_DEGRADED_MS ? 'healthy' : 'degraded',
        message: `Query ok (${ms}ms)`,
      };
    } catch (err) {
      return { status: 'down', message: `Database unreachable: ${(err as Error).message}` };
    }
  }

  private async checkServer(): Promise<ServerMetrics> {
    try {
      const { execSync } = require('child_process');
      const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0) + 'MB';
      const uptime = Math.floor(process.uptime() / 60) + 'm';

      let cpu = 'unknown';
      let disk = 'unknown';
      try {
        cpu = execSync('top -bn1 | head -5 | grep "Cpu(s)" | awk \'{print $2 + $4}\'', { encoding: 'utf8', timeout: 3000 }).trim() + '%';
      } catch { cpu = 'n/a'; }
      try {
        disk = execSync('df -h / | awk \'NR==2{print $5}\'', { encoding: 'utf8', timeout: 3000 }).trim();
      } catch { disk = 'n/a'; }

      return {
        status: parseFloat(cpu) > 90 ? 'degraded' : 'healthy',
        message: `CPU: ${cpu}, Memory: ${memory}, Disk: ${disk}, Uptime: ${uptime}`,
        cpu,
        memory,
        disk,
        uptime,
        nodeVersion: process.version,
      };
    } catch (err) {
      return { status: 'degraded', message: `Server metrics error: ${(err as Error).message}` };
    }
  }

  private async checkOpenAI(pool: Pool): Promise<CheckResult> {
    if (!process.env.OPENAI_API_KEY) return { status: 'not_configured', message: 'OpenAI not configured' };
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int as recent FROM activity_logs
         WHERE action = 'openai_error' AND created_at >= NOW() - INTERVAL '1 hour'`
      );
      const errors = result.rows[0]?.recent || 0;
      return {
        status: errors > 10 ? 'degraded' : 'healthy',
        message: errors > 0 ? `${errors} errors in last hour` : 'Operational',
      };
    } catch {
      return { status: 'degraded', message: 'Could not verify OpenAI status' };
    }
  }

  private async checkOllama(pool: Pool): Promise<CheckResult> {
    if (!process.env.OLLAMA_API_KEY) return { status: 'not_configured', message: 'Ollama not configured' };
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int as recent FROM activity_logs
         WHERE action = 'ollama_error' AND created_at >= NOW() - INTERVAL '1 hour'`
      );
      const errors = result.rows[0]?.recent || 0;
      return {
        status: errors > 10 ? 'degraded' : 'healthy',
        message: errors > 0 ? `${errors} errors in last hour` : 'Operational',
      };
    } catch {
      return { status: 'degraded', message: 'Could not verify Ollama status' };
    }
  }

  private async checkConnectors(): Promise<CheckResult & { details: ConnectorStatus[] }> {
    const connectors = connectorManager.list();
    const details: ConnectorStatus[] = connectors.map(c => ({
      id: c.id,
      provider: c.provider,
      healthy: c.healthy,
    }));

    if (details.length === 0) {
      return { status: 'not_configured', message: 'No connectors registered', details };
    }

    const isStub = (id: string) => ['webflow', 'ghost'].includes(id);
    const healthy = details.filter(d => d.healthy || isStub(d.id));
    const unhealthy = details.filter(d => !d.healthy && !isStub(d.id));

    if (unhealthy.length === 0) {
      return { status: 'healthy', message: `${healthy.length} connectors healthy`, details };
    }

    return {
      status: 'degraded',
      message: `${healthy.length} healthy, ${unhealthy.length} down`,
      details,
    };
  }

  private async checkConnectedSites(pool: Pool): Promise<CheckResult & { details: SiteStatus[] }> {
    try {
      const result = await pool.query(
        `SELECT domain, platform, health_status, connection_status
         FROM connected_sites ORDER BY platform`
      );
      const details: SiteStatus[] = result.rows.map(r => ({
        domain: r.domain,
        platform: r.platform,
        health: r.health_status,
        status: r.connection_status,
      }));

      if (details.length === 0) {
        return { status: 'not_configured', message: 'No connected sites registered', details };
      }

      const down = details.filter(d => d.health === 'down' || d.status === 'error');
      return {
        status: down.length === 0 ? 'healthy' : 'degraded',
        message: down.length > 0
          ? `${down.length}/${details.length} sites have issues`
          : `${details.length} sites healthy`,
        details,
      };
    } catch (err) {
      return { status: 'degraded', message: `Could not check sites: ${(err as Error).message}`, details: [] };
    }
  }

  private async checkRecentErrors(pool: Pool): Promise<CheckResult & { count: number }> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int as count FROM activity_logs
         WHERE level = 'error' AND created_at >= NOW() - INTERVAL '1 hour'`
      );
      const count = result.rows[0]?.count || 0;
      return {
        status: count > 50 ? 'down' : count > 10 ? 'degraded' : 'healthy',
        message: `${count} errors in last hour`,
        count,
      };
    } catch {
      return { status: 'degraded', message: 'Could not check error logs', count: -1 };
    }
  }

  private createEmailHtml(report: HeartbeatReport): string {
    const statusIcon = (s: string) => {
      if (s === 'healthy' || s === 'not_configured') return '🟢';
      if (s === 'degraded') return '🟡';
      if (s === 'down' || s === 'critical') return '🔴';
      return '⚪';
    };

    const time = new Date(report.timestamp).toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const hostname = (() => { try { return require('os').hostname(); } catch { return 'unknown'; } })();

    const connectorRows = report.checks.connectors.details.map(c =>
      `<tr><td>${statusIcon(c.healthy ? 'healthy' : 'down')}</td><td style="text-transform:capitalize">${c.provider}</td><td><code>${c.id}</code></td><td>${c.healthy ? '<span style="color:#1e8449;font-weight:600">Healthy</span>' : '<span style="color:#c0392b;font-weight:600">Down</span>'}</td></tr>`
    ).join('');

    const siteRows = report.checks.connectedSites.details.map(s =>
      `<tr><td>${statusIcon(s.health)}</td><td style="text-transform:capitalize">${s.platform}</td><td><code>${s.domain}</code></td><td>${s.status}</td><td>${s.health}</td></tr>`
    ).join('');

    const failedChecks: string[] = [];
    if (report.checks.database.status === 'down') failedChecks.push('database');
    if (report.checks.database.status === 'degraded') failedChecks.push('database (slow)');
    if (report.checks.server.status === 'degraded') failedChecks.push('server (high load)');
    if (report.checks.openai.status === 'degraded' || report.checks.openai.status === 'down') failedChecks.push('OpenAI');
    if (report.checks.ollama.status === 'degraded' || report.checks.ollama.status === 'down') failedChecks.push('Ollama');
    if (report.checks.connectors.details.some(c => !c.healthy)) failedChecks.push('connectors');
    if (report.checks.connectedSites.details.some(s => s.health === 'down')) failedChecks.push('connected sites');
    if (report.checks.recentErrors.count > 10) failedChecks.push('error flood');

    const causes: Record<string, string[]> = {
      'database': ['PostgreSQL service stopped or crashed', 'Connection pool exhausted', 'Disk full on database volume', 'PostgreSQL max_connections reached'],
      'database (slow)': ['Heavy query load or missing indexes', 'Table bloat or lock contention', 'Insufficient DB resources (CPU/memory)'],
      'server (high load)': ['Traffic spike or runaway process', 'Memory leak causing swap usage', 'Cron job or backup consuming resources'],
      'OpenAI': ['API key expired or invalid', 'OpenAI service outage', 'Rate limit exceeded', 'Network connectivity issue'],
      'Ollama': ['Ollama service not running', 'Model not loaded or out of memory', 'API endpoint unreachable'],
      'connectors': ['Platform API credentials expired', 'Platform service outage', 'Rate limiting by platform', 'Network/firewall blocking API calls'],
      'connected sites': ['Site credentials or API key invalid', 'Site is down or maintenance mode', 'Connection not refreshed after expiry'],
      'error flood': ['Application bug causing repeated failures', 'Third-party service returning errors', 'Configuration issue after recent deploy'],
    };

    const actions: Record<string, string[]> = {
      'database': ['sudo systemctl status postgresql', 'sudo journalctl -u postgresql --since "10 min ago"', 'df -h /var/lib/postgresql', 'tail -100 /var/log/postgresql/postgresql-*-main.log'],
      'database (slow)': ['psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != \'idle\' ORDER BY duration DESC;"', 'psql -c "SELECT relname, seq_scan, seq_tup_read FROM pg_stat_user_tables ORDER BY seq_scan DESC;"'],
      'server (high load)': ['top -bn1 | head -20', 'ps aux --sort=-%mem | head -10', 'free -m', 'df -h /'],
      'OpenAI': ['curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" | head -5', 'Check .env for OPENAI_API_KEY validity'],
      'Ollama': ['sudo systemctl status ollama', 'ollama list', 'curl -s http://localhost:11434/api/tags'],
      'connectors': ['Check platform API credentials in .env', 'curl -s https://platform-api.com/health', 'Review connector logs: pm2 logs kivo-backend --lines 50'],
      'connected sites': ['psql -c "SELECT domain, platform, health_status, connection_status FROM connected_sites;"', 'POST /api/connector/:provider/test to verify connection'],
      'error flood': ['pm2 logs kivo-backend --lines 100 | grep error', 'journalctl -u kivo --since "10 min ago"', 'Check recent activity_logs in database'],
    };

    const uniqueFailures = [...new Set(failedChecks)];
    const causesHtml = uniqueFailures.length > 0
      ? `<div class="section-title">Possible Causes</div>
${uniqueFailures.map(f => `<div style="background:#F4FBF8;border-radius:10px;padding:12px 16px;margin:8px 0;font-size:13px;border-left:3px solid #22E6A8">
  <strong style="color:#071013;display:block;margin-bottom:6px;text-transform:capitalize">${f.replace(/_/g, ' ')}</strong>
  ${(causes[f] || ['Unknown issue']).map(c => `<div style="padding:2px 0;color:#263B37">• ${c}</div>`).join('')}
</div>`).join('')}`
      : '';

    const actionsHtml = uniqueFailures.length > 0
      ? `<div class="section-title">Recommended Actions</div>
${uniqueFailures.map(f => `<div style="background:#F4FBF8;border-radius:10px;padding:12px 16px;margin:8px 0;font-size:13px;border-left:3px solid #3BB5FF">
  <strong style="color:#071013;display:block;margin-bottom:6px;text-transform:capitalize">${f.replace(/_/g, ' ')}</strong>
  ${(actions[f] || ['Investigate server logs']).map(a => `<code style="display:block;padding:5px 10px;margin:3px 0;background:#fff;border:1px solid #D9E8E2;border-radius:6px;color:#071013;font-size:12px">${a}</code>`).join('')}
</div>`).join('')}`
      : '';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F4FBF8;margin:0;padding:0}
  .container{max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:#071013;padding:0}
  .header-top{padding:24px 32px 14px}
  .header-logo{font-size:20px;font-weight:700;color:#fff;letter-spacing:-.3px}
  .header-logo-accent{color:#22E6A8}
  .header-mark{display:inline-block;width:28px;height:28px;border-radius:8px;background:#071013;border:1px solid #22E6A8;vertical-align:middle;margin-right:10px;position:relative}
  .header-mark span{display:inline-block;color:#22E6A8;font-weight:800;font-size:18px;line-height:28px;text-align:center;width:28px}
  .header-top-row{display:table;width:100%}
  .header-top-left{display:table-cell;vertical-align:middle}
  .header-top-right{display:table-cell;vertical-align:middle;text-align:right}
  .header-status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
  .header-status-badge.critical{background:#EF4444;color:#fff}
  .header-status-badge.degraded{background:#B7FF4A;color:#071013}
  .header-status-badge.healthy{background:#22E6A8;color:#071013}
  .header-bar{height:4px;margin-top:14px}
  .header-bar.critical{background:#EF4444}
  .header-bar.degraded{background:#B7FF4A}
  .header-bar.healthy{background:#22E6A8}
  .header-meta{padding:10px 32px 16px;font-size:12px;color:#D9E8E2}
  .header-meta span{margin-right:14px;white-space:nowrap}
  .body{padding:20px 32px 28px}
  .summary{font-size:14px;padding:14px 18px;border-radius:10px;margin-bottom:24px;line-height:1.5}
  .summary.critical{background:#FEF2F2;color:#991B1B;border-left:4px solid #EF4444}
  .summary.degraded{background:#F7FFE8;color:#34410E;border-left:4px solid #B7FF4A}
  .summary.healthy{background:#E9FFF7;color:#064E3B;border-left:4px solid #22E6A8}
  .section-title{font-size:11px;font-weight:700;color:#617A72;text-transform:uppercase;letter-spacing:.8px;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #22E6A8}
  .section-title:first-of-type{margin-top:0}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
  th{text-align:left;padding:8px 12px;background:#F4FBF8;color:#071013;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:7px 12px;border-top:1px solid #D9E8E2;color:#263B37}
  td code{font-size:12px;background:#F4FBF8;padding:1px 6px;border-radius:3px;color:#071013}
  .ai-table{width:100%;border-collapse:collapse;font-size:13px;background:#F4FBF8;border-radius:10px;overflow:hidden;border:1px solid #D9E8E2}
  .ai-table td{padding:8px 12px;border-top:1px solid #D9E8E2}
  .ai-table tr:first-child td{border-top:none}
  .ai-table .name{font-weight:600;color:#071013}
  .ai-table .status{text-align:right}
  .footnote{padding:0 32px 24px;font-size:11px;color:#617A72;text-align:center;line-height:1.6}
  .footnote a{color:#3BB5FF;text-decoration:none}
  hr{border:none;border-top:1px solid #D9E8E2;margin:20px 0}
</style></head><body>
<div class="container">
  <div class="header">
    <div class="header-top">
      <div class="header-top-row">
        <div class="header-top-left">
          <div class="header-logo"><span class="header-mark"><span>K</span></span>Kivo <span class="header-logo-accent">Pulse</span></div>
        </div>
        <div class="header-top-right">
          <div class="header-status-badge ${report.status}">${report.status.toUpperCase()}</div>
        </div>
      </div>
      <div class="header-bar ${report.status}"></div>
      <div class="header-meta">
        <span>&#128339; ${hostname}</span>
        <span>&#128197; ${time}</span>
        <span>&#9201; ${report.duration_ms}ms</span>
      </div>
    </div>
  </div>
  <div class="body">
    <div class="summary ${report.status}">${report.summary}</div>

    <div class="section-title">Server</div>
    <table style="width:100%;border-collapse:separate;border-spacing:0 6px;font-size:13px">
      <tr>
        <td style="width:50%;background:#F4FBF8;border-radius:8px;padding:10px 14px;border:1px solid #D9E8E2;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#617A72;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">CPU</div>
          <div style="font-size:15px;font-weight:600;color:#071013">${report.checks.server.cpu || 'n/a'}</div>
        </td>
        <td style="width:50%;background:#F4FBF8;border-radius:8px;padding:10px 14px;border:1px solid #D9E8E2;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#617A72;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Memory</div>
          <div style="font-size:15px;font-weight:600;color:#071013">${report.checks.server.memory || 'n/a'}</div>
          <div style="font-size:11px;color:#617A72;margin-top:2px">Heap used</div>
        </td>
      </tr>
      <tr>
        <td style="background:#F4FBF8;border-radius:8px;padding:10px 14px;border:1px solid #D9E8E2;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#617A72;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Disk</div>
          <div style="font-size:15px;font-weight:600;color:#071013">${report.checks.server.disk || 'n/a'}</div>
        </td>
        <td style="background:#F4FBF8;border-radius:8px;padding:10px 14px;border:1px solid #D9E8E2;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#617A72;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Uptime</div>
          <div style="font-size:15px;font-weight:600;color:#071013">${report.checks.server.uptime || 'n/a'}</div>
        </td>
      </tr>
      <tr>
        <td style="background:#F4FBF8;border-radius:8px;padding:10px 14px;border:1px solid #D9E8E2;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#617A72;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Node</div>
          <div style="font-size:15px;font-weight:600;color:#071013">${report.checks.server.nodeVersion || 'n/a'}</div>
        </td>
        <td style="background:#F4FBF8;border-radius:8px;padding:10px 14px;border:1px solid #D9E8E2;vertical-align:top">
          <div style="font-size:10px;font-weight:700;color:#617A72;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Database</div>
          <div style="font-size:15px;font-weight:600;color:#071013">${statusIcon(report.checks.database.status)} ${report.checks.database.status}</div>
          <div style="font-size:11px;color:#617A72;margin-top:2px">${report.checks.database.message}</div>
        </td>
      </tr>
    </table>

    <div class="section-title">AI Providers</div>
    <table class="ai-table">
      <tr><td><span class="name">OpenAI</span></td><td class="status">${statusIcon(report.checks.openai.status)} ${report.checks.openai.message}</td></tr>
      <tr><td><span class="name">Ollama</span></td><td class="status">${statusIcon(report.checks.ollama.status)} ${report.checks.ollama.message}</td></tr>
    </table>

    <div class="section-title">Connectors</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#F4FBF8;border-radius:10px;overflow:hidden;border:1px solid #D9E8E2">
      <tr><th></th><th>Provider</th><th>ID</th><th>Status</th></tr>
      ${connectorRows || '<tr><td colspan="4" style="text-align:center;padding:16px;color:#617A72">No connectors registered</td></tr>'}
    </table>

    <div class="section-title">Connected Sites</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#F4FBF8;border-radius:10px;overflow:hidden;border:1px solid #D9E8E2">
      <tr><th></th><th>Platform</th><th>Domain</th><th>Connection</th><th>Health</th></tr>
      ${siteRows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:#617A72">No sites connected</td></tr>'}
    </table>

    <div class="section-title">Recent Errors</div>
    <table style="width:100%;font-size:13px;background:#F4FBF8;border-radius:10px;overflow:hidden;border:1px solid #D9E8E2">
      <tr><td style="padding:10px 14px;color:#263B37">${statusIcon(report.checks.recentErrors.status)} ${report.checks.recentErrors.message}</td></tr>
    </table>

    ${causesHtml}

    ${actionsHtml}

    <hr>
    <div style="text-align:center;font-size:11px;color:#617A72">
      <span style="background:#F4FBF8;padding:4px 12px;border-radius:20px">Every ${HEARTBEAT_INTERVAL / 60000} min &middot; <a href="${KIVO_PUBLIC_URL}/api/heartbeat/status" style="color:#3BB5FF;text-decoration:none">Live Status</a></span>
    </div>
  </div>
  <div class="footnote">
    Kivo Pulse &middot; Automated system alert &middot; Do not reply<br>
    Generated ${new Date(report.timestamp).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC
  </div>
</div></body></html>`;
  }

  private async sendAlertEmail(report: HeartbeatReport): Promise<void> {
    const failed = [
      report.checks.connectors.details.filter(c => !c.healthy).length > 0 ? `${report.checks.connectors.details.filter(c => !c.healthy).length} connector(s) down` : '',
      report.checks.recentErrors.count > 0 ? `${report.checks.recentErrors.count} errors/h` : '',
      report.checks.database.status === 'down' ? 'DB down' : '',
      report.checks.server.status === 'degraded' ? 'high load' : '',
    ].filter(Boolean).join(', ') || report.status;

    await this.sendEmail({
      subject: `🔴 [Kivo Pulse] ${report.status.toUpperCase()} — ${failed}`,
      html: this.createEmailHtml(report),
    });
  }

  private async sendRecoveryEmail(report: HeartbeatReport): Promise<void> {
    await this.sendEmail({
      subject: `🟢 [Kivo Pulse] All systems recovered — ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      html: this.createEmailHtml(report),
    });
  }

  private async sendEmail(options: { subject: string; html: string }): Promise<void> {
    if (!SMTP_USER || !SMTP_PASS || !EMAIL_TO) {
      logger.warn('HeartbeatService: email not configured, skipping alert', {
        hasUser: !!SMTP_USER,
        hasPass: !!SMTP_PASS,
        hasTo: !!EMAIL_TO,
      });
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_USER,
      to: EMAIL_TO,
      subject: options.subject,
      html: options.html,
    });
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('HeartbeatService not initialized');
    return this.pool;
  }
}

export const heartbeatService = new HeartbeatService();
