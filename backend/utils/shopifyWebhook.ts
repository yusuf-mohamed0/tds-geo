// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import crypto from 'crypto';

// All four compliance topics are delivered to the SAME callback URL that
// matches the mounted route (backend/index.ts: app.use('/api/webhooks/compliance',
// createComplianceWebhookRoutes(pool))) — a single POST / handler that routes on
// the `x-shopify-topic` header.
export const SHOPIFY_COMPLIANCE_WEBHOOKS = [
  { topic: 'customers/data_request', path: '/api/webhooks/compliance' },
  { topic: 'customers/redact', path: '/api/webhooks/compliance' },
  { topic: 'shop/redact', path: '/api/webhooks/compliance' },
  { topic: 'app/uninstalled', path: '/api/webhooks/compliance' },
] as const;

export function normalizeWebhookBody(body: unknown, rawBody?: unknown): string {
  if (typeof rawBody === 'string') return rawBody;
  if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf8');
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  if (body == null) return '';
  return JSON.stringify(body);
}

export function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string | string[] | undefined,
  secret: string = process.env.SHOPIFY_API_SECRET || ''
): boolean {
  const signature = Array.isArray(hmacHeader) ? hmacHeader[0] : hmacHeader;
  if (!signature || !secret) return false;

  try {
    const calculated = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const expected = Buffer.from(calculated, 'base64');
    const actual = Buffer.from(signature, 'base64');

    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function verifyShopifyOAuthHmac(
  query: Record<string, string | string[] | undefined>,
  hmacHeader: string | string[] | undefined,
  secret: string = process.env.SHOPIFY_API_SECRET || ''
): boolean {
  const signature = Array.isArray(hmacHeader) ? hmacHeader[0] : hmacHeader;
  if (!signature || !secret) return false;

  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => {
      const value = query[key];
      return `${key}=${Array.isArray(value) ? value[0] : value ?? ''}`;
    })
    .join('&');

  try {
    const calculated = crypto.createHmac('sha256', secret).update(message).digest('hex');
    const expected = Buffer.from(calculated, 'utf8');
    const actual = Buffer.from(signature, 'utf8');

    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
