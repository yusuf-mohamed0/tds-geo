# Frontend SPA

## Overview

The frontend is a **pre-built Single Page Application (SPA)** — built with **React + Vite + TypeScript**.

All source code is pre-compiled into `frontend/dist/`. There is no live source in this repo (source may be in a separate repo or was removed after building).

## How It's Served

In production, the Express backend serves the SPA:

```
Express catches all GET requests at /
  → Serves frontend/dist/index.html
  → Browser loads assets/index-CijpQVv1.js
  → React app renders
  → Communicates with backend via /api/* routes
```

## Pages

Based on the build output and route patterns, the SPA includes:

| Page | Route | Purpose |
|---|---|---|
| Login | `/login` | Auth |
| Dashboard | `/` | Overview + stats |
| Articles | `/articles` | List/generate content |
| Article Detail | `/articles/:id` | View/edit article |
| Clients | `/clients` | Manage clients |
| Analytics | `/analytics` | Performance data |
| Admin | `/admin` | System admin |
| Settings | `/settings` | App settings |
| Config | `/config` | System config |
| Plugins | `/plugins` | Plugin management |
| Chat | `/chat` | AI chat interface |
| API Keys | `/api-keys` | API key management |
| Prompts | `/prompts` | Prompt template editor |
| Webhooks | `/webhooks` | Webhook management |
| API Usage | `/api-usage` | Usage tracking |
| Improvements | `/improvements` | Self-improvement log |

## Shopify Embedded Mode

When loaded inside the Shopify admin (the normal use case):

1. The HTML includes `<meta name="shopify-api-key" content="a178c8740049e04eec663378b6e30ad8" />`
2. It loads App Bridge: `<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`
3. App Bridge initializes with the shop/API key
4. React app communicates via App Bridge's authenticated fetch

**Direct browser access** → hangs because App Bridge can't find a Shopify session. This is normal for all embedded apps.

## Libraries (from package.json)

| Library | Purpose |
|---|---|
| React 18.3 | UI framework |
| React Router 6.23 | Client-side routing |
| Recharts 2.12 | Charts and graphs |
| Lucide React | Icons |
| TypeScript strict | Type safety |

## API Communication

The SPA talks to the backend via `/api/*` endpoints:
- JWT Bearer token in `Authorization` header
- JSON request/response bodies
- Standard REST patterns
