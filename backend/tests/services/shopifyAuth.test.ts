// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encrypt } from '../../services/credentialEncryption';
import { init, refreshIfExpired, forceRefreshToken } from '../../services/shopify/auth';

process.env.CREDENTIAL_VAULT_KEY = 'a'.repeat(64);
process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-secret';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as any;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SHOP = 'test-shop.myshopify.com';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    shopify_token: 'shpat_plaintext_token',
    shopify_refresh_token: 'shpr_plaintext_refresh',
    shopify_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe('shopify auth refreshIfExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    init(mockPool);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('(a) uses a plaintext row token as the config accessToken', async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow()] });

    const config = await refreshIfExpired({ shop: SHOP, accessToken: 'stale-token', apiVersion: '2025-07' });

    expect(config.accessToken).toBe('shpat_plaintext_token');
  });

  it('(b) decrypts a ciphertext row token into the config accessToken', async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow({ shopify_token: encrypt('shpat_encrypted_token') })] });

    const config = await refreshIfExpired({ shop: SHOP, accessToken: 'stale-token', apiVersion: '2025-07' });

    expect(config.accessToken).toBe('shpat_encrypted_token');
  });

  it('(c) near-expiry refresh: uses decrypted refresh token, writes encrypted tokens, never touches cms_connections.config', async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({
        shopify_token: encrypt('shpat_old_token'),
        shopify_refresh_token: encrypt('shpr_encrypted_refresh'),
        shopify_token_expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      })],
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'shpat_new_token', refresh_token: 'shpr_new_refresh', expires_in: 3600 }),
    } as any);

    const config = await refreshIfExpired({ shop: SHOP, accessToken: 'stale-token', apiVersion: '2025-07' });

    expect(config.accessToken).toBe('shpat_new_token');

    // Refresh POST body used the DECRYPTED refresh token.
    const fetchCall = mockFetch.mock.calls[0];
    const body = new URLSearchParams(fetchCall[1].body as string);
    expect(body.get('refresh_token')).toBe('shpr_encrypted_refresh');

    // Write-back stores encrypt()'d tokens.
    const updateCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('UPDATE clients SET shopify_token'));
    expect(updateCall).toBeTruthy();
    const params = updateCall![1];
    expect(params[0]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:/);
    expect(params[1]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:/);

    // cms_connections.config is NOT touched.
    const configCalls = mockQuery.mock.calls.filter(([sql]) => String(sql).includes('UPDATE cms_connections'));
    expect(configCalls).toHaveLength(0);

    // Audit row logged with action 'refresh'.
    const auditCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO credential_access_log'));
    expect(auditCall).toBeTruthy();
    expect(String(auditCall![0])).toContain("'refresh'");
  });
});

describe('shopify auth forceRefreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    init(mockPool);
  });

  it('(a) no active client → failure result', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await forceRefreshToken(SHOP);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No active client for shop');
    expect(result.shop).toBe(SHOP);
    expect(result.rotatedAt).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('(b) no refresh token stored → failure result', async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow({ shopify_refresh_token: null })] });

    const result = await forceRefreshToken(SHOP);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No refresh token stored');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('(c) Shopify rejects the refresh → failure result with status', async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow()] });
    mockFetch.mockResolvedValue({ ok: false, status: 401 } as any);

    const result = await forceRefreshToken(SHOP);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Shopify refresh rejected');
    expect(result.error).toContain('401');
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE clients SET shopify_token'))).toBe(false);
  });

  it('(d) successful rotation updates the clients row and audits action rotate', async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({
        shopify_token: encrypt('shpat_old_token'),
        shopify_refresh_token: encrypt('shpr_encrypted_refresh'),
        shopify_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })],
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'shpat_rotated_token', refresh_token: 'shpr_rotated_refresh', expires_in: 86400 }),
    } as any);

    const result = await forceRefreshToken(SHOP);

    expect(result.success).toBe(true);
    expect(result.shop).toBe(SHOP);
    expect(result.rotatedAt).toBeDefined();
    expect(result.error).toBeUndefined();

    // Refresh POST body used the DECRYPTED refresh token.
    const fetchCall = mockFetch.mock.calls[0];
    const body = new URLSearchParams(fetchCall[1].body as string);
    expect(body.get('refresh_token')).toBe('shpr_encrypted_refresh');

    // Write-back stores encrypt()'d tokens.
    const updateCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('UPDATE clients SET shopify_token'));
    expect(updateCall).toBeTruthy();
    const params = updateCall![1];
    expect(params[0]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:/);
    expect(params[1]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:/);

    // Audit row logged with action 'rotate' and rotatedAt in metadata.
    const auditCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO credential_access_log'));
    expect(auditCall).toBeTruthy();
    expect(String(auditCall![0])).toContain("'rotate'");
    const metadata = JSON.parse(auditCall![1][0]);
    expect(metadata.resource).toBe('clients.shopify_token');
    expect(metadata.shop).toBe(SHOP);
    expect(metadata.rotatedAt).toBeDefined();
  });
});