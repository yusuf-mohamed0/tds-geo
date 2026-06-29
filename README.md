# TDS Geo — AI SEO Automation System

Multi-tenant SaaS platform that automates SEO content generation and publishing for Shopify stores. Uses AI (OpenRouter / DeepSeek V4 Flash + custom LLM) to research keywords via DataForSEO, generate high-quality blog posts, optimize for SEO, and publish directly to Shopify — all with per-client rate limiting, cost tracking, and a full admin dashboard.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-black?style=flat-square&logo=express)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://postgresql.org/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-DeepSeek_V4-FF6B6B?style=flat-square)](https://openrouter.ai/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow?style=flat-square)]()
[![CI](https://github.com/yusuf-mohamed0/tds-geo/actions/workflows/ci.yml/badge.svg)](https://github.com/yusuf-mohamed0/tds-geo/actions/workflows/ci.yml)

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Stage Pipeline** | End-to-end orchestration: validation → keyword discovery → title gen → outline → article → SEO → CTA → FAQ → metadata → images → approval → publish → logging |
| **Keyword Discovery** | AI-powered research with DataForSEO (search volume, CPC, competition, trends, People Also Ask), clustering, scoring, dedup, and 90-day reuse prevention |
| **Content Generation** | Long-form SEO blog posts via OpenRouter (DeepSeek V4 Flash) with brand voice, E-E-A-T guidelines |
| **SEO Analysis** | Content scoring, keyword density, readability, quality scoring, internal linking optimization, OpenSEO integration |
| **Shopify Publishing** | Direct publish with image upload, tags, metadata, retry with backoff, rate-limit protection |
| **Multi-Tenant** | Per-client Shopify stores, keyword pools, generation settings, publishing queues, budgets |
| **JWT Authentication** | Role-based auth (admin, editor, client), login/logout, protected routes |
| **Webhook System** | Event-driven webhooks with retry delivery, delivery history, per-webhook config |
| **Plugin System** | Pluggable hook-based architecture (before/after stages) with per-client instances |
| **Chat Interface** | Natural language command interface for managing pipeline operations |
| **Prompt Management** | Versioned prompt templates with self-improvement tracking |
| **Cost Tracking** | Per-client, per-article cost tracking (OpenRouter, DataForSEO, Shopify) with monthly budgets |
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
| **AI** | OpenRouter (deepseek/deepseek-v4-flash), local LLM (ministral-3:14b) |
| **SEO Data** | DataForSEO (keyword volume, ideas, domain overview, competitors, backlinks, SERP, page audit) |
| **SEO Engine** | OpenSEO (Docker sidecar) for advanced analysis |
| **Web Scraper** | crawl4ai (Docker sidecar) for content crawling |
| **LLM Proxy** | headroom (Docker sidecar) for local LLM inference |
| **Images** | Pexels API for article featured images |
| **Auth** | JWT (jsonwebtoken + bcryptjs), 7-day expiry, role-based |
| **Container** | Docker + docker-compose (PostgreSQL, Redis, sidecars) |
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
                     │   Nginx (Port 443)   │
                     │  SSL + Reverse Proxy │
                     └──────────┬───────────┘
                                │
                     ┌──────────▼───────────┐
                     │   Express API        │
                     │  (TypeScript, :3000) │
                     └──┬───────┬───────┬───┘
                        │       │       │
               ┌────────▼──┐ ┌──▼────┐ ┌▼────────┐
               │ PostgreSQL│ │ Redis │ │ Docker   │
               │ (main DB) │ │(BullMQ│ │ Sidecars │
               │+ pgvector │ │ queue)│ │          │
               └───────────┘ └───────┘ └──┬───────┘
                                          │
                    ┌─────────────────────┼──────────────┐
                    ▼                     ▼              ▼
             ┌──────────┐          ┌──────────┐   ┌──────────┐
             │ OpenSEO  │          │ crawl4ai │   │ headroom │
             │ (:3005)  │          │ (:11235) │   │ (:8787)  │
             └──────────┘          └──────────┘   └──────────┘
                        │
               ┌────────▼────────────┐
               │  BullMQ Workers     │
               │ (separate process)  │
               └─────────────────────┘
```

## Quick Start (for New Users)

Follow these steps to set up TDS Geo on your own machine. No private data from the original author is included — everything uses placeholder examples.

### Prerequisites

You'll need these installed on your computer:

| Software | Version | Why you need it | Get it here |
|----------|---------|-----------------|-------------|
| **Node.js** | 20+ | Runs the backend & frontend | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | 14+ | Stores all data | [postgresql.org](https://www.postgresql.org/download/) |
| **Redis** | 7+ | Background job queue (optional) | [redis.io](https://redis.io/download/) |
| **Git** | Any | To clone the repo | [git-scm.com](https://git-scm.com/) |
| **Docker** | 24+ | Sidecar services (optional) | [docker.com](https://www.docker.com/) |

### API Keys You'll Need

| Service | Required? | What it's for | How to get it |
|---------|-----------|---------------|---------------|
| **OpenRouter** | ✅ Yes | AI content generation (DeepSeek V4 Flash) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Shopify** | ✅ Yes | Publishing articles & OAuth install | Shopify Partner Dashboard → Apps |
| **DataForSEO** | ✅ Yes | Keyword research, SERP, domain data | [dataforseo.com](https://dataforseo.com/) |
| **Pexels** | ❌ No | Free stock photos for articles | [pexels.com/api](https://www.pexels.com/api/) |

> **Tip:** If you don't have an OpenRouter key yet, you can still try the app! Leave `OPENAI_API_KEY` empty and the system runs in **mock mode** — all AI features return realistic sample data.

---

### Step 1: Clone the Project

```bash
git clone https://github.com/yusuf-mohamed0/tds-geo.git
cd TDS Geo
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
- `SHOPIFY_API_KEY` — Your Shopify app client ID
- `SHOPIFY_API_SECRET` — Your Shopify app client secret
- `SHOPIFY_APP_URL` — Your app URL (use `https://your-ip.nip.io` for local dev)
- `DATABASE_URL` — Your PostgreSQL connection string
- `JWT_SECRET` — A random string for security (generate one with `openssl rand -hex 32`)
- `SHOPIFY_DEFAULT_SHOP` — Your shop's `.myshopify.com` URL
- `SHOPIFY_DEFAULT_ACCESS_TOKEN` — Your Shopify Admin API token

- `DATAFORSEO_API_KEY` — SEO data (keyword volume, competitors, SERP, etc.)
- `PEXELS_API_KEY` — Optional, for stock photo integration

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

> The seed data includes demo accounts: `admin@example.com` / `admin123`

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
- **Login:** `admin@example.com` / `admin123`

---

### Docker Sidecar Setup (Optional)

For advanced SEO features, start the Docker sidecars:

```bash
docker compose -f docker-compose.sidecars.yml up -d
```

This starts:
- **OpenSEO** (port 3005) — SEO analysis engine
- **crawl4ai** (port 11235) — Web content crawling
- **headroom** (port 8787) — Local LLM inference proxy
- **FreellmAPI** (port 8080) — Free LLM API

## Production Deployment

### AWS EC2 Deployment

The app is deployed on **AWS EC2 c7i-flex.large** (eu-north-1, Stockholm):

| Resource | Detail |
|----------|--------|
| **Instance** | c7i-flex.large (2 vCPU, 4 GB RAM) |
| **Storage** | 40 GB EBS (gp3) |
| **IP** | Elastic IP `16.192.29.174` (permanent) |
| **Domain** | `https://16.192.29.174.nip.io` |
| **SSL** | Let's Encrypt (auto-renew via Certbot) |
| **OS** | Ubuntu 24.04 (Noble) |
| **Process** | PM2 cluster mode |
| **Swap** | 2 GB (prevents OOM on OpenSEO builds) |

### Manual Deployment

```bash
# 1. Build backend TypeScript
npm run build

# 2. Build frontend
cd frontend && npm run build && cd ..

# 3. Start with PM2
npx pm2 start ecosystem.config.cjs

# 4. (Optional) Save PM2 config to restart on reboot
npx pm2 save
npx pm2 startup
```

### SSL Setup

```bash
# Obtain Let's Encrypt certificate
sudo certbot certonly --standalone \
  --non-interactive --agree-tos \
  --email you@example.com \
  -d your-ip.nip.io

# nginx config routes HTTPS to Express on port 3000
```

### Health Monitoring

A cron job runs every 6 hours checking:
- Health endpoint (`/health`) returns 200
- SSL certificate expires in less than 14 days
- Nginx is running
- PM2 process is alive

## Project Structure

```
├── backend/
│   ├── index.ts                     # Express app + route mounting
│   ├── orchestrators/
│   │   └── blogPipeline.ts          # Multi-stage pipeline orchestrator
│   ├── workers/
│   │   └── index.ts                 # BullMQ worker processors
│   ├── services/
│   │   ├── openai.ts                # OpenRouter/DeepSeek client wrapper
│   │   ├── dataforseo.ts            # DataForSEO client (10 endpoints)
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
│   │   ├── heartbeatService.ts      # Heartbeat email alerts
│   │   └── selfImprovementService.ts # Prompt optimization
│   ├── routes/                      # 24+ route modules
│   │   ├── shopifyInstall.ts        # OAuth install flow
│   │   ├── billing.ts               # Shopify Billing API
│   │   ├── complianceWebhooks.ts    # GDPR compliance endpoints
│   │   └── ...
│   ├── scripts/                     # Utility scripts
│   │   └── update-webhooks.ts       # Compliance webhook updater
│   ├── middleware/auth.ts           # JWT auth + RBAC
│   ├── database/                    # Schema & seed data
│   └── tests/                       # 217 tests
├── frontend/
│   ├── src/
│   │   ├── components/              # Shared UI primitives
│   │   │   ├── Card.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── FormField.tsx
│   │   │   └── Layout.tsx
│   │   └── pages/                   # Route pages
│   └── index.html
├── scripts/                      # Utility & pipeline scripts
├── docker/nginx.conf
├── docker-compose.yml
├── docker-compose.sidecars.yml   # OpenSEO, crawl4ai, headroom
├── ecosystem.config.cjs          # PM2 config
└── doc/                          # Documentation
```

## API Reference

### Authentication

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@example.com", "password": "admin123" }

# Response: { "token": "eyJhbGci...", "user": { ... } }
```

All other endpoints require: `Authorization: Bearer <token>`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (JSON status + subsystem checks) |
| `GET` | `/` | Serves the React SPA |
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
| `POST` | `/api/clients/:clientId/keywords/discover` | Discover keywords via DataForSEO |
| `GET` | `/api/shopify/install` | Start OAuth install flow |
| `GET` | `/api/shopify/callback` | OAuth callback handler |
| `GET` | `/api/webhooks/compliance` | GDPR compliance endpoints |
| `POST` | `/api/chat/sessions` | Create chat session |
| `POST` | `/api/chat/sessions/:id/messages` | Send chat message |
| `GET` | `/api/admin/summary` | Platform-wide stats |
| `GET` | `/api/admin/errors` | Recent errors |
| `GET` | `/api/heartbeat/status` | Heartbeat monitor status |

### Shopify OAuth Flow

1. Merchant visits `/api/shopify/install?shop=store.myshopify.com`
2. Redirected to Shopify OAuth authorization page
3. After approval, Shopify calls back to `/api/shopify/callback`
4. Token exchanged and stored in `clients` table
5. `app/uninstalled` webhook registered for cleanup

## Testing

```bash
npm test                 # Run all unit/service tests (217 tests, 11 files)
npm run test:e2e         # Run E2E pipeline integration tests
npm run test:watch       # Watch mode
npm run typecheck        # Backend TypeScript typecheck
cd frontend && npx tsc --noEmit  # Frontend typecheck
```

**217 tests across 11 files** — all passing with zero type errors.

## CI/CD

GitHub Actions workflows:
- **CI** — Lint, TypeScript typecheck, run all tests, build frontend & backend
- **Docker Deploy** — Build multi-arch Docker image, push to GHCR, deploy via SSH

## Key Design Decisions

1. **Singleton services with `initialize(pool)`** — All services share one DB pool
2. **Graceful degradation** — Redis, pgvector, DataForSEO, and plugin tables are optional
3. **Stage-level error isolation** — Pipeline wraps each stage in try/catch
4. **Async batch logging** — LogBuffer batches DB writes every 2 seconds
5. **Plugin system via hooks** — Pluggable architecture for before/after stages
6. **Natural language CLI** — Regex-based pattern matching for fast command parsing
7. **Cost-first routing** — Routes tasks to optimal AI model based on complexity
8. **TypeScript strict mode** — Zero type errors across frontend and backend
9. **Best-effort DataForSEO** — keyword/domain data enriches prompts but never blocks generation on failure
10. **CORS dynamic origin** — Allows `*.nip.io`, `*.myshopify.com`, `admin.shopify.com`, `localhost:5173`

## License

ISC
