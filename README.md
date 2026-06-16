# KOZMO Core — AI SEO Automation System

Multi-tenant SaaS platform that automates SEO content generation and publishing for Shopify stores. Uses AI (OpenAI GPT-4o) to research keywords, generate high-quality blog posts, optimize for SEO, and publish directly to Shopify — all with per-client rate limiting, cost tracking, and a full admin dashboard.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-black?style=flat-square&logo=express)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai)](https://openai.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow?style=flat-square)]()
[![CI](https://github.com/yusuf-mohamed0/KOZMO-Core/actions/workflows/ci.yml/badge.svg)](https://github.com/yusuf-mohamed0/KOZMO-Core/actions/workflows/ci.yml)

## Features

| Feature | Description |
|---------|-------------|
| **24-Stage Pipeline** | End-to-end orchestration: validation → keyword discovery → title gen → outline → article → SEO → CTA → FAQ → metadata → images → approval → publish → logging |
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
| **AI** | OpenAI API (GPT-4o, text-embedding-3-small, DALL-E 3) |
| **SEO** | SerpAPI (Google keyword data), custom SEO scoring engine |
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

Follow these steps to set up KOZMO Core on your own machine. No private data from the original author is included — everything uses placeholder examples.

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
git clone https://github.com/yusuf-mohamed0/KOZMO-Core.git
cd KOZMO Core
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
│   ├── services/                    # 26+ service modules
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
│   │   └── selfImprovementService.ts # Prompt optimization
│   ├── routes/                      # 24 route modules
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

{ "email": "admin@example.com", "password": "admin123" }

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

## License

ISC
