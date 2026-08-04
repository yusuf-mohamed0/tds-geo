// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { SHOPIFY_COMPLIANCE_WEBHOOKS, normalizeWebhookBody, verifyShopifyOAuthHmac, verifyShopifyWebhookHmac } from '../../utils/shopifyWebhook';

describe('shopifyWebhook utils', () => {
  it('normalizes raw buffer bodies', () => {
    expect(normalizeWebhookBody(Buffer.from('{"hello":"world"}'))).toBe('{"hello":"world"}');
  });

  it('verifies Shopify webhook HMAC using the shared secret', () => {
    const rawBody = '{"topic":"app/uninstalled"}';
    const secret = 'shp_test_secret';
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

    expect(verifyShopifyWebhookHmac(rawBody, signature, secret)).toBe(true);
    expect(verifyShopifyWebhookHmac(rawBody, signature, 'wrong_secret')).toBe(false);
    expect(verifyShopifyWebhookHmac(rawBody, undefined, secret)).toBe(false);
  });

  it('verifies Shopify OAuth callback HMAC using the shared secret', () => {
    const secret = 'shp_test_secret';
    const query = {
      code: 'abc123',
      shop: 'example.myshopify.com',
      state: 'state123',
      timestamp: '1710000000',
    };
    const message = Object.keys(query)
      .sort()
      .map((key) => `${key}=${query[key as keyof typeof query]}`)
      .join('&');
    const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');

    expect(verifyShopifyOAuthHmac({ ...query, hmac }, hmac, secret)).toBe(true);
    expect(verifyShopifyOAuthHmac({ ...query, hmac }, hmac, 'wrong_secret')).toBe(false);
  });

  it('exposes the complete Shopify compliance webhook map using a single callback URL', () => {
    expect(SHOPIFY_COMPLIANCE_WEBHOOKS).toEqual([
      { topic: 'customers/data_request', path: '/api/webhooks/compliance' },
      { topic: 'customers/redact', path: '/api/webhooks/compliance' },
      { topic: 'shop/redact', path: '/api/webhooks/compliance' },
      { topic: 'app/uninstalled', path: '/api/webhooks/compliance' },
    ]);
  });
});
