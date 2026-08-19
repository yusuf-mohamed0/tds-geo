// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery, connect: vi.fn(), end: vi.fn() } as any;

vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logActivity: vi.fn() }));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: () => void) => { req.user = { userId: 'u1', role: 'admin', clientId: 'c1' }; next(); },
  authorize: () => (_req: any, _res: any, next: () => void) => next(),
}));

import { createAdsReportRoutes } from '../../routes/adsReports';
import { adsReportingService } from '../../services/adsReporting';

function dispatchDefault(sql: string): Promise<{ rows: any[]; rowCount: number }> {
  if (sql.includes('INSERT INTO ads_artifact_registry')) {
    return Promise.resolve({ rows: [{ was_inserted: true }], rowCount: 1 });
  }
  if (sql.includes('FROM ads_artifact_registry')) {
    return Promise.resolve({
      rows: [{
        id: 'reg-1', client_id: 'c1', month: '2026-07', file_name: 'alamein-2022_2026-07.pdf',
        file_path: '/tmp/reports/alamein-2022_2026-07.pdf', size_bytes: 1024, sha256: 'abc',
        status: 'generated', approved_by: null, approved_at: null, rejection_reason: null,
        delivered_to: null, delivered_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }],
      rowCount: 1,
    });
  }
  if (sql.includes('SELECT id FROM clients')) {
    return Promise.resolve({ rows: [{ id: 'c1' }], rowCount: 1 });
  }
  return Promise.resolve({ rows: [], rowCount: 0 });
}

describe('Ads Report Registry Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQuery.mockImplementation(dispatchDefault);
    app = express();
    app.use(express.json());
    app.use('/api/ads-reports', createAdsReportRoutes(mockPool));
  });

  it('GET /registry lists registry entries', async () => {
    const res = await request(app).get('/api/ads-reports/registry');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].fileName).toBe('alamein-2022_2026-07.pdf');
    expect(res.body[0].status).toBe('generated');
  });

  it('POST /registry/:id/approve transitions to approved', async () => {
    const res = await request(app).post('/api/ads-reports/registry/reg-1/approve');
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'approved'"),
      ['reg-1', 'u1']
    );
  });

  it('POST /registry/:id/reject records rejection reason', async () => {
    const res = await request(app).post('/api/ads-reports/registry/reg-1/reject').send({ reason: 'figures mismatch' });
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'rejected'"),
      ['reg-1', 'figures mismatch']
    );
  });

  it('GET /registry/:id returns 404 for unknown entry', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM ads_artifact_registry WHERE id = $1')) return Promise.resolve({ rows: [], rowCount: 0 });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const res = await request(app).get('/api/ads-reports/registry/nope');
    expect(res.status).toBe(404);
  });

  it('service exposes status with roles and review gates', async () => {
    const status = adsReportingService.status;
    expect(typeof status).toBe('function');
    expect(adsReportingService.reviewGates.length).toBeGreaterThan(0);
    expect(adsReportingService.roles.some((r) => r.role.includes('CEO'))).toBe(true);
  });

  it('POST /run-all generates the combined portfolio report and syncs registry', async () => {
    vi.spyOn(adsReportingService, 'runAll').mockResolvedValue({ ok: true, exitCode: 0, stdout: 'ok combined (33/33 clients)', stderr: '', artifacts: [] });
    vi.spyOn(adsReportingService, 'syncRegistry').mockResolvedValue({ inserted: 34, updated: 0, total: 34 });
    const res = await request(app).post('/api/ads-reports/run-all').send({ month: '2026-07' });
    expect(res.status).toBe(200);
    expect(res.body.stdout).toContain('combined');
    expect(res.body.synced.total).toBe(34);
    expect(adsReportingService.runAll).toHaveBeenCalledWith('2026-07');
  });
});