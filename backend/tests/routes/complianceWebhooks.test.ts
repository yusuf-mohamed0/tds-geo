// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import express from 'express';

// Module-level env so the route module picks these up on (dynamic) import.
process.env.SHOPIFY_API_SECRET = 'test-secret';
process.env.SHOPIFY_APP_URL = 'https://app.example.com';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery, connect: vi.fn(), end: vi.fn() } as any;

vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logActivity: vi.fn() }));
vi.mock('../../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: () => void) => next(),
}));

const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({ default: { post: (...args: any[]) => mockAxiosPost(...args) } }));

const SHOP = 'test-shop.myshopify.com';
const TOPICS = ['customers/data_request', 'customers/redact', 'shop/redact', 'app/uninstalled'] as const;

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', 'test-secret').update(rawBody).digest('base64');
}

function dispatchDefault(sql: string): Promise<{ rows: any[]; rowCount: number }> {
  // Must be checked BEFORE the client lookup branch — the articles query contains
  // a `SELECT id FROM clients` subquery that would otherwise match first.
  if (sql.includes('SELECT id, title, created_at FROM articles')) {
    return Promise.resolve({
      rows: [
        { id: 'a1', title: 'Article One', created_at: new Date().toISOString() },
        { id: 'a2', title: 'Article Two', created_at: new Date().toISOString() },
      ],
      rowCount: 2,
    });
  }
  if (sql.includes('SELECT id FROM clients')) {
    return Promise.resolve({ rows: [{ id: 'client-1' }], rowCount: 1 });
  }
  return Promise.resolve({ rows: [], rowCount: 1 });
}

describe('Compliance Webhook Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQuery.mockImplementation(dispatchDefault);
    mockAxiosPost.mockReset();
    mockAxiosPost.mockResolvedValue({ status: 201, data: { webhook: { id: 1 } } });

    app = express();
    // Replicate backend/index.ts: only /subscribe gets JSON body parsing; the
    // webhook receiver handles raw bodies itself for HMAC verification.
    app.use('/api/webhooks/compliance', (req, res, next) => {
      if (req.path === '/subscribe') return express.json()(req, res, next);
      next();
    });
    const { createComplianceWebhookRoutes } = await import('../../routes/complianceWebhooks');
    app.use('/api/webhooks/compliance', createComplianceWebhookRoutes(mockPool));
  });

  function postWebhook(topic: string, body: unknown, hmacOverride?: string) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    let req = request(app)
      .post('/api/webhooks/compliance')
      .set('Content-Type', 'application/json')
      .set('x-shopify-topic', topic);
    if (hmacOverride !== '') {
      req = req.set('x-shopify-hmac-sha256', hmacOverride ?? sign(rawBody));
    }
    return req.send(rawBody);
  }

  it('returns 401 when the HMAC signature is invalid', async () => {
    const res = await postWebhook('app/uninstalled', { shop: SHOP }, 'deadbeef');
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('app/uninstalled deactivates the client and cleans up related rows', async () => {
    const res = await postWebhook('app/uninstalled', { shop: SHOP });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const sqlCalls = mockQuery.mock.calls.map(([sql]) => String(sql));

    // Client deactivation
    expect(sqlCalls.some((s) => s.includes('UPDATE clients SET is_active = false, billing_status'))).toBe(true);
    // CMS connection + connected site cleanup
    expect(sqlCalls.some((s) => s.includes('UPDATE cms_connections SET is_active = false'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('UPDATE connected_sites SET connection_status'))).toBe(true);
    // Webhook registrations + queued publishing work removal
    expect(sqlCalls.some((s) => s.includes('DELETE FROM webhooks WHERE client_id'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('DELETE FROM publishing_queue WHERE client_id'))).toBe(true);
    // Billing event recorded
    expect(sqlCalls.some((s) => s.includes('INSERT INTO billing_events'))).toBe(true);
  });

  it('customers/data_request returns only the requesting shop data', async () => {
    const res = await postWebhook('customers/data_request', {
      shop_domain: SHOP,
      customer: { id: 123 },
      data_request: { id: 'req-1' },
    });

    expect(res.status).toBe(200);
    expect(res.body.shopify_domain).toBe(SHOP);
    expect(res.body.customer_id).toBe(123);
    expect(res.body.request_id).toBe('req-1');
    expect(res.body.data.articles).toHaveLength(2);
    expect(res.body.data.article_count).toBe(2);

    // The articles query must be scoped to the requesting shop's client only.
    const articlesCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('SELECT id, title, created_at FROM articles'));
    expect(articlesCall).toBeTruthy();
    expect(String(articlesCall![0])).toContain('WHERE client_id IN (SELECT id FROM clients WHERE shopify_shop = $1)');
    expect(articlesCall![1]).toEqual([SHOP]);

    // Acknowledged via activity log.
    const logCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO activity_logs'));
    expect(logCall).toBeTruthy();
  });

  it('customers/redact acknowledges without erasing other data', async () => {
    const res = await postWebhook('customers/redact', { shop_domain: SHOP, customer: { id: 123 } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const logCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO activity_logs'));
    expect(logCall).toBeTruthy();
    // No articles/queue deletion for a customer redact.
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM articles'))).toBe(false);
  });

  it('shop/redact erases articles and related shop rows', async () => {
    const res = await postWebhook('shop/redact', { shop_domain: SHOP });

    expect(res.status).toBe(200);
    const sqlCalls = mockQuery.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.some((s) => s.includes('UPDATE clients SET is_active = false, brand_voice'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('DELETE FROM articles WHERE client_id'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('DELETE FROM article_images WHERE client_id'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('DELETE FROM publishing_history WHERE client_id'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('DELETE FROM publishing_queue WHERE client_id'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('DELETE FROM content_embeddings WHERE client_id'))).toBe(true);
  });

  it('POST /subscribe registers all four topics at the single compliance URL', async () => {
    const res = await request(app)
      .post('/api/webhooks/compliance/subscribe')
      .send({ shop: SHOP, accessToken: 'shpat_token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toHaveLength(4);

    expect(mockAxiosPost).toHaveBeenCalledTimes(4);
    for (const call of mockAxiosPost.mock.calls) {
      const url = call[0] as string;
      const payload = call[1] as { webhook: { topic: string; address: string } };
      expect(url).toContain(`https://${SHOP}/admin/api/2025-07/webhooks.json`);
      expect(payload.webhook.address).toBe('https://app.example.com/api/webhooks/compliance');
    }

    const registeredTopics = mockAxiosPost.mock.calls.map((c) => (c[1] as { webhook: { topic: string } }).webhook.topic);
    expect(registeredTopics.sort()).toEqual([...TOPICS].sort());
  });

  it('rawBodyCapture reassembles a multi-byte character split across chunk writes without corrupting utf8', async () => {
    const { rawBodyCapture } = await import('../../routes/complianceWebhooks');

    const handlers: Record<string, (chunk?: Buffer) => void> = {};
    const req: any = {
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => { handlers[event] = cb; }),
    };
    const next = vi.fn();

    rawBodyCapture(req, {} as any, next);

    // `{"a":"😀"}` where 😀 (U+1F600) is UTF-8 bytes F0 9F 98 80.
    // The emoji is split mid-sequence across the two simulated TCP chunks.
    handlers.data(Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xf0])); // {"a": + first byte of 😀
    handlers.data(Buffer.from([0x9f, 0x98, 0x80, 0x22, 0x7d]));            // rest of 😀 + "}
    handlers.end();

    // Raw body must decode to the ORIGINAL utf8 (no replacement chars), so the
    // HMAC computed over it matches what Shopify signed.
    expect(req.rawBody).toBe('{"a":"😀"}');
    expect(sign(req.rawBody)).toBe(sign('{"a":"😀"}'));
    expect(req.body).toEqual({ a: '😀' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
