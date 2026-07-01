# TDS Geo — Documentation

## Index

| File | Topic |
|---|---|
| `01-ARCHITECTURE_OVERVIEW.md` | High-level system architecture and components |
| `02-SHOPIFY_APP.md` | Shopify embedded app, OAuth, webhooks, App Store review |
| `03-BRAND_VOICE_AND_KNOWLEDGE.md` | Per-client brand voice, knowledge base (RAG), embeddings |
| `04-WEBSITE_SCRAPING.md` | Client website scraping — what, how, what it feeds |
| `05-DEPLOYMENT_AND_INFRA.md` | EC2 server, PM2, deployment flow, env vars |
| `06-FAQ.md` | Answers to common questions about everything |
| `07-CONTENT_PIPELINE.md` | The 24+ stage article generation pipeline |
| `08-DATABASE_SCHEMA.md` | All database tables, columns, foreign keys, relationships |
| `09-AUTH_AND_ROLES.md` | User roles (super_admin / admin / editor / client), JWT auth, permissions |
| `10-FRONTEND_SPA.md` | React SPA — pages, how it connects, embedded mode |
| `11-WORKERS.md` | Background job queues — BullMQ workers, Redis, graceful degradation |
| `12-CONNECTORS.md` | CMS connectors — Shopify, WordPress, Webflow, Ghost, WooCommerce |
| `13-SECURITY.md` | VPN, IP whitelist, rate limiting, CORS, HMAC, device auth |
| `14-PROMPTS_SYSTEM.md` | AI prompts — how they load, what they contain, customization |
| `15-SEO_ANALYSIS.md` | SEO scoring — what's checked, how scores feed the pipeline |
| `16-N8N_INTEGRATION.md` | n8n workflow automation — webhook triggers, logging |
| `17-BILLING.md` | Shopify Billing API — plans, flow, database, activation |

## Quick Links

- **GitHub:** https://github.com/yusuf-mohamed0/tds-geo
- **App URL:** https://16.192.29.174.nip.io
- **Test Store:** https://traffic-test.myshopify.com/admin
- **Partner Dashboard:** https://partners.shopify.com/4956362
- **Dev Dashboard:** https://dev.shopify.com/dashboard/220584008/apps/387411705857
- **EC2 Console:** AWS Console → EC2 → i-075f4e5677510cbc5

## How to Keep This Updated

When you make changes to the system, update the relevant file(s) above. This ensures you always have a single source of truth to reference.
