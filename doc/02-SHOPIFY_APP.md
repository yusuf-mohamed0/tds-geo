# Shopify App — How It Works

## What Kind of App Is This?

**Embedded Shopify App** — it runs inside the Shopify admin (in an iframe). You can't open `https://16.192.29.174.nip.io/` in a browser tab and see anything useful; it only works when loaded through Shopify's admin.

## Installation Flow (OAuth)

```
1. Merchant clicks "Install" in Shopify App Store
2. → Redirected to our app: /api/shopify/install?shop=store.myshopify.com
3. → We redirect to Shopify OAuth:
      https://store.myshopify.com/admin/oauth/authorize
      ?client_id=a178c8740049e04eec663378b6e30ad8
      &scope=read_content,write_content,read_products,write_products,...
      &redirect_uri=https://16.192.29.174.nip.io/api/shopify/callback
      &state=<random_token>
4. → Merchant approves
5. → Shopify calls our callback with auth code
6. → We exchange code for permanent access token
7. → Register compliance webhooks
8. → Redirect to embedded app inside Shopify admin
```

## Compliance Webhooks (Required for App Store)

Registered via `shopify.app.toml`:

| Topic | Endpoint | Purpose |
|---|---|---|
| `customers/data_request` | `/api/webhooks/compliance` | Customer requests their data |
| `customers/redact` | `/api/webhooks/compliance` | Customer requests deletion |
| `shop/redact` | `/api/webhooks/compliance` | Store uninstalls (48h delay) |
| `app/uninstalled` | (per-store, via OAuth install) | Immediately deactivate store |

These are **mandatory** for App Store approval. All GDPR topics share one URI — the handler dispatches by `x-shopify-topic` header.

## Key Files

| File | Purpose |
|---|---|
| `shopify.app.toml` | App configuration (name, scopes, webhooks, redirect URLs) |
| `backend/routes/shopifyInstall.ts` | OAuth install + callback flow |
| `backend/routes/complianceWebhooks.ts` | Compliance webhook handlers |
| `backend/routes/webhooks.ts` | Webhook CRUD + event receiver |
| `backend/utils/shopifyWebhook.ts` | HMAC verification helpers |
| `backend/routes/embedded.ts` | Embedded app API proxy |
| `backend/services/shopify/client.ts` | Shopify API client |

## Dev Dashboard vs Partner Dashboard

| Dashboard | URL | Purpose |
|---|---|---|
| Partner Dashboard | `partners.shopify.com/4956362` | App Store listing, submission, revenue |
| Dev Dashboard | `dev.shopify.com/dashboard/220584008/apps/387411705857` | App config, versions, monitoring, logs |

Important: Partner ID is `4956362`, Organization ID is `220584008`, App ID is `387411705857`.

## Webhooks API Version

The app uses Shopify Admin API version **2025-07**. This is configured in:
- `shopify.app.toml` (for TOML-based config)
- Environment variable `SHOPIFY_DEFAULT_API_VERSION`
- Hardcoded defaults in multiple `backend/` files

## Credentials

| Credential | Value |
|---|---|
| API Key | `a178c8740049e04eec663378b6e30ad8` |
| API Secret | `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` |
| App URL | `https://16.192.29.174.nip.io` |
| Scopes | `read_products,write_products,read_content,write_content,read_script_tags,write_script_tags,read_themes,write_themes` |

## App Store Review

- **Submitted:** July 1, 2026
- **Reference:** 121207
- **Contact email:** web.development@trafficdigitalsolutions.com
- **Status:** "Submitted" — waiting for reviewer assignment
- **Visibility:** Limited (only accessible via direct URL until approved)
