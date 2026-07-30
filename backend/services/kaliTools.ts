import { execSync, exec } from 'child_process';
import { logger } from '../utils/logger';
import resilience from './circuitBreaker';

interface ToolInfo {
  name: string;
  available: boolean;
  version: string;
}

interface ScanResult {
  tool: string;
  target: string;
  success: boolean;
  data: Record<string, unknown>;
  rawOutput: string;
  durationMs: number;
  error?: string;
}

function sanitizeArg(arg: string): string {
  return arg.replace(/['\\]/g, '\\$&');
}

function execAsync(cmd: string, timeout: number, maxBuffer?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout, maxBuffer: maxBuffer || 1024 * 1024, shell: '/bin/bash' }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

class KaliToolService {
  private tools: Map<string, boolean> = new Map();
  private detected = false;

  private async ensureDetected(): Promise<void> {
    if (!this.detected) {
      await this.detectTools();
      this.detected = true;
    }
  }

  async detectTools(): Promise<ToolInfo[]> {
    const toolList = [
      { name: 'wpscan', checkCmd: 'which wpscan 2>/dev/null' },
      { name: 'whatweb', checkCmd: 'which whatweb 2>/dev/null' },
      { name: 'nikto', checkCmd: 'which nikto 2>/dev/null' },
      { name: 'nmap', checkCmd: 'which nmap 2>/dev/null' },
      { name: 'sqlmap', checkCmd: 'which sqlmap 2>/dev/null' },
      { name: 'wapiti', checkCmd: 'which wapiti 2>/dev/null' },
      { name: 'grype', checkCmd: 'which grype 2>/dev/null' },
      { name: 'trivy', checkCmd: 'which trivy 2>/dev/null' },
    ];

    const results: ToolInfo[] = [];

    for (const tool of toolList) {
      try {
        const version = execSync(tool.checkCmd, { timeout: 5000, shell: '/bin/bash' })
          .toString().trim().slice(0, 100) || 'detected';
        this.tools.set(tool.name, true);
        results.push({ name: tool.name, available: true, version });
      } catch {
        this.tools.set(tool.name, false);
        results.push({ name: tool.name, available: false, version: '' });
      }
    }

    logger.info('Kali tools detected', {
      available: results.filter(r => r.available).map(r => r.name).join(', '),
      count: results.filter(r => r.available).length,
    });

    return results;
  }

  isAvailable(tool: string): boolean {
    return this.tools.get(tool) ?? false;
  }

  async runWpscan(url: string, options?: { enumerate?: string }): Promise<ScanResult> {
    await this.ensureDetected();
    const safeUrl = sanitizeArg(url);
    const safeEnumerate = sanitizeArg(options?.enumerate || 'vp,vt');
    return this.runWithCircuitBreaker('wpscan', url, async () => {
      const start = Date.now();
      const cmd = `wpscan --url '${safeUrl}' --enumerate ${safeEnumerate} --no-banner --format json 2>/dev/null`;
      const output = await execAsync(cmd, 120_000, 10 * 1024 * 1024);
      const data = JSON.parse(output);

      return {
        tool: 'wpscan', target: url, success: true,
        data: this.summarizeWpscan(data),
        rawOutput: output.slice(0, 5000),
        durationMs: Date.now() - start,
      };
    });
  }

  async runWhatweb(url: string): Promise<ScanResult> {
    await this.ensureDetected();
    const safeUrl = sanitizeArg(url);
    return this.runWithCircuitBreaker('whatweb', url, async () => {
      const start = Date.now();
      const cmd = `whatweb '${safeUrl}' --colour=never --no-errors -a 3 2>/dev/null`;
      const output = await execAsync(cmd, 30_000);
      const trimmed = output.toString().trim();

      return {
        tool: 'whatweb', target: url, success: true,
        data: { summary: trimmed.slice(0, 1000) },
        rawOutput: trimmed.slice(0, 5000),
        durationMs: Date.now() - start,
      };
    });
  }

  async runNikto(url: string): Promise<ScanResult> {
    await this.ensureDetected();
    const safeUrl = sanitizeArg(url);
    return this.runWithCircuitBreaker('nikto', url, async () => {
      const start = Date.now();
      const cmd = `nikto -h '${safeUrl}' -nointeractive -Format json 2>/dev/null`;
      const output = await execAsync(cmd, 180_000, 5 * 1024 * 1024);

      let findings: Record<string, unknown>[] = [];
      try { findings = JSON.parse(output); } catch {}

      return {
        tool: 'nikto', target: url, success: true,
        data: { findingCount: findings.length, findings: findings.slice(0, 50) },
        rawOutput: output.slice(0, 5000),
        durationMs: Date.now() - start,
      };
    });
  }

  async runNmap(target: string, portRange?: string): Promise<ScanResult> {
    await this.ensureDetected();
    const safeTarget = sanitizeArg(target);
    const safePorts = sanitizeArg(portRange || '80,443,8080,8443,3000,5000,5432,6379');
    return this.runWithCircuitBreaker('nmap', target, async () => {
      const start = Date.now();
      const cmd = `nmap -sV -p ${safePorts} --open -T4 '${safeTarget}' -oX - 2>/dev/null`;
      const output = await execAsync(cmd, 120_000, 2 * 1024 * 1024);

      return {
        tool: 'nmap', target, success: true,
        data: { raw: output.slice(0, 3000) },
        rawOutput: output.slice(0, 5000),
        durationMs: Date.now() - start,
      };
    });
  }

  async scanTarget(target: string): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const domain = target.replace(/^https?:\/\//, '').split('/')[0];

    const fastChecks: Promise<ScanResult | null>[] = [];

    if (this.isAvailable('whatweb')) fastChecks.push(this.runWhatweb(target));
    if (this.isAvailable('nmap')) fastChecks.push(this.runNmap(domain));

    const parallelResults = await Promise.allSettled(fastChecks);
    for (const r of parallelResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }

    if (this.isAvailable('wpscan')) {
      try { results.push(await this.runWpscan(target)); }
      catch (err) { logger.warn('wpscan failed', { target, error: (err as Error).message }); }
    }

    if (this.isAvailable('nikto')) {
      try { results.push(await this.runNikto(target)); }
      catch (err) { logger.warn('nikto failed', { target, error: (err as Error).message }); }
    }

    return results;
  }

  private async runWithCircuitBreaker(
    tool: string,
    target: string,
    fn: () => Promise<ScanResult>
  ): Promise<ScanResult> {
    if (!this.isAvailable(tool)) {
      return {
        tool, target, success: false,
        data: {}, rawOutput: '', durationMs: 0,
        error: `${tool} not available on this server`,
      };
    }

    const result = await resilience.getCircuitBreaker().call(
      `kali-tool-${tool}`,
      fn,
      async () => ({
        tool, target, success: false,
        data: {}, rawOutput: '', durationMs: 0,
        error: `${tool} circuit breaker open`,
      })
    );

    return result;
  }

  private summarizeWpscan(data: any): Record<string, unknown> {
    const vulns = data.vulnerabilities || [];
    return {
      wordpressVersion: data?.version?.number || 'unknown',
      theme: data?.main_theme?.slug || 'unknown',
      pluginCount: data?.plugins ? Object.keys(data.plugins).length : 0,
      vulnerabilityCount: vulns.length,
      criticalVulns: vulns.filter((v: any) => v.critical).length,
      users: (data?.users || []).slice(0, 5),
    };
  }
}

export default new KaliToolService();
