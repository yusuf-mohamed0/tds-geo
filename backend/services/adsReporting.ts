import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';
import type { Pool } from 'pg';

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
}

export interface AdsReportArtifact {
  clientId: string;
  month: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

export type AdsArtifactStatus = 'generated' | 'in_review' | 'approved' | 'rejected' | 'delivered';

export interface AdsArtifactRegistryRow {
  id: string;
  clientId: string | null;
  month: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  sha256: string | null;
  status: AdsArtifactStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  deliveredTo: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdsRegistryFilters {
  clientId?: string;
  month?: string;
  status?: AdsArtifactStatus;
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

async function fileSha256(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
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
    return {
      id,
      name,
      platforms: metaAccounts.length ? ['meta'] : [],
      metaAccounts,
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
    { role: 'Ads analyst', owns: 'Runs Meta data pulls, checks spend, results, CTR, CPC, and campaign tables.' },
    { role: 'Data QA reviewer', owns: 'Compares generated figures against platform UI for the same month and attribution settings.' },
    { role: 'Account manager', owns: 'Adds budget, VAT, scope, insights, recommendations, and client-safe narrative.' },
    { role: 'Automation operator', owns: 'Runs dry-runs, generates internal PDFs, and records failures without exposing secrets.' },
  ],

  reviewGates: [
    'No report email is sent from Kivo Geo.',
    'Generated PDFs are internal until CEO/final approval.',
    'One client failure must not block other client reports.',
    'Secrets stay in the local reporting runner .env and never enter API responses.',
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

  async runAll(month: string) {
    assertSafeMonth(month);
    const result = await runReporter(['run-all', '--month', month, '--no-cache']);
    return { ...result, artifacts: await listArtifacts() };
  },

  async syncRegistry(pool: Pool): Promise<{ inserted: number; updated: number; total: number }> {
    const artifacts = await listArtifacts();
    let inserted = 0;
    let updated = 0;
    for (const artifact of artifacts) {
      const client = (await readClients()).find((c) => c.id === artifact.clientId);
      const clientLookup = client
        ? await pool.query('SELECT id FROM clients WHERE slug = $1', [artifact.clientId])
        : { rows: [] as { id: string }[] };
      const clientId = clientLookup.rows[0]?.id || null;
      const sha256 = await fileSha256(artifact.path).catch(() => null);
      const result = await pool.query(
        `INSERT INTO ads_artifact_registry (client_id, month, file_name, file_path, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (client_id, month, file_name) DO UPDATE SET
           file_path = EXCLUDED.file_path,
           size_bytes = EXCLUDED.size_bytes,
           sha256 = EXCLUDED.sha256,
           updated_at = NOW()
         RETURNING (xmax = 0) AS was_inserted`,
        [clientId, artifact.month, artifact.fileName, artifact.path, artifact.sizeBytes, sha256]
      );
      if (result.rows[0]?.was_inserted) inserted += 1;
      else updated += 1;
    }
    return { inserted, updated, total: artifacts.length };
  },

  async listRegistry(pool: Pool, filters: AdsRegistryFilters = {}): Promise<AdsArtifactRegistryRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.clientId) { params.push(filters.clientId); where.push(`client_id = $${params.length}`); }
    if (filters.month) { params.push(filters.month); where.push(`month = $${params.length}`); }
    if (filters.status) { params.push(filters.status); where.push(`status = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, client_id, month, file_name, file_path, size_bytes, sha256, status,
              approved_by, approved_at, rejection_reason, delivered_to, delivered_at, created_at, updated_at
       FROM ads_artifact_registry ${whereSql}
       ORDER BY updated_at DESC`,
      params
    );
    return result.rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      month: row.month,
      fileName: row.file_name,
      filePath: row.file_path,
      sizeBytes: Number(row.size_bytes) || 0,
      sha256: row.sha256,
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
      rejectionReason: row.rejection_reason,
      deliveredTo: row.delivered_to,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  },

  async getRegistryEntry(pool: Pool, id: string): Promise<AdsArtifactRegistryRow | null> {
    const result = await pool.query(
      `SELECT id, client_id, month, file_name, file_path, size_bytes, sha256, status,
              approved_by, approved_at, rejection_reason, delivered_to, delivered_at, created_at, updated_at
       FROM ads_artifact_registry WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      clientId: row.client_id,
      month: row.month,
      fileName: row.file_name,
      filePath: row.file_path,
      sizeBytes: Number(row.size_bytes) || 0,
      sha256: row.sha256,
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
      rejectionReason: row.rejection_reason,
      deliveredTo: row.delivered_to,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  },

  async transitionRegistryEntry(
    pool: Pool,
    id: string,
    action: 'approve' | 'reject' | 'deliver',
    options: { approvedBy?: string; rejectionReason?: string; deliveredTo?: string } = {}
  ): Promise<AdsArtifactRegistryRow | null> {
    const entry = await this.getRegistryEntry(pool, id);
    if (!entry) throw new Error('Registry entry not found');

    if (action === 'approve') {
      if (entry.status === 'rejected') throw new Error('Rejected artifacts cannot be approved; regenerate first');
      await pool.query(
        `UPDATE ads_artifact_registry SET status = 'approved', approved_by = $2, approved_at = NOW(), rejection_reason = NULL, updated_at = NOW()
         WHERE id = $1`,
        [id, options.approvedBy || null]
      );
    } else if (action === 'reject') {
      await pool.query(
        `UPDATE ads_artifact_registry SET status = 'rejected', rejection_reason = $2, approved_at = NULL, delivered_to = NULL, delivered_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [id, options.rejectionReason || null]
      );
    } else if (action === 'deliver') {
      if (entry.status !== 'approved') throw new Error('Only approved artifacts can be marked delivered');
      await pool.query(
        `UPDATE ads_artifact_registry SET status = 'delivered', delivered_to = $2, delivered_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [id, options.deliveredTo || null]
      );
    }
    return this.getRegistryEntry(pool, id);
  },
};
