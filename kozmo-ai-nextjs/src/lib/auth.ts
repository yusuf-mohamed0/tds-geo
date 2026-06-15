/**
 * KozmoAI Next.js Integration — API Key Authentication
 *
 * Provides a simple token-based authentication for verifying
 * that incoming requests originate from the KozmoAI platform.
 */

import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';

/** Result of an authentication check */
export interface AuthResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify that a Next.js API request carries a valid KozmoAI API key.
 *
 * The key should be sent as a header:
 *   X-KozmoAI-Key: <your-api-key>
 *
 * Usage in a route handler:
 *   import { verifyRequest } from '@kozmo-ai/nextjs-integration';
 *
 *   export async function POST(request: NextRequest) {
 *     const auth = verifyRequest(request, process.env.KOZMO_AI_API_KEY!);
 *     if (!auth.valid) {
 *       return Response.json({ success: false, error: auth.reason }, { status: 401 });
 *     }
 *     // ... handle request
 *   }
 */
export function verifyRequest(request: NextRequest, expectedApiKey: string): AuthResult {
  if (!expectedApiKey) {
    return {
      valid: false,
      reason: 'KozmoAI API key not configured on server. Set KOZMO_AI_API_KEY environment variable.',
    };
  }

  const providedKey = request.headers.get('x-kozmo-ai-key');

  if (!providedKey) {
    return {
      valid: false,
      reason: 'Missing X-KozmoAI-Key header. All KozmoAI API requests must include this header.',
    };
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(providedKey, expectedApiKey)) {
    return {
      valid: false,
      reason: 'Invalid API key. The X-KozmoAI-Key value did not match the configured key.',
    };
  }

  return { valid: true };
}

/**
 * Verify a webhook signature (HMAC-SHA256).
 * Used for webhook payloads that include a signature header.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) return false;

  const expected = 'sha256=' + hexToHmacSha256(payload, secret);
  return constantTimeCompare(signature, expected);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Pad the shorter string to prevent length-based timing leaks
    const maxLen = Math.max(a.length, b.length);
    a = a.padEnd(maxLen, '\0');
    b = b.padEnd(maxLen, '\0');
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Compute HMAC-SHA256 and return hex digest.
 * Uses Web Crypto API (available in Next.js Edge/Server runtimes).
 */
function hexToHmacSha256(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Async version for Edge runtime (Web Crypto API).
 */
export async function verifyWebhookSignatureAsync(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!secret || !signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const expected = 'sha256=' + hex;

  return constantTimeCompare(signature, expected);
}
