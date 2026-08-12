# Kivo Geo — AI Search Optimization Platform (AEO, GEO, LLMO)

Multi-tenant SaaS platform that automates SEO content generation, publishing, and **AI search optimization** (AEO, GEO, LLMO) for Shopify stores. Uses AI (OpenAI GPT-4o + Ollama) to research keywords, generate high-quality blog posts, optimize for traditional and generative search engines, inject structured schema, track AI engine citations, and ping IndexNow — all with per-client rate limiting, cost tracking, and a full admin dashboard.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-black?style=flat-square&logo=express)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai)](https://openai.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow?style=flat-square)]()
[![CI](https://github.com/yusuf-mohamed0/kivo/actions/workflows/ci.yml/badge.svg)](https://github.com/yusuf-mohamed0/kivo/actions/workflows/ci.yml)

## Features

| Feature | Description |
|---------|-------------|
| **24-Stage Pipeline** | End-to-end orchestration: validation → keyword discovery → title gen → outline → article → SEO → CTA → FAQ → metadata → images → approval → publish → logging |
| **Keyword Discovery** | AI-powered research with SerpAPI data, clustering, scoring, dedup, and 90-day reuse prevention |
| **Content Generation** | Long-form SEO blog posts via OpenAI GPT-4o / Ollama with brand voice, E-E-A-T guidelines |
| **SEO / AEO / GEO / LLMO** | Optimize for traditional search, answer engines (AEO), generative AI (GEO), and LLM retrieval (LLMO) |
| **Structured Schema (JSON-LD)** | Auto-generate 7 schema types (Organization, Article, FAQPage, Product, BreadcrumbList, HowTo, WebPage) at publish time |
| **AI Crawler Control** | robots.txt allowing Google-Extended, GPTBot, PerplexityBot, Claude-Web, and 8 other AI crawlers |
| **IndexNow Pinging** | Dual-ping IndexNow + Bing API on every publish for instant search engine notification |
| **Citation Tracking** | Monthly audit of article citations across 7 AI engines (ChatGPT, Gemini, Perplexity, Claude, Copilot, Google AI Overviews, Bing AI) |
| **Content Freshness** | Automated freshness calendar — flags articles >10 months old, regenerates 3/week |
| **Entity Consistency** | Validates canonical entity names vs variants in generated content |
| **Shopify Publishing** | Direct publish with image upload, tags, metadata, retry with backoff, rate-limit protection |
| **WooCommerce Publishing** | Product content generation via Kivo Geo plugin API with SEO metafields |
| **Multi-Tenant** | Per-client Shopify stores, keyword pools, generation settings, publishing queues, budgets |
| **JWT Authentication** | Role-based auth (admin, editor, client), login/logout, protected routes |
| **Webhook System** | Event-driven webhooks with retry delivery, delivery history, per-webhook config |
| **Plugin System** | Pluggable hook-based architecture (before/after stages) with per-client instances |
| **Chat Interface** | Natural language command interface for managing pipeline operations |
| **Prompt Management** | Versioned prompt templates with self-improvement tracking |
| **Cost Tracking** | Per-client, per-article cost tracking (OpenAI, SerpAPI, Shopify) with monthly budgets |
| **Quality Scoring** | Multi-dimension content quality evaluation with improvement suggestions |
| **Content Safety** | 8+ hazard categories (electrical, gas, structural, medical claims, hallucination detection) |
| **Vector Memory** | pgvector-based RAG for context-aware content generation (graceful degradation) |
| **Editorial Workflow** | Draft → Review → Approve/Reject → Publish with assignment tracking |
| **Self-Improvement** | Auto-analysis of past runs to optimize prompts and configurations |
| **n8n Integration** | Importable workflow for scheduled daily automation with Slack notifications |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22, TypeScript 5.4 (strict mode) |
| **Backend** | Express.js 4.19 with Helmet, CORS, rate-limiting middleware |
| **Frontend** | React 18.3, Vite 5.2, React Router 6.23, Recharts 2.12, Lucide icons |
| **Database** | PostgreSQL 16 + pgvector extension (optional) |
| **Queue** | BullMQ 5.8 (Redis-backed, graceful degradation without Redis) |
| **AI** | OpenAI API (GPT-4o, text-embedding-3-small, DALL-E 3), Ollama (Ministral 3:14B) |
| **SEO / AEO / GEO / LLMO** | SerpAPI (keyword data), structured JSON-LD schema, IndexNow pinging, citation auditor |
| **Images** | Pexels API for article featured images |
| **Auth** | JWT (jsonwebtoken + bcryptjs), 7-day expiry, role-based |
| **Container** | Docker + docker-compose (Node, PostgreSQL, Redis, Nginx) |
| **CI/CD** | GitHub Actions (lint, typecheck, test, build, Docker deploy) |
| **Process Mgr** | PM2 (ecosystem.config.cjs) |
| **Logging** | Winston with async batch DB writer (LogBuffer) |

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

## Quick Start (for New Users)

Follow these steps to set up Kivo Geo on your own machine. No private data from the original author is included — everything uses placeholder examples.

### Prerequisites

You'll need these installed on your computer:

| Software | Version | Why you need it | Get it here |
|----------|---------|-----------------|-------------|
| **Node.js** | 20+ | Runs the backend & frontend | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | 14+ | Stores all data | [postgresql.org](https://www.postgresql.org/download/) |
| **Redis** | 7+ | Background job queue (optional) | [redis.io](https://redis.io/download/) |
| **Git** | Any | To clone the repo | [git-scm.com](https://git-scm.com/) |

### API Keys You'll Need

| Service | Required? | What it's for | How to get it |
|---------|-----------|---------------|---------------|
| **OpenAI** | ✅ Yes | AI content generation (GPT-4o) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Shopify** | ✅ Yes | Publishing articles to your store | Shopify Admin → Apps → Develop apps |
| **SerpAPI** | ❌ No | Keyword research data | [serpapi.com](https://serpapi.com/) |
| **Pexels** | ❌ No | Free stock photos for articles | [pexels.com/api](https://www.pexels.com/api/) |

> **Tip:** If you don't have an OpenAI key yet, you can still try the app! Leave `OPENAI_API_KEY` empty and the system runs in **mock mode** — all AI features return realistic sample data.

---

### Step 1: Clone the Project

```bash
git clone https://github.com/yusuf-mohamed0/kivo.git
cd Kivo Geo
```

### Step 2: Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Step 3: Create Your Environment File

```bash
# Copy the example config (no real secrets included)
cp .env.example .env
```

Now edit `.env` with your own credentials. Open the file in any text editor:

```bash
nano .env   # or use VS Code: code .env
```

Fill in these values:
- `OPENAI_API_KEY` — Your OpenAI key (or leave blank for mock mode)
- `SHOPIFY_DEFAULT_SHOP` — Your shop's `.myshopify.com` URL
- `SHOPIFY_DEFAULT_ACCESS_TOKEN` — Your Shopify Admin API token
- `DATABASE_URL` — Your PostgreSQL connection string
- `JWT_SECRET` — A random string for security (generate one with `openssl rand -hex 32`)
- `INDEXNOW_KEY` — Your IndexNow API key for instant search notification
- `INDEXNOW_HOST` — Your site domain registered with IndexNow
- `INDEXNOW_KEY_LOCATION` — Public URL to the key verification file
- `SITE_NAME` — Your site name (used in JSON-LD schema)
- `AUTHOR_NAME` — Default author name (used in JSON-LD schema)

### Step 4: Set Up the Database

```bash
# Create the database
createdb ai_seo_automation

# Create all tables
psql -d ai_seo_automation -f backend/database/schema.sql

# (Optional) Load sample data for testing
# This creates example users and demo content — no real data
psql -d ai_seo_automation -f backend/database/seed.sql
```

> The seed data includes demo accounts: `admin@kivo.internal` / `<REDACTED_PASSWORD>`

### Step 5: Start the App

Open **three terminal windows**:

**Terminal 1 — Backend API:**
```bash
npm run dev
```

**Terminal 2 — Frontend UI:**
```bash
cd frontend && npm run dev
```

**Terminal 3 — Background Workers (optional):**
```bash
npm run worker
```

### Step 6: Open the App

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000
- **Login:** `admin@kivo.internal` / `<REDACTED_PASSWORD>`

---

### Docker Setup (Alternative)

If you prefer Docker over manual setup:

```bash
# Start everything (PostgreSQL, Redis, API, workers)
docker compose up -d

# View logs
docker compose logs -f api worker

# Stop everything
docker compose down
```

Nginx serves the app at `http://localhost:80`.

## Production Deployment

### Manual (without Docker)

```bash
# 1. Build frontend (backend runs via tsx, no build needed)
cd frontend && npm run build && cd ..

# 2. Start with PM2 (runs from TypeScript source via tsx)
npx pm2 start ecosystem.config.cjs

# 3. Verify the server started correctly
pm2 logs kivo-backend --lines 10

# 4. (Optional) Save PM2 config to restart on reboot
npx pm2 save
npx pm2 startup
```

### Docker (Recommended for Production)

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f api worker

# Stop
docker compose down
```

For production, make sure to:
- Use strong `JWT_SECRET` and database passwords
- Enable HTTPS behind a reverse proxy
- Set up regular database backups

## Project Structure

```
├── backend/
│   ├── index.ts                     # Express app + route mounting
│   ├── orchestrators/
│   │   └── blogPipeline.ts          # 24-stage pipeline orchestrator
│   ├── workers/
│   │   └── index.ts                 # BullMQ worker processors
│   ├── services/                    # 30+ service modules
│   │   ├── openai.ts                # OpenAI (GPT, embeddings, images)
│   │   ├── shopify.ts               # Shopify Admin API
│   │   ├── seo.ts                   # SEO analysis & validation
│   │   ├── keywords.ts              # Keyword discovery
│   │   ├── qualityScorer.ts         # Content quality scoring
│   │   ├── contentSafety.ts         # Hazard detection
│   │   ├── chatEngine.ts            # Natural language commands
│   │   ├── factCheckService.ts      # Fact verification
│   │   ├── brandVoice.ts            # Brand voice enforcement
│   │   ├── multiCmsPublisher.ts     # Multi-CMS publishing
│   │   ├── costTracker.ts           # Cost tracking & budgets
│   │   ├── costOptimization.ts      # AI model routing
│   │   ├── selfImprovementService.ts # Prompt optimization
│   │   ├── schemaGenerator.ts       # JSON-LD schema generation (7 types)
│   │   ├── indexNowService.ts       # IndexNow + Bing URL pinging
│   │   ├── citationTracker.ts       # AI engine citation auditor
│   │   └── geoIntelligence.ts       # GEO content analysis engine
│   ├── prompts/                     # AI prompt loaders
│   │   └── index.ts                 # AEO, GEO, LLMO, consulting prompt loaders
│   ├── writing-system-prompt.md     # Master writing prompt (AEO + LLMO sections)
│   ├── routes/                      # 27+ route modules
│   ├── repositories/                # Data access layers
│   ├── middleware/auth.ts           # JWT auth + RBAC
│   ├── database/                    # Migrations & seed data
│   └── tests/                       # 193+ tests
├── frontend/
│   ├── src/
│   │   ├── components/              # Shared UI primitives
│   │   │   ├── Card.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── FormField.tsx
│   │   │   └── Layout.tsx
│   │   └── pages/                   # 24 route pages
│   └── index.html
├── scripts/                      # Utility & pipeline scripts
│   ├── monthly-ops.mjs           # Monthly freshness + citation + entity audit
│   └── run-monthly-ops.sh        # Shell wrapper for monthly ops
├── doc/                          # Knowledge base & documentation
│   ├── AI-SEO-MASTER-KNOWLEDGE-BASE.md  # 531-line AI SEO reference
│   ├── aeo-answer-engine-prompt.md      # AEO discipline prompt
│   ├── geo-generative-engine-prompt.md  # GEO discipline prompt
│   ├── llmo-large-language-model-prompt.md # LLMO discipline prompt
│   ├── ai-seo-consulting-framework-prompt.md # Consulting framework prompt
│   ├── 18-WP-SHOPIFY-MIGRATION.md       # WordPress → Shopify migration plan
│   └── EEAT-content-framework.md        # E-E-A-T content quality framework
├── docker/nginx.conf
├── n8n/workflows/
├── .github/workflows/
├── docker-compose.yml
├── Dockerfile
└── ecosystem.config.cjs
```

## API Reference

### Authentication

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@kivo.internal", "password": "<REDACTED_PASSWORD>" }

# Response: { "token": "eyJhbGci...", "user": { ... } }
```

All other endpoints require: `Authorization: Bearer <token>`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/auth/login` | User login |
| `GET` | `/api/clients` | List clients |
| `POST` | `/api/clients` | Create client |
| `GET` | `/api/clients/:id` | Get client |
| `POST` | `/api/clients/:clientId/generate` | Generate article(s) |
| `GET` | `/api/clients/:clientId/articles` | List articles |
| `GET` | `/api/articles/:id` | Get article details |
| `POST` | `/api/articles/:id/publish` | Publish article to Shopify |
| `POST` | `/api/articles/:id/approve` | Approve article |
| `POST` | `/api/articles/:id/reject` | Reject article |
| `POST` | `/api/clients/:clientId/keywords/discover` | Discover keywords |
| `POST` | `/api/chat/sessions` | Create chat session |
| `POST` | `/api/chat/sessions/:id/messages` | Send chat message |
| `GET` | `/api/admin/summary` | Platform-wide stats |
| `GET` | `/api/admin/errors` | Recent errors |
| `GET` | `/api/ai-seo/ping` | AI SEO router health check |
| `POST` | `/api/ai-seo/schema/generate` | Generate JSON-LD schemas for an article |
| `POST` | `/api/ai-seo/schema/inject` | Inject JSON-LD into HTML |
| `POST` | `/api/ai-seo/schema/extract-faq` | Extract FAQ pairs from content |
| `POST` | `/api/ai-seo/indexnow/ping` | Ping IndexNow for a single URL |
| `POST` | `/api/ai-seo/indexnow/ping-batch` | Batch-ping IndexNow for multiple URLs |
| `POST` | `/api/ai-seo/citations/check` | Check article citations across AI engines |
| `GET` | `/api/ai-seo/citations/history` | Citation history for an article |
| `POST` | `/api/ai-seo/citations/audit` | Run a full citation audit |

## Monthly Operations

Automated monthly pipeline for content freshness and AI search optimization:

```bash
# Run monthly ops (freshness + citation audit + entity check + full report)
node scripts/monthly-ops.mjs monthly

# Check content freshness calendar (flags articles >10 months old)
node scripts/monthly-ops.mjs freshness

# Check entity consistency across all articles
node scripts/monthly-ops.mjs entity-check

# Generate enhanced monthly report with all metrics
node scripts/monthly-ops.mjs enhanced-report
```

Or use the shell wrapper:
```bash
bash scripts/run-monthly-ops.sh
```

## Testing

```bash
npm test                      # Run all unit/service tests (183+ tests)
npm run test:e2e              # Run E2E integration tests (10 tests)
npm run test:watch            # Watch mode
npm run typecheck             # TypeScript typecheck
cd frontend && npx tsc --noEmit  # Frontend typecheck
```

**193 tests across 8 test files** — all passing with zero type errors.

## CI/CD

GitHub Actions workflows:
- **CI** — Lint, TypeScript typecheck, run all tests, build frontend & backend
- **Docker Deploy** — Build multi-arch Docker image, push to GHCR, deploy via SSH

## Key Design Decisions

1. **Singleton services with `initialize(pool)`** — All services share one DB pool
2. **Graceful degradation** — Redis, pgvector, and plugin tables are optional
3. **Stage-level error isolation** — Pipeline wraps each stage in try/catch
4. **Async batch logging** — LogBuffer batches DB writes every 2 seconds
5. **Plugin system via hooks** — Pluggable architecture for before/after stages
6. **Natural language CLI** — Regex-based pattern matching for fast command parsing
7. **Cost-first routing** — Routes tasks to optimal AI model based on complexity
8. **TypeScript strict mode** — Zero type errors across frontend and backend
9. **Schema injection at publish time** — JSON-LD is generated and injected when an article is published, not at generation time
10. **IndexNow fires async** — After successful publish, IndexNow ping is fire-and-forget (doesn't block the response)
11. **Master prompt in Markdown** — The actual writing prompt is `writing-system-prompt.md` loaded by `prompts/index.ts`, not embedded in code
12. **Kivo Geo plugin for WooCommerce** — WooCommerce product reads/writes use the Kivo Geo plugin API (`/kivo/v1/posts/{id}`), not WP native REST

## WordPress → Shopify Migration

A full migration engine design is available at `doc/18-WP-SHOPIFY-MIGRATION.md`. The migration plan covers:

- **Content migration** — Articles, products, categories, tags, images, SEO metadata
- **URL preservation** — 301 redirects for all existing WordPress URLs
- **SEO continuity** — Title tags, meta descriptions, Open Graph, Twitter Cards
- **Plugin replacement** — Shopify equivalents for Yoast SEO, WooCommerce, Contact Form 7
- **Estimated effort** — 22–29 hours for a complete migration

The migration engine has not yet been built — the document is a detailed implementation blueprint.

## License

ISC
