// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect } from 'vitest';
import { redactJson, redactJsonString } from '../../utils/redact';

describe('redactJson — webhook payload redaction', () => {
  it('redacts sensitive PII-bearing keys to [REDACTED]', () => {
    const input = {
      email: 'user@example.com',
      phone: '+1-555-0100',
      password: 'hunter2',
      token: 'abc123',
      address: '1 Main St',
      customer: { id: 123, email: 'c@example.com' },
      order: { id: 456, total: 99.5 },
      card: { number: '4111111111111111', cvv: '123' },
      ip_address: '203.0.113.7',
      zip: '10001',
    };
    const result = redactJson(input) as Record<string, unknown>;
    for (const key of Object.keys(input)) {
      expect(result[key]).toBe('[REDACTED]');
    }
  });

  it('redacts sensitive keys inside nested objects and arrays recursively', () => {
    const input = {
      customer: {
        name: 'Jane',
        contact: { email: 'jane@example.com', phone: '555-0100' },
        orders: [
          { id: 1, billing: { address1: '10 Main St', card: { number: '4242' } } },
          { id: 2, shipping: { address2: 'Apt 2' } },
        ],
      },
    };
    const result = redactJson(input) as Record<string, unknown>;
    // Whole `customer` subtree is redacted (customer is a sensitive pattern).
    expect(result.customer).toBe('[REDACTED]');

    // Nested sensitive keys inside a non-sensitive array container are redacted
    // recursively, while non-sensitive neighbors pass through.
    const partial = redactJson({
      payloads: [
        { order_id: 1, contact: { email: 'x@y.z' }, id: 5 },
        { status: 'ok', events: [{ token: 'abc' }] },
      ],
    }) as Record<string, unknown>;
    expect(partial.payloads).toEqual([
      { order_id: '[REDACTED]', contact: { email: '[REDACTED]' }, id: 5 },
      { status: 'ok', events: [{ token: '[REDACTED]' }] },
    ]);
  });

  it('leaves non-sensitive keys untouched, including values', () => {
    const input = {
      id: 1,
      shop: 'test-shop',
      shop_domain: 'test-shop.myshopify.com',
      data_request: { id: 'req-1' },
      topic: 'orders/create',
      status: 'active',
      title: 'Hello',
      url: 'https://example.com/p',
      articleId: 42,
      seoScore: 88,
      traceId: 'trace-1',
      publishUrl: 'https://example.com/x',
      keyword: 'widgets',
      provider: 'openai',
      blogId: 7,
      event: 'orders/update',
      response_code: 200,
      error: null,
      message: 'ok',
      action: 'publish',
      route: '/api/articles',
      method: 'POST',
      statusCode: 201,
      durationMs: 12,
      userAgent: 'mozilla',
      surface: 'web',
      actorType: 'user',
      actorId: 'u-1',
      clientId: 'c-1',
      shopify_shop: 'test-shop',
      shop_name: 'Test Shop',
      requestId: 'r-1',
      customerId: 999,
      articleCount: 5,
      source: 'manual',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      published_at: '2026-01-03T00:00:00Z',
      handle: 'hello',
      tags: ['a', 'b'],
    };
    expect(redactJson(input)).toEqual(input);
  });

  it('passes primitives through unchanged', () => {
    expect(redactJson('plain')).toBe('plain');
    expect(redactJson(42)).toBe(42);
    expect(redactJson(true)).toBe(true);
    expect(redactJson(null)).toBe(null);
    expect(redactJson(undefined)).toBe(undefined);
  });

  it('caps recursion depth to prevent pathological nesting', () => {
    let deep: unknown = { value: 'keep' };
    for (let i = 0; i < 14; i += 1) {
      deep = { nested: deep };
    }
    const result = redactJson(deep) as Record<string, unknown>;
    // Walk down 13 levels: the 14th nested object is beyond the depth cap (12).
    let node: unknown = result;
    for (let i = 0; i < 13; i += 1) {
      node = (node as Record<string, unknown>).nested;
    }
    expect(node).toBe('[REDACTED]');
  });
});

describe('redactJsonString', () => {
  it('returns valid JSON string with sensitive fields redacted', () => {
    const input = { email: 'a@b.com', order_id: 5, shop: 's' };
    const result = redactJsonString(input);
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.email).toBe('[REDACTED]');
    expect(parsed.order_id).toBe('[REDACTED]');
    expect(parsed.shop).toBe('s');
  });

  it('serializes empty and nested payloads', () => {
    expect(redactJsonString({})).toBe('{}');
    const parsed = JSON.parse(redactJsonString({ customer: { email: 'x@y.z' }, id: 3 }));
    expect(parsed).toEqual({ customer: '[REDACTED]', id: 3 });
  });
});