// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hardenShopifyTokensAtBoot } from '../../services/shopifyTokenVault';
import { encrypt, decrypt } from '../../services/credentialEncryption';

function makePool(rows: any[]) {
  const calls: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM clients')) return { rows };
      if (sql.includes('UPDATE clients SET shopify_token')) return { rows: [] };
      if (sql.includes('UPDATE clients SET shopify_refresh_token')) return { rows: [] };
      if (sql.includes('INSERT INTO credential_vault')) return { rows: [{ id: 'v1' }] };
      return { rows: [] };
    }),
  };
  return { pool, calls };
}

describe('hardenShopifyTokensAtBoot', () => {
  beforeEach(() => {
    vi.stubEnv('CREDENTIAL_VAULT_KEY', 'a'.repeat(64));
  });

  it('encrypts plaintext shopify_token and shopify_refresh_token in place', async () => {
    const { pool, calls } = makePool([
      { id: 'c1', name: 'Test', slug: 'test', shopify_shop: 'test.myshopify.com', shopify_token: 'plain-token', shopify_refresh_token: 'plain-refresh' },
    ]);
    const result = await hardenShopifyTokensAtBoot(pool);

    expect(result.encrypted).toBe(1);
    const tokenUpdate = calls.find((c: any) => c.sql.includes('UPDATE clients SET shopify_token'));
    const refreshUpdate = calls.find((c: any) => c.sql.includes('UPDATE clients SET shopify_refresh_token'));
    expect(tokenUpdate).toBeDefined();
    expect(decrypt(tokenUpdate.params[0])).toBe('plain-token');
    expect(refreshUpdate).toBeDefined();
    expect(decrypt(refreshUpdate.params[0])).toBe('plain-refresh');
  });

  it('skips already-encrypted (ciphertext) tokens', async () => {
    const cipherToken = encrypt('already-encrypted');
    const { pool, calls } = makePool([
      { id: 'c2', name: 'Test2', slug: 'test2', shopify_shop: 'test2.myshopify.com', shopify_token: cipherToken, shopify_refresh_token: null },
    ]);
    const result = await hardenShopifyTokensAtBoot(pool);

    expect(result.encrypted).toBe(0);
    expect(calls.some((c: any) => c.sql.includes('UPDATE clients SET shopify_token'))).toBe(false);
  });

  it('creates a masked vault policy row per client', async () => {
    const { pool, calls } = makePool([
      { id: 'c3', name: 'Test3', slug: 'test3', shopify_shop: 'test3.myshopify.com', shopify_token: 'shpat_1234567890abcdef', shopify_refresh_token: null },
    ]);
    const result = await hardenShopifyTokensAtBoot(pool);

    expect(result.vaultRows).toBe(1);
    const vaultInsert = calls.find((c: any) => c.sql.includes('INSERT INTO credential_vault'));
    expect(vaultInsert).toBeDefined();
    expect(vaultInsert.params[0]).toBe('c3');
    expect(vaultInsert.params[1]).toBe('Shopify OAuth — test3.myshopify.com');
    // masked_password must NOT contain the plaintext
    expect(String(vaultInsert.params[2])).not.toContain('shpat_1234567890abcdef');
    // rotation_days is a literal 30 in the SQL (not a bound param)
    expect(vaultInsert.sql).toContain(', 30');
  });

  it('does not throw on DB errors (non-fatal)', async () => {
    const pool: any = { query: vi.fn(async () => { throw new Error('boom'); }) };
    const result = await hardenShopifyTokensAtBoot(pool);
    expect(result).toEqual({ encrypted: 0, vaultRows: 0 });
  });
});
