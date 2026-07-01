# TDS Geo — Architecture Overview

## What TDS Geo Is

TDS Geo is a multi-tenant SaaS platform that automates AI-powered SEO content generation and publishing for e-commerce stores (primarily Shopify). Built and operated by Traffic Digital Solutions.

**Core value proposition:** Enter a keyword → system runs 24+ AI stages → article published to your store automatically.

## System Components

```
┌──────────────────────────────────────────────┐
│              GITHUB (source of truth)          │
│  github.com/yusuf-mohamed0/tds-geo           │
│  All code, config, and infrastructure files   │
└──────────────────┬───────────────────────────┘
                   │ git push/pull
                   ▼
┌──────────────────────────────────────────────┐
│           EC2 PRODUCTION SERVER               │
│           i-075f4e5677510cbc5                 │
│           16.192.29.174                       │
│                                               │
│  ┌────────────────────────────────────────┐  │
│  │  PM2 (Process Manager)                 │  │
│  │  └─ tds-geo-backend (Express API)      │  │
│  │     TypeScript, Node 22, Port 3000     │  │
│  ├────────────────────────────────────────┤  │
│  │  PostgreSQL 16 (main database)         │  │
│  │  Port 5432                             │  │
│  ├────────────────────────────────────────┤  │
│  │  Redis 7 (queue system)                │  │
│  │  Port 6379 — degrades gracefully       │  │
│  ├────────────────────────────────────────┤  │
│  │  Nginx (reverse proxy + SSL)           │  │
│  │  Port 443 (HTTPS)                      │  │
│  │  Port 80 (redirects to 443)            │  │
│  └────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
┌──────────────┐ ┌──────┐ ┌──────────┐
│  Shopify     │ │Word- │ │ OpenAI   │
│  Admin API   │ │press │ │ GPT-4o   │
│  (articles)  │ │Plugin│ │          │
└──────────────┘ └──────┘ └──────────┘
```

## How Components Connect

| Connection | Method | Auth |
|---|---|---|
| Browser → App | HTTPS via Nginx | JWT Bearer token |
| App → Shopify | Shopify Admin REST API | OAuth access token |
| App → WordPress | REST API to WordPress plugin | X-TDS-GEO-Key header |
| App → OpenAI | OpenAI REST API | OpenAI API key |
| Workers → App | BullMQ (Redis) | Internal |
| App → Database | PostgreSQL client | Database URL |

## Key Principles

1. **Core is the only brain** — All AI, prompts, and intelligence live in `backend/`. No AI in plugins.
2. **Connectors are pure CRUD** — WordPress plugin and Next.js integration only handle auth, sync, and CRUD.
3. **Graceful degradation** — Redis, pgvector, and sidecar services are optional. The app works without them.
4. **Per-client isolation** — Every client gets their own brand voice, knowledge base, scraper data, and config.
5. **Event-driven** — Event bus for internal pub/sub; webhooks for external notifications.

## Directory Structure

| Directory | Purpose |
|---|---|
| `backend/` | Express API server (TypeScript) |
| `backend/routes/` | 39 route modules (API endpoints) |
| `backend/services/` | 47 service modules (business logic) |
| `backend/orchestrators/` | Content pipeline orchestration |
| `backend/connectors/` | CMS publisher adapters |
| `backend/database/` | Schema, migrations, seed data |
| `backend/prompts/` | AI system prompts (Markdown files) |
| `backend/types/` | 1492 lines of TypeScript types |
| `backend/workers/` | BullMQ background job processors |
| `frontend/` | Pre-built React SPA |
| `tds-geo-wp/` | WordPress plugin (thin connector) |
| `tds-geo-nextjs/` | Next.js integration package |
| `scripts/` | Deployment, data, and utility scripts |
| `doc/` | Documentation |
