// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import express from 'express';

// Module-level env so the route module picks these up on (dynamic) import.
process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-secret';
process.env.SHOPIFY_APP_URL = 'https://app.example.com';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery, connect: vi.fn(), end: vi.fn() } as any;

vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logActivity: vi.fn() }));
vi.mock('../../services/sitesService', () => ({
  sitesService: { register: vi.fn().mockResolvedValue({ id: 'site-1' }) },
}));
vi.mock('../../connector-manager', () => ({
  connectorManager: { get: vi.fn().mockReturnValue({ connect: vi.fn().mockResolvedValue(true) }) },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SHOP = 'test-shop.myshopify.com';

// Dispatch pool.query by SQL shape so one mock serves the whole callback flow.
function sqlDispatch(sql: string, _params?: any[]) {
  if (sql.includes('INSERT INTO shopify_oauth_states')) {
    return Promise.resolve({ rows: [], rowCount: 1 });
  }
  if (sql.includes('DELETE FROM shopify_oauth_states')) {
    // Return a matching stored row — valid by default; tests override for negatives.
    return Promise.resolve({ rows: [{ shop: SHOP }] });
  }
  if (sql.includes('UPDATE clients') && sql.includes('shopify_token')) {
    return Promise.resolve({ rows: [{ id: 'client-1' }], rowCount: 1 });
  }
  if (sql.includes('UPDATE clients SET name')) {
    return Promise.resolve({ rows: [], rowCount: 1 });
  }
  if (sql.includes('SELECT id FROM cms_connections')) {
    return Promise.resolve({ rows: [{ id: 'conn-1' }] });
  }
  if (sql.includes('UPDATE cms_connections')) {
    return Promise.resolve({ rows: [], rowCount: 1 });
  }
  if (sql.includes('INSERT INTO cms_connections')) {
    return Promise.resolve({ rows: [{ id: 'conn-1' }], rowCount: 1 });
  }
  return Promise.resolve({ rows: [], rowCount: 0 });
}

function fetchDispatch(url: string, init?: RequestInit) {
  if (url.includes('/admin/oauth/access_token')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ access_token: 'shpat_test_token', refresh_token: 'shpr_test_refresh', expires_in: 3600, scope: 'read_content' }),
    } as any);
  }
  if (url.includes('webhooks.json')) {
    if ((init?.method || 'GET') === 'GET') {
      return Promise.resolve({ ok: true, json: async () => ({ webhooks: [] }) } as any);
    }
    return Promise.resolve({ ok: true, json: async () => ({ webhook: { id: 1 } }) } as any);
  }
  if (url.includes('shop.json')) {
    return Promise.resolve({ ok: true, json: async () => ({ shop: { name: 'Test Store' } }) } as any);
  }
  return Promise.resolve({ ok: false, status: 404, text: async () => 'not found' } as any);
}

function buildCallbackQuery(overrides: Record<string, string> = {}) {
  const query: Record<string, string> = {
    code: 'auth-code-123',
    shop: SHOP,
    state: 'valid-state-token',
    host: 'test-host',
    timestamp: '1710000000',
    ...overrides,
  };
  const message = Object.keys(query)
    .filter((k) => k !== 'hmac')
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&');
  const hmac = crypto.createHmac('sha256', 'test-secret').update(message).digest('hex');
  return { ...query, hmac };
}

describe('Shopify Install Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQuery.mockImplementation(sqlDispatch);
    mockFetch.mockReset();
    mockFetch.mockImplementation(fetchDispatch as any);
    vi.stubGlobal('fetch', mockFetch);

    app = express();
    app.use(express.urlencoded({ extended: true }));
    const { createShopifyInstallRoutes } = await import('../../routes/shopifyInstall');
    app.use('/api/shopify', createShopifyInstallRoutes(mockPool));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('GET /api/shopify/install', () => {
    it('stores a state row and redirects to the Shopify authorize URL', async () => {
      const res = await request(app).get('/api/shopify/install').query({ shop: SHOP });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(`https://${SHOP}/admin/oauth/authorize`);
      expect(res.headers.location).toContain('client_id=test-api-key');
      expect(res.headers.location).toContain('state=');

      const insertCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO shopify_oauth_states'));
      expect(insertCall).toBeTruthy();
      expect(insertCall![1]).toEqual([expect.any(String), SHOP]);
    });

    it('rejects an invalid shop name', async () => {
      const res = await request(app).get('/api/shopify/install').query({ shop: 'not-a-shop' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error?msg=invalid_shop');
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/shopify/callback', () => {
    it('succeeds with a valid HMAC + stored state and consumes the state row', async () => {
      const q = buildCallbackQuery();
      const res = await request(app).get('/api/shopify/callback').query(q);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('connected=1');

      // State row must be consumed (DELETE ... RETURNING) after validation.
      const deleteCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('DELETE FROM shopify_oauth_states'));
      expect(deleteCall).toBeTruthy();
      expect(deleteCall![1]).toEqual(['valid-state-token']);

      // Token exchange must have been attempted.
      const tokenCall = mockFetch.mock.calls.find(([url]) => String(url).includes('/admin/oauth/access_token'));
      expect(tokenCall).toBeTruthy();
    });

    it('rejects an unknown state token', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('DELETE FROM shopify_oauth_states')) return Promise.resolve({ rows: [] });
        return sqlDispatch(sql);
      });

      const q = buildCallbackQuery({ state: 'unknown-state' });
      const res = await request(app).get('/api/shopify/callback').query(q);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error?msg=invalid_state');
    });

    it('stores encrypted tokens in clients and no token keys in cms_connections.config', async () => {
      const q = buildCallbackQuery();
      const res = await request(app).get('/api/shopify/callback').query(q);

      expect(res.status).toBe(302);

      // clients.shopify_token / shopify_refresh_token are stored as ciphertext.
      const updateClients = mockQuery.mock.calls.find(
        ([sql]) => String(sql).includes('UPDATE clients') && String(sql).includes('shopify_token')
      );
      expect(updateClients).toBeTruthy();
      const params = updateClients![1];
      expect(params[0]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:/);
      expect(params[1]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:/);

      // cms_connections.config holds only non-secret fields.
      const connUpdate = mockQuery.mock.calls.find(([sql]) => String(sql).includes('UPDATE cms_connections'));
      expect(connUpdate).toBeTruthy();
      const config = JSON.parse(connUpdate![1][1]);
      expect(config.shop).toBe(SHOP);
      expect(config.apiVersion).toBe('2025-07');
      expect(config).not.toHaveProperty('accessToken');
      expect(config).not.toHaveProperty('access_token');
      expect(config).not.toHaveProperty('token');
    });

    it('rejects a state token that was issued for a different shop', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('DELETE FROM shopify_oauth_states')) {
          return Promise.resolve({ rows: [{ shop: 'other-shop.myshopify.com' }] });
        }
        return sqlDispatch(sql);
      });

      const q = buildCallbackQuery();
      const res = await request(app).get('/api/shopify/callback').query(q);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error?msg=invalid_state');
    });

    it('rejects a request with an invalid HMAC', async () => {
      const q = buildCallbackQuery();
      const res = await request(app).get('/api/shopify/callback').query({ ...q, hmac: 'deadbeef' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error?msg=invalid_hmac');
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});
