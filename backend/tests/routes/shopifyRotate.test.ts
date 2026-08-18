// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Shopify Admin Rotate Routes Tests
// Covers POST /api/admin/shopify/rotate (single + bulk)
// and GET /api/admin/shopify/rotation-status, plus
// 401/403 authz gating.
// ══════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Hoisted state shared with the hoisted vi.mock factories below.
const state = vi.hoisted(() => ({
  verifyRole: 'admin' as string,
  forceRefresh: vi.fn(),
}));

// Mock JWT so authenticate() resolves without a real secret/token.
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('test-jwt-token'),
    verify: vi.fn().mockImplementation(() => ({
      userId: 'test-admin',
      email: 'admin@test.com',
      role: state.verifyRole,
      clientId: null,
    })),
  },
}));

// Mock the rotation service so route shapes are tested in isolation
// (service behavior is covered by tests/services/shopifyAuth.test.ts).
vi.mock('../../services/shopify/auth', () => ({
  forceRefreshToken: state.forceRefresh,
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logActivity: vi.fn(),
}));

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as any;

const SHOP = 'test-shop.myshopify.com';
const AUTH = 'Bearer test-jwt-token';

// Dispatch pool.query by SQL shape so one mock serves every endpoint.
function sqlDispatch(sql: string, _params?: any[]) {
  if (sql.includes('SELECT shopify_shop FROM clients')) {
    return Promise.resolve({
      rows: [
        { shopify_shop: 'shop-a.myshopify.com' },
        { shopify_shop: 'shop-b.myshopify.com' },
      ],
    });
  }
  if (sql.includes('FROM clients c')) {
    return Promise.resolve({
      rows: [
        { shopify_shop: 'shop-a.myshopify.com', shopify_token_expires_at: new Date(Date.now() + 60 * 1000).toISOString(), rotation_days: 30 },
        { shopify_shop: 'shop-b.myshopify.com', shopify_token_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), rotation_days: 30 },
      ],
    });
  }
  return Promise.resolve({ rows: [], rowCount: 0 });
}

describe('Shopify Admin Rotate Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    state.verifyRole = 'admin';
    state.forceRefresh.mockReset();
    mockQuery.mockReset();
    mockQuery.mockImplementation(sqlDispatch);

    app = express();
    app.use(express.json());
    const { createAdminRoutes } = await import('../../routes/admin');
    app.use('/api/admin', createAdminRoutes(mockPool));
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/admin/shopify/rotate').send({ shop: SHOP });

    expect(res.status).toBe(401);
    expect(state.forceRefresh).not.toHaveBeenCalled();
  });

  it('rejects non-admin roles with 403', async () => {
    state.verifyRole = 'editor';
    const res = await request(app)
      .post('/api/admin/shopify/rotate')
      .send({ shop: SHOP })
      .set('Authorization', AUTH);

    expect(res.status).toBe(403);
    expect(state.forceRefresh).not.toHaveBeenCalled();
  });

  it('POST with shop → 200 success shape and delegates to forceRefreshToken', async () => {
    state.forceRefresh.mockResolvedValue({ success: true, shop: SHOP, rotatedAt: '2026-08-18T00:00:00.000Z' });

    const res = await request(app)
      .post('/api/admin/shopify/rotate')
      .send({ shop: SHOP })
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { shop: SHOP, rotatedAt: '2026-08-18T00:00:00.000Z' },
    });
    expect(state.forceRefresh).toHaveBeenCalledWith(SHOP);
  });

  it('POST with shop → 400 with error when rotation fails', async () => {
    state.forceRefresh.mockResolvedValue({
      success: false,
      shop: SHOP,
      rotatedAt: '2026-08-18T00:00:00.000Z',
      error: 'No refresh token stored',
    });

    const res = await request(app)
      .post('/api/admin/shopify/rotate')
      .send({ shop: SHOP })
      .set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No refresh token stored' });
  });

  it('POST without shop → 200 aggregate shape with per-shop results', async () => {
    state.forceRefresh
      .mockResolvedValueOnce({ success: true, shop: 'shop-a.myshopify.com', rotatedAt: '2026-08-18T00:00:00.000Z' })
      .mockResolvedValueOnce({
        success: false,
        shop: 'shop-b.myshopify.com',
        rotatedAt: '2026-08-18T00:00:00.000Z',
        error: 'No refresh token stored',
      });

    const res = await request(app)
      .post('/api/admin/shopify/rotate')
      .send({})
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.rotated).toBe(1);
    expect(res.body.data.failed).toBe(1);
    expect(res.body.data.results[0]).toEqual({
      success: true,
      shop: 'shop-a.myshopify.com',
      rotatedAt: '2026-08-18T00:00:00.000Z',
    });
    expect(res.body.data.results[1]).toEqual({
      success: false,
      shop: 'shop-b.myshopify.com',
      rotatedAt: '2026-08-18T00:00:00.000Z',
      error: 'No refresh token stored',
    });
  });

  it('POST with empty shop → 400', async () => {
    const res = await request(app)
      .post('/api/admin/shopify/rotate')
      .send({ shop: '' })
      .set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('shop');
    expect(state.forceRefresh).not.toHaveBeenCalled();
  });

  it('GET rotation-status → 200 with dueNow/dueSoon split', async () => {
    const res = await request(app)
      .get('/api/admin/shopify/rotation-status')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dueNow).toHaveLength(1);
    expect(res.body.data.dueSoon).toHaveLength(1);
    expect(res.body.data.dueNow[0].shop).toBe('shop-a.myshopify.com');
    expect(res.body.data.dueNow[0].expiresAt).toBeDefined();
    expect(res.body.data.dueSoon[0].shop).toBe('shop-b.myshopify.com');
    expect(res.body.data.dueSoon[0].expiresAt).toBeDefined();
  });
});
