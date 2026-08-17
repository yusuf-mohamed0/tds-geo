import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const REPORTING_ROOT = process.env.ADS_REPORTING_PROJECT || '/root/tds-ads-reporting-automation';
const PYTHON_BIN = process.env.ADS_REPORTING_PYTHON || path.join(REPORTING_ROOT, '.venv/bin/python');
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CLIENT_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface AdsReportingClient {
  id: string;
  name: string;
  platforms: string[];
  metaAccounts: string[];
  googleCustomers: string[];
}

export interface AdsReportArtifact {
  clientId: string;
  month: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

function assertSafeClientId(clientId: string): void {
  if (!CLIENT_RE.test(clientId)) throw new Error('Invalid client id');
}

function assertSafeMonth(month: string): void {
  if (!MONTH_RE.test(month)) throw new Error('Invalid month. Use YYYY-MM.');
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseListBlock(block: string, key: string): string[] {
  const idx = block.indexOf(`${key}:`);
  if (idx === -1) return [];
  const nextTopLevel = block.slice(idx + key.length + 1).search(/\n\s{4}[a-z_]+:/);
  const section = nextTopLevel === -1
    ? block.slice(idx)
    : block.slice(idx, idx + key.length + 1 + nextTopLevel);
  return [...section.matchAll(/id:\s*"?([^"\n]+)"?/g)].map((m) => m[1].trim());
}

async function readClients(): Promise<AdsReportingClient[]> {
  const configPath = path.join(REPORTING_ROOT, 'configs/clients.yaml');
  if (!(await exists(configPath))) return [];
  const raw = await fs.readFile(configPath, 'utf8');
  const entries = raw.split(/\n\s{2}-\s+id:\s*/).slice(1);
  return entries.map((entry) => {
    const id = (entry.match(/^([^\n]+)/)?.[1] || '').trim();
    const name = (entry.match(/\n\s{4}name:\s*"?([^"\n]+)"?/)?.[1] || id).trim();
    const metaAccounts = parseListBlock(entry, 'ad_accounts');
    const googleCustomers = parseListBlock(entry, 'customer_ids');
    return {
      id,
      name,
      platforms: [metaAccounts.length ? 'meta' : '', googleCustomers.length ? 'google_ads' : ''].filter(Boolean),
      metaAccounts,
      googleCustomers,
    };
  }).filter((client) => client.id);
}

async function listArtifacts(): Promise<AdsReportArtifact[]> {
  const reportsDir = path.join(REPORTING_ROOT, 'reports');
  if (!(await exists(reportsDir))) return [];
  const files = await fs.readdir(reportsDir);
  const artifacts = await Promise.all(files.filter((file) => file.endsWith('.pdf')).map(async (file) => {
    const filePath = path.join(reportsDir, file);
    const stat = await fs.stat(filePath);
    const match = file.match(/^(.+)_(\d{4}-\d{2})\.pdf$/);
    return {
      clientId: match?.[1] || '',
      month: match?.[2] || '',
      fileName: file,
      path: filePath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  }));
  return artifacts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function runReporter(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env, PYTHONPATH: 'src' };
  const { stdout, stderr } = await execFileAsync(PYTHON_BIN, ['-m', 'tds_ads_reporting.app', ...args], {
    cwd: REPORTING_ROOT,
    env,
    timeout: 180000,
    maxBuffer: 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export const adsReportingService = {
  roles: [
    { role: 'CEO / final approver', owns: 'Approves internal PDFs before any email leaves the company.' },
    { role: 'Ads analyst', owns: 'Runs Meta and Google data pulls, checks spend, results, CTR, CPC, and campaign tables.' },
    { role: 'Data QA reviewer', owns: 'Compares generated figures against platform UI for the same month and attribution settings.' },
    { role: 'Account manager', owns: 'Adds budget, VAT, scope, insights, recommendations, and client-safe narrative.' },
    { role: 'Automation operator', owns: 'Runs dry-runs, generates internal PDFs, and records failures without exposing secrets.' },
  ],

  reviewGates: [
    'No report email is sent from Kivo Geo.',
    'Generated PDFs are internal until CEO/final approval.',
    'One client failure must not block other client reports.',
    'Secrets stay in the local reporting runner .env and never enter API responses.',
    'Google Ads reports remain blocked until Google Ads API credentials and customer IDs exist.',
    'Full Business Suite sections remain blocked until Page and Instagram assets are mapped.',
  ],

  async status() {
    const [projectReady, envReady, clientConfigReady, clients, artifacts] = await Promise.all([
      exists(REPORTING_ROOT),
      exists(path.join(REPORTING_ROOT, '.env')),
      exists(path.join(REPORTING_ROOT, 'configs/clients.yaml')),
      readClients(),
      listArtifacts(),
    ]);

    return {
      projectRoot: REPORTING_ROOT,
      projectReady,
      envReady,
      clientConfigReady,
      clients,
      artifacts,
      roles: this.roles,
      reviewGates: this.reviewGates,
    };
  },

  async dryRun(clientId: string, month: string) {
    assertSafeClientId(clientId);
    assertSafeMonth(month);
    return runReporter(['run', '--client', clientId, '--month', month, '--dry-run']);
  },

  async generateInternal(clientId: string, month: string) {
    assertSafeClientId(clientId);
    assertSafeMonth(month);
    const result = await runReporter(['run', '--client', clientId, '--month', month]);
    return { ...result, artifacts: await listArtifacts() };
  },
};
