// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Webhook / Activity Payload Redaction
// Recursively strips PII-bearing fields before
// payloads are persisted to activity_logs.metadata
// and activity_events.metadata.
// ──────────────────────────────────────────────

// Sensitive key patterns (case-insensitive substring match on the JSON key name)
const SENSITIVE_KEY_PATTERNS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey',
  'access_token', 'refresh_token', 'authorization', 'auth', 'credential',
  'email', 'phone', 'phone_number', 'mobile', 'address', 'address1', 'address2',
  'city', 'zip', 'postal', 'ssn', 'social_security', 'card', 'cvv', 'cvc',
  'bank', 'account_number', 'routing', 'ip', 'ip_address', 'first_name',
  'last_name', 'full_name', 'customer', 'order', 'billing', 'shipping',
];

// Exact keys (lowercased) that are safe identifiers even though they contain a
// sensitive substring (e.g. `customerId` contains `customer` but is a non-PII id).
const NON_SENSITIVE_EXACT_KEYS = new Set(['customerid']);

const REDACTED = '[REDACTED]';

export function redactJson(value: unknown, depth = 0): unknown {
  // depth cap (e.g. 12) to prevent pathological nesting
  if (depth > 12) return REDACTED;
  if (Array.isArray(value)) return value.map(v => redactJson(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase();
      const sensitive = !NON_SENSITIVE_EXACT_KEYS.has(key)
        && SENSITIVE_KEY_PATTERNS.some(p => key.includes(p));
      if (sensitive) {
        out[k] = REDACTED;
      } else {
        out[k] = redactJson(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

// Convenience: redact then JSON.stringify for metadata columns
export function redactJsonString(value: unknown): string {
  return JSON.stringify(redactJson(value));
}