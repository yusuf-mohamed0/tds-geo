# Shopify App Store Submission — TDS Geo

## App Identity

| Field | Value |
|---|---|
| **App name** | TDS Geo |
| **App URL** | `https://traffic.16.192.29.174.nip.io` |
| **Partner Dashboard** | https://partners.shopify.com (TDS Geo app) |
| **Client ID** | `a178c8740049e04eec663378b6e30ad8` |
| **Client secret** | Verify in Partner Dashboard → Apps → TDS Geo → API credentials<br>Server `.env` has: `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`<br>**Confirm both match before submitting** |
| **Application URL** | `https://traffic.16.192.29.174.nip.io` |
| **Allowed redirection URL(s)** | `https://traffic.16.192.29.174.nip.io/api/shopify/callback` |

## OAuth Scopes (required)

```
write_products, read_products, write_content, read_content,
write_script_tags, read_script_tags, write_themes, read_themes
```

## Webhook Compliance Topics

```
customers/data_request, customers/redact, shop/redact, app/uninstalled
```

## App Bridge

App Bridge React v4 (`@shopify/app-bridge-react`) is integrated:
- `useAppBridge()` hook accesses `window.shopify` global injected by Shopify
- Used in `ShopifyEmbeddedPage.tsx` for `shopify.redirect()` navigation
- Session tokens auto-handled by App Bridge in embedded context

## Pre-submission Checklist

### 1. Policy
- [ ] App operates within Shopify's platform — no circumvention of core workflows
- [ ] Billing uses `appSubscriptionCreate` GraphQL mutation (3 tiers)
- [ ] No off-platform billing

### 2. Functionality
- [ ] App delivers on listing description (AI content generation, SEO, GEO analysis)
- [ ] Embedded admin experience via Shopify Admin iframe
- [ ] Installation is seamless: OAuth redirect → token exchange → webhook registration
- [ ] Uninstall flow: `app/uninstalled` webhook deactivates client, cancels billing
- [ ] No promotions or inappropriate modal launches

### 3. Security
- [x] TLS/SSL via Let's Encrypt (auto-renewal on `traffic.16.192.29.174.nip.io`)
- [x] HMAC verification on all incoming webhooks (timing-safe comparison)
- [x] OAuth HMAC verification on callback
- [x] State nonce with 10-minute expiry stored in DB
- [x] Session token JWT verification (HS256)
- [ ] Verify no unnecessary access scopes are requested

### 4. App Store Listing

#### App Name
TDS Geo

#### App Icon
The Swype logo (`frontend/public/assets/Black Swype.png`, `White Swype.png`)
Upload the Black Swype PNG to the Partner Dashboard.

#### Detailed Description (suggested)
> TDS Geo is an AI-powered content engine for Shopify stores. Generate SEO-optimized articles, product descriptions, and blog posts that rank. Includes GEO (Generative Engine Optimization) analysis to make your content visible in AI-powered search results like ChatGPT, Perplexity, and Google AI Overviews.
>
> **Features:**
> - AI article generation with EEAT content framework
> - Product description generation (batch)
> - Real-time SEO scoring and optimization
> - GEO analysis — optimize content for AI search engines
> - Citation management and competitor research
> - Content pipeline: draft → review → approve → publish
> - WordPress migration engine
>
> **Pricing:**
> - **Starter** — $29/mo: 50 articles/month, basic SEO
> - **Professional** — $79/mo: 250 articles/month, GEO analysis, citations
> - **Enterprise** — $199/mo: unlimited articles, WP migration, priority support

#### Short Description (suggested)
> AI content engine for Shopify — generate SEO articles, product descriptions, and optimize for AI search (ChatGPT, Perplexity, Google AI Overviews).

#### Category
Sales channels / Content & blogging

#### Pricing
- Starter: $29/mo
- Professional: $79/mo
- Enterprise: $199/mo

#### Support email
Verify in Partner Dashboard

#### Privacy policy URL
Required by Shopify. Host at: `https://traffic.16.192.29.174.nip.io/privacy`

### 5. Category-specific (Content & blogging)
- [ ] No theme app extensions needed (app operates in Shopify admin only)
- [ ] Content is published via Admin API (`POST /admin/api/2025-07/articles.json`)
- [ ] No checkout, payments, or sales channel functionality

## Domain & Hosting

| Detail | Value |
|---|---|
| Host | EC2 (`16.192.29.174`) |
| Domain | `traffic.16.192.29.174.nip.io` |
| SSL | Let's Encrypt (auto-renewal) |
| Process manager | PM2 |
| Backend | Node.js/Express on port 3000 |
| Frontend | Vite + React SPA (served by backend) |

## Submission Steps

1. Go to https://partners.shopify.com → Apps → TDS Geo
2. Fill in App Store listing fields (name, description, icon, screenshots, category)
3. Set pricing to "Paid" with the 3 tiers, or "Free" initially
4. Upload Privacy policy URL
5. Click "Submit for Review"

## Post-Submission

- App Excellence Team will perform quality checks (takes 3-10 business days)
- They may request a test store login — provide `traffic-test.myshopify.com`
- If rejected, they'll specify which requirement was not met
- After approval, the app goes live on the App Store

## Notes

- **Billing** uses `EVERY_30_DAYS` interval via `appSubscriptionCreate` GraphQL
- **GDPR** compliance webhooks are registered on installation
- **App Bridge v4** auto-detects the `shopify` global — no manual Provider wrapper needed
- Test store: `traffic-test.myshopify.com` (token expired 2026-07-04 — regenerate before testing)
