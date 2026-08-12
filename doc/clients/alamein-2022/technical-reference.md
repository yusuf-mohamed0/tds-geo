# Alamein Outdoor Furniture — Technical Reference

## Shopify Integration

| Detail | Value |
|---|---|
| **Shopify Store** | alamein-2022.myshopify.com |
| **Public Domain** | alameinegypt.com |
| **Store ID** | 57450659897 |
| **API Version** | 2025-07 |
| **Admin API Token** | shpat_b67cdfcd9... (stored in production DB) |
| **Blog ID** | 79774056505 |
| **Blog Title** | posts |
| **Blog Handle** | posts |
| **Existing Articles** | 84 |

## CMS Connection

Provider: Shopify
Endpoint: https://alamein-2022.myshopify.com
Config stored in: cms_connections table (production DB)

## Kivo Geo Configuration

| Setting | Value |
|---|---|
| Client Slug | alamein-2022 |
| Client ID (UUID) | 1a4d20ed-6a85-4ebc-acea-f73c62bb78da |
| CMS Connection ID | 58f273b5-16b8-4904-ada9-8a486d980dbc |
| Auto-Publish | Disabled globally (AUTO_PUBLISH_ENABLED=true) |
| Status | Active |
| Scheduling | Not yet configured — awaiting user preference |

## Environment (Production)

| Variable | Value |
|---|---|
| SHOPIFY_API_KEY | a178c8740049e04eec663378b6e30ad8 |
| SHOPIFY_APP_URL | https://16.192.29.174.nip.io |
| OAuth Redirect | /api/shopify/callback |
| Install URL | /api/shopify/install |

## Process Manager

- Managed via PM2 (process: kivo-backend)
- PM2 startup enabled (systemd)
- Auto-restart on crash (max 10 restarts, 5s delay)
- Health check: /health endpoint
---
*Generated for Kivo Geo — July 12, 2026*
