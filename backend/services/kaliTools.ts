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

class KaliToolService {
  private tools: Map<string, boolean> = new Map();

  async detectTools(): Promise<ToolInfo[]> {
    const toolList = [
      { name: 'wpscan', checkCmd: 'wpscan --version 2>/dev/null | head -1' },
      { name: 'whatweb', checkCmd: 'whatweb --version 2>&1 | head -1' },
      { name: 'nikto', checkCmd: 'nikto -Version 2>&1 | head -1' },
      { name: 'nmap', checkCmd: 'nmap --version 2>&1 | head -1' },
      { name: 'sqlmap', checkCmd: 'sqlmap --version 2>&1 | head -1' },
      { name: 'wapiti', checkCmd: 'wapiti --version 2>&1 | head -1' },
      { name: 'grype', checkCmd: 'grype version 2>&1 | head -1' },
      { name: 'trivy', checkCmd: 'trivy --version 2>&1 | head -2 | tail -1' },
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
    return this.runWithCircuitBreaker('wpscan', url, async () => {
      const enumerate = options?.enumerate || 'vp,vt';
      const start = Date.now();
      const cmd = `wpscan --url "${url}" --enumerate ${enumerate} --no-banner --format json 2>/dev/null`;
      const output = execSync(cmd, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024, shell: '/bin/bash' }).toString();
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
    return this.runWithCircuitBreaker('whatweb', url, async () => {
      const start = Date.now();
      const cmd = `whatweb "${url}" --colour=never --no-errors -a 3 2>/dev/null`;
      const output = execSync(cmd, { timeout: 30_000, shell: '/bin/bash' }).toString().trim();

      const plugins: Record<string, unknown> = {};
      const match = output.match(/\{[^}]+\}/);
      if (match) {
        try { Object.assign(plugins, JSON.parse(match[0])); } catch {}
      }

      return {
        tool: 'whatweb', target: url, success: true,
        data: {
          summary: output.slice(0, 1000),
          plugins,
          techStack: Object.keys(plugins),
        },
        rawOutput: output.slice(0, 5000),
        durationMs: Date.now() - start,
      };
    });
  }

  async runNikto(url: string): Promise<ScanResult> {
    return this.runWithCircuitBreaker('nikto', url, async () => {
      const start = Date.now();
      const cmd = `nikto -h "${url}" -nointeractive -Format json 2>/dev/null`;
      const output = execSync(cmd, { timeout: 180_000, maxBuffer: 5 * 1024 * 1024, shell: '/bin/bash' }).toString();

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
    return this.runWithCircuitBreaker('nmap', target, async () => {
      const ports = portRange || '80,443,8080,8443,3000,5000,5432,6379';
      const start = Date.now();
      const cmd = `nmap -sV -p ${ports} --open -T4 "${target}" -oX - 2>/dev/null`;
      const output = execSync(cmd, { timeout: 120_000, maxBuffer: 2 * 1024 * 1024, shell: '/bin/bash' }).toString();

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

    // Run all available tools in parallel
    const checks: Promise<ScanResult | null>[] = [];

    if (this.isAvailable('whatweb')) checks.push(this.runWhatweb(target));
    if (this.isAvailable('nmap')) checks.push(this.runNmap(domain));

    // wpscan and nikto are sequential (longer running)
    const parallelResults = await Promise.allSettled(checks);
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
