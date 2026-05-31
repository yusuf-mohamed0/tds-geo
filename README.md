# AI SEO Automation System

Multi-tenant SaaS platform that automates SEO content generation and publishing for Shopify stores. Uses AI (OpenAI GPT-4o) to research keywords, generate high-quality blog posts, optimize for SEO, and publish directly to Shopify — all with per-client rate limiting, cost tracking, and a full admin dashboard.

## Architecture

```
                    ┌──────────────────────┐
                    │     React SPA        │
                    │   (Vite, Port 5173)  │
                    └──────────┬───────────┘
                               │ /api/*
                               ▼
                    ┌──────────────────────┐
                    │   Nginx (Port 80)    │
                    │  Reverse Proxy + SPA │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Express API        │
                    │  (TypeScript, :3000) │
                    └──┬───────┬───────┬───┘
                       │       │       │
              ┌────────▼──┐ ┌──▼────┐ ┌▼────────┐
              │ PostgreSQL│ │ Redis │ │External │
              │ (main DB) │ │(BullMQ│ │  APIs   │
              │+ pgvector │ │ queue)│ │OpenAI…  │
              └───────────┘ └───────┘ └─────────┘
                       │
              ┌────────▼────────────┐
              │  BullMQ Workers     │
              │ (separate process)  │
              └─────────────────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| **17-Stage Pipeline** | End-to-end orchestration: validation → keyword discovery → title gen → outline → article → SEO enhancement → CTA → FAQ → metadata → image gen → approval → publish → logging |
| **Keyword Discovery** | AI-powered research with SerpAPI data, clustering, scoring, dedup, and 90-day reuse prevention |
| **Content Generation** | Long-form SEO blog posts via OpenAI GPT-4o with brand voice, E-E-A-T guidelines |
| **SEO Analysis** | Content scoring, keyword density, readability, quality scoring, internal linking optimization |
| **Shopify Publishing** | Direct publish with image upload, tags, metadata, retry with backoff, rate-limit protection |
| **Multi-Tenant** | Per-client Shopify stores, keyword pools, generation settings, publishing queues, budgets |
| **JWT Authentication** | Role-based auth (admin, editor, client), login/logout, protected routes |
| **Webhook System** | Event-driven webhooks with retry delivery, delivery history, per-webhook config |
| **Plugin System** | Pluggable hook-based architecture (before/after stages) with per-client instances |
| **Chat Interface** | Natural language command interface for managing pipeline operations |
| **Prompt Management** | Versioned prompt templates with self-improvement tracking |
| **Cost Tracking** | Per-client, per-article cost tracking (OpenAI, SerpAPI, Shopify) with monthly budgets |
| **Quality Scoring** | Multi-dimension content quality evaluation with improvement suggestions |
| **Vector Memory** | pgvector-based RAG for context-aware content generation (graceful degradation if extension missing) |
| **Activity Logging** | Full audit trail with async batch DB logging |
| **Rate Limiting** | Bottleneck queue system respecting Shopify/OpenAI API limits; BullMQ for background jobs |
| **Analytics Dashboard** | SEO performance charts, token/cost visualization, pipeline metrics |
| **n8n Integration** | Importable workflow for scheduled daily automation with Slack notifications |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22, TypeScript 5.4 (strict mode) |
| **Backend** | Express.js 4.19 with Helmet, CORS, rate-limiting middleware |
| **Frontend** | React 18.3, Vite 5.2, React Router 6.23, Recharts 2.12, Lucide icons |
| **Database** | PostgreSQL 16 + pgvector extension (optional) |
| **Queue** | BullMQ 5.8 (Redis-backed, graceful degradation without Redis) |
| **AI** | OpenAI API (GPT-4o, text-embedding-3-small, DALL-E 3) |
| **SEO** | SerpAPI (Google keyword data), custom SEO scoring engine |
| **Auth** | JWT (jsonwebtoken + bcryptjs), 24h expiry, role-based |
| **Container** | Docker + docker-compose (Node, PostgreSQL, Redis, Nginx) |
| **CI/CD** | GitHub Actions (lint, typecheck, test, build, Docker deploy) |
| **Process Mgr** | PM2 (ecosystem.config.cjs) |
| **Logging** | Winston with async batch DB writer (LogBuffer) |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+ (optional — BullMQ degrades gracefully)
- OpenAI API key
- Shopify store with Admin API access token
- (Optional) SerpAPI key for keyword discovery
- (Optional) n8n instance for scheduled automation

### 1. Clone & Install

```bash
git clone <repo-url>
cd my-project
npm install
cd frontend && npm install && cd ..
```

### 2. Configure Environment

Copy `.env` and fill in your credentials:

```bash
cp .env .env.local
```

**Required variables:**

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `SHOPIFY_DEFAULT_SHOP` | Shopify store URL (e.g., `my-store.myshopify.com`) |
| `SHOPIFY_DEFAULT_ACCESS_TOKEN` | Shopify Admin API access token |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |

**Optional variables:**

| Variable | Description |
|----------|-------------|
| `SERPAPI_API_KEY` | SerpAPI key for keyword volume data |
| `REDIS_URL` | Redis connection string (BullMQ queue) |
| `PORT` | API server port (default: 3000) |

### 3. Initialize Database

```bash
# Create the database
createdb ai_seo_automation

# Apply schema (includes all tables, triggers, views)
psql -d ai_seo_automation -f backend/database/schema.sql

# (Optional) Load seed data for development
psql -d ai_seo_automation -f backend/database/seed.sql
```

Or via npm script:

```bash
npm run migrate
```

### 4. Start Development

```bash
# Terminal 1: Start the backend (with file watching)
npm run dev

# Terminal 2: Start the frontend dev server
cd frontend && npm run dev

# Terminal 3: (Optional) Start BullMQ workers
npm run worker
```

The API runs at `http://localhost:3000` and the frontend at `http://localhost:5173` (with API proxy to port 3000).

### 5. Production Build

```bash
# Build backend TypeScript
npm run build

# Build frontend
cd frontend && npm run build && cd ..

# Start with PM2
npx pm2 start ecosystem.config.cjs
```

## Docker Deployment

```bash
# Start the full stack (API, worker, PostgreSQL, Redis, Nginx)
npm run docker:up

# Or directly:
docker compose up -d

# View logs
docker compose logs -f api worker

# Stop
npm run docker:down
```

The Nginx reverse proxy serves the React SPA at `http://localhost:80` and proxies `/api/*` to the backend.

## Project Structure

```
├── backend/
│   ├── index.ts                    # Entry: Express app + route mounting + service init
│   ├── orchestrators/
│   │   └── blogPipeline.ts         # 17-stage pipeline orchestrator
│   ├── workers/
│   │   └── index.ts                # BullMQ workers (content gen, keywords, shopify, etc.)
│   ├── routes/
│   │   ├── auth.ts                 # Login/logout/register
│   │   ├── clients.ts              # Client CRUD
│   │   ├── articles.ts             # Article generation, CRUD, publish
│   │   ├── webhooks.ts             # Webhook management
│   │   ├── analytics.ts            # Analytics, logs, costs, SEO
│   │   ├── admin.ts                # Admin dashboard, config, errors
│   │   ├── apiKeys.ts              # API key management
│   │   ├── plugins.ts              # Plugin registry and instances
│   │   ├── prompts.ts              # Prompt template editor
│   │   ├── chat.ts                 # Chat session/messages
│   │   └── systemConfig.ts         # System configuration CRUD
│   ├── services/
│   │   ├── openai.ts               # OpenAI (GPT, embeddings, images)
│   │   ├── shopify.ts              # Shopify Admin API
│   │   ├── seo.ts                  # Content SEO analysis
│   │   ├── keywords.ts             # Keyword discovery/storage
│   │   ├── qualityScorer.ts        # Content quality scoring
│   │   ├── costTracker.ts          # API cost tracking & budgets
│   │   ├── contentSafety.ts        # Content safety checks
│   │   ├── serpapi.ts              # SerpAPI keyword data
│   │   ├── webhooks.ts             # Webhook delivery service
│   │   ├── vectorMemory.ts         # pgvector RAG (graceful degradation)
│   │   ├── internalLinks.ts        # Internal link optimization
│   │   ├── pluginService.ts        # Plugin registry (tables-optional)
│   │   ├── chatEngine.ts           # Chat command processing
│   │   └── selfImprovementService.ts  # Auto-analysis & suggestions
│   ├── repositories/
│   │   ├── articleRepo.ts          # Article DB access
│   │   ├── clientRepo.ts           # Client DB access
│   │   ├── keywordRepo.ts          # Keyword DB access
│   │   └── logRepo.ts              # Activity log DB access
│   ├── middleware/
│   │   └── auth.ts                 # JWT auth middleware + full auth route factory
│   ├── validators/
│   │   └── index.ts                # Zod/JSON schema validators
│   ├── utils/
│   │   ├── logger.ts               # Winston + LogBuffer (async batch DB logger)
│   │   ├── queue.ts                # BullMQ connection/worker factory
│   │   └── markdownToHtml.ts       # MD → Shopify-compatible HTML
│   ├── queues/
│   │   └── definitions.ts          # Queue names enum
│   ├── types/
│   │   └── index.ts                # Shared TypeScript types/interfaces
│   ├── database/
│   │   ├── schema.sql              # Complete schema (v3, all tables merged)
│   │   ├── schema-comprehensive.sql  # Reference schema with documentation
│   │   ├── seed.sql                # Development seed data
│   │   ├── migration_v2.sql        # Legacy migration (v1 → v2)
│   │   └── migration_platform_v1.sql  # Platform expansion tables
│   └── tests/
│       ├── orchestrators/          # Pipeline orchestrator tests
│       ├── services/               # Service unit tests
│       ├── mocks/                  # Shared mock factories
│       └── integration/            # E2E pipeline integration tests
├── frontend/
│   ├── src/
│   │   ├── main.tsx                # Entry point
│   │   ├── App.tsx                 # Router + ToastProvider
│   │   ├── styles.css              # Global styles
│   │   ├── components/             # Shared primitives
│   │   │   ├── Card.tsx            # Card, CardHeader, CardBody, CardFooter
│   │   │   ├── Modal.tsx           # Modal with overlay + Escape key
│   │   │   ├── DataTable.tsx       # Typed table with pagination/sort/loading
│   │   │   ├── FormField.tsx       # Input, Select, Textarea, Toggle, Checkbox
│   │   │   ├── Toast.tsx           # ToastProvider + useToast() hook
│   │   │   └── Layout.tsx          # App shell + sidebar navigation
│   │   ├── pages/                  # 16 route pages
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Articles.tsx
│   │   │   ├── ArticleDetail.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── Admin.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Config.tsx
│   │   │   ├── Plugins.tsx
│   │   │   ├── Chat.tsx
│   │   │   ├── ApiKeys.tsx
│   │   │   ├── Prompts.tsx
│   │   │   ├── Webhooks.tsx
│   │   │   ├── ApiUsage.tsx
│   │   │   └── Improvements.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.tsx         # Auth context + JWT management
│   │   ├── services/
│   │   │   └── api.ts              # API client (axios)
│   │   └── types/
│   │       └── index.ts            # Frontend TypeScript types
│   └── index.html
├── docker/
│   └── nginx.conf                  # Nginx config (SPA + API proxy)
├── n8n/
│   └── workflows/
│       └── seo-shopify-agent.json  # Importable n8n workflow
├── .github/workflows/
│   ├── ci.yml                      # TypeScript typecheck, lint, test, build
│   └── docker-deploy.yml           # Docker build + push + deploy via SSH
├── docker-compose.yml              # Full stack: API + worker + Postgres + Redis + Nginx
├── Dockerfile                      # Multi-stage build (Node 20, production target)
└── ecosystem.config.cjs            # PM2 process configuration
```

### Key Design Decisions

1. **Singleton services with `initialize(pool)`** — All services share one DB pool passed at startup, avoiding redundant connections
2. **Graceful degradation** — Redis, pgvector, and plugin registry tables are optional; services warn in standby mode
3. **Async batch logging** — LogBuffer batches DB writes every 2 seconds (non-blocking)
4. **Route delegation** — auth routes delegate to `middleware/auth.ts` (single source of truth)
5. **Shared publish helper** — `shopifyService.publishArticleWithTracking()` used by both routes and workers
6. **Frontend primitives** — Card, DataTable, FormField, Modal, Toast: reusable components with consistent styling across all 16 pages
7. **TypeScript strict mode** — Both frontend and backend, zero type errors in CI

## API Reference

### Authentication

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}

# Response: { "token": "eyJhbGci...", "user": { ... } }
```

All other endpoints require a Bearer token:

```http
Authorization: Bearer <token>
```

### Health Check

```http
GET /health
```

### Clients

```http
POST /api/clients
{
  "name": "My Store",
  "slug": "my-store",
  "shopifyShop": "my-store.myshopify.com",
  "shopifyToken": "shpat_xxxxxxxxxx",
  "settings": {
    "ctaText": "Call us today",
    "ctaUrl": "https://my-store.com/contact",
    "seedKeywords": ["plumbing repair", "drain cleaning"]
  }
}

GET /api/clients
GET /api/clients/:id
PUT /api/clients/:id
DELETE /api/clients/:id
```

### Keywords

```http
POST /api/clients/:clientId/keywords/discover
{
  "industry": "maintenance",
  "seedKeywords": ["home maintenance", "property care"],
  "count": 20
}

GET /api/clients/:clientId/keywords
GET /api/clients/:clientId/keywords/best?limit=5
```
### Content Generation

```http
POST /api/clients/:clientId/generate
{
  "keyword": "target keyword",       # Optional — uses best available keyword
  "count": 3,
  "publish": true,
  "approvalMode": "auto",           # "auto" | "manual"
  "bypassDedup": false,             # Skip dedup check
  "generateImage": true,
  "blogId": 123456789               # Optional: Shopify blog ID
}

# Returns 202 Accepted with a job ID. The pipeline runs asynchronously.
```

### Articles

```http
GET /api/clients/:clientId/articles?status=published&limit=20
GET /api/articles/:id
POST /api/articles/:articleId/publish   { "blogId": 123456789 }
PUT /api/articles/:articleId/status     { "status": "approved" }
```

### Webhooks

```http
GET    /api/clients/:clientId/webhooks
POST   /api/clients/:clientId/webhooks
PUT    /api/webhooks/:id
DELETE /api/webhooks/:id
```

### Plugins

```http
GET    /api/plugins                          # List registry
GET    /api/plugins/clients/:clientId        # List client instances
POST   /api/plugins/clients/:clientId/register  { "pluginSlug": "...", "config": {} }
PATCH  /api/plugins/clients/:clientId/instances/:instanceId/toggle
PUT    /api/plugins/clients/:clientId/instances/:instanceId/config
POST   /api/plugins/hooks/:hookName/execute  { "clientId": "...", "data": {} }
```

### Chat

```http
POST /api/chat/sessions              { "userId": "...", "title": "..." }
POST /api/chat/sessions/:id/messages { "role": "user", "content": "..." }
GET  /api/chat/sessions/:id/messages
```

### Admin

```http
GET  /api/admin/summary              # Platform-wide stats
GET  /api/admin/errors?days=7        # Recent errors
```

### Analytics

```http
GET /api/clients/:clientId/analytics/overview
GET /api/clients/:clientId/analytics/logs?level=error&limit=50
GET /api/clients/:clientId/analytics/costs?days=30
GET /api/clients/:clientId/analytics/seo?days=30
```

## n8n Workflow

1. Open your n8n instance
2. Go to **Workflows → Import from File**
3. Select `n8n/workflows/seo-shopify-agent.json`
4. Update the **Set Client ID** node with your client UUID
5. Configure Slack nodes with your webhook URL (optional)
6. Activate the workflow

The workflow runs daily:
1. Discovers trending keywords
2. Generates and publishes 1 article
3. Waits 30 seconds for processing
4. Fetches the published article
5. Notifies via Slack success/failure

## Example: Full Pipeline Run

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.token')

# 2. Create a client
CLIENT=$(curl -s -X POST http://localhost:3000/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Maintenance Co",
    "slug": "my-maintenance-co",
    "shopifyShop": "my-store.myshopify.com",
    "shopifyToken": "shpat_xxxxxxxxxx"
  }')
CLIENT_ID=$(echo $CLIENT | jq -r '.id')

# 3. Discover keywords
curl -X POST "http://localhost:3000/api/clients/$CLIENT_ID/keywords/discover" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seedKeywords": ["gutter cleaning", "roof maintenance"]}'

# 4. Run the full pipeline
curl -X POST "http://localhost:3000/api/clients/$CLIENT_ID/pipeline/run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "gutter cleaning tips", "publish": true}'

# 5. Check results
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/clients/$CLIENT_ID/articles?status=published"
```

## Database

The schema includes 28 tables covering:

- **Core**: clients, users, keywords, keyword_clusters, articles, article_images
- **Publishing**: publishing_history, publishing_queue
- **Analytics**: cost_tracking, api_usage, seo_analytics, workflow_logs, activity_logs
- **Platform**: api_keys, system_config, prompt_templates, prompt_versions, plugin_registry, plugin_instances
- **Chat**: chat_sessions, chat_messages
- **Extensions**: internal_links_cache, content_embeddings (pgvector), schedules, webhooks, webhook_deliveries, improvement_logs, jobs

### Seed Data

```bash
psql -d ai_seo_automation -f backend/database/seed.sql
```

Creates: admin user (`admin@example.com` / `admin123`), editor user, sample client with 10 keywords, sample articles in various states, activity logs, SEO analytics, and system configuration.

## Content Safety

The system is explicitly designed to **avoid generating dangerous DIY repair instructions**. The AI prompt template includes blocked keywords and content validation checks for prohibited content. Always review AI-generated content before publishing.

## Testing

```bash
# Run all tests (95+ tests)
npm test

# Run specific test suites
npx vitest run backend/tests/services/pluginService.test.ts
npx vitest run backend/tests/integration/pipeline-e2e.test.ts

# Watch mode for development
npm run test:watch

# TypeScript typecheck
npm run typecheck

# Frontend typecheck
cd frontend && npx tsc --noEmit
```

Test coverage: unit tests for services (OpenAI, SEO, quality scoring, content safety, plugins), orchestrator tests (blogPipeline with mocked dependencies), and E2E integration tests (full 17-stage pipeline with mock pool and services).

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **CI** (`ci.yml`): Runs on push to `main`/`develop` and all PRs — lint, TypeScript typecheck (frontend + backend), run all tests, build backend, build frontend, upload frontend artifact
- **Docker Build & Deploy** (`docker-deploy.yml`): On push to `main` or version tags — build multi-arch Docker image, push to GitHub Container Registry, deploy via SSH to production

## License

ISC
