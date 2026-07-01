# Security Model

## Layers of Security

The app has **multiple overlapping security layers**:

```
Internet
  │
  ▼
Nginx (TLS/SSL)
  │
  ▼
Global Rate Limiter (500 req/15min)
  │
  ▼
VPN Check (requires VPN or excluded path)
  │
  ▼
IP Whitelist (optional)
  │
  ▼
CORS (restricted origins)
  │
  ▼
Helmet (HTTP headers, CSP)
  │
  ▼
Auth Middleware (JWT or API key)
  │
  ▼
Role Authorization (super_admin / admin / editor / client)
  │
  ▼
Client Access Check (tenant isolation)
  │
  ▼
Rate Limit (per-client, configurable)
  │
  ▼
Webhook HMAC Verification (Shopify compliance)
```

## VPN Access Control

Most API routes require VPN access. **Excluded paths** (no VPN needed):

| Path | Reason |
|---|---|
| `/api/shopify/*` | Shopify OAuth callbacks |
| `/api/webhooks/*` | Shopify webhook deliveries |
| `/api/embedded/*` | Shopify embedded app API |
| `/api/connector/*` | External CMS connector calls |
| `/api/heartbeat` | External monitoring |
| `/api/admin` | Can be white-labeled |
| `/assets` | Static assets |

**VPN check methods** (tried in order):
1. Custom `X-VPN-Header` matching `VPN_AUTH_TOKEN` env var
2. Internal IP range (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8)
3. X-Forwarded-For with internal IP (behind reverse proxy)

## IP Whitelist

- Optional, configured via `INTERNAL_IP_WHITELIST` env var
- Falls back to internal subnet check if not configured
- Strict mode (`requireInternalNetwork()`) allows only private IPs

## Rate Limiting

| Layer | Limit | Window |
|---|---|---|
| Global | 500 requests | 15 minutes |
| Auth-specific | 20 requests | 15 minutes |
| Per-client | Configurable (default 60/min) | Per-minute |

Rate limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## CORS

Allowed origins:
- `http://localhost:5173` (Vite dev)
- `https://16.192.29.174.nip.io` (production)
- `https://*.myshopify.com` (Shopify admin)

## HTTP Headers (Helmet)

- Content Security Policy (CSP) restricts scripts/styles
- Frame ancestors set to Shopify admin origins
- XSS protection enabled
- MIME-sniffing disabled

## Compliance Webhook Security

- All compliance webhooks require **HMAC-SHA256 verification**
- Uses `SHOPIFY_API_SECRET` as the signing key
- Returns `401 Unauthorized` for invalid signatures
- Timing-safe comparison to prevent timing attacks

## Device Authentication (Optional)

- Device fingerprint extracted from request headers
- Devices must be registered in `device_registry`
- Row-Level Security (RLS) on sensitive tables
- Trust scores for device risk assessment

## Secrets Management

- Environment variables for all secrets
- `.env` file on production server (not in git)
- Secret rotation tracking in database
- `JWT_SECRET` must be set in production (throws error if missing)

## Data Isolation

- All client data isolated by `client_id` foreign key
- Middleware ensures non-admin users only access their own data
- Permission matrix table defines resource-level access
- Audit log tracks all sensitive operations
