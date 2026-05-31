# AI-Powered SEO Blog Automation Platform — Complete Project Blueprint

> **Purpose:** This document is a comprehensive specification you can give to any AI agent provider (Cursor, GitHub Copilot, Codebuff, Claude Engineer, etc.) to recreate this full-stack project from scratch. It covers every component: backend, frontend, database, services, tests, deployment, and architecture decisions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema & Migrations](#4-database-schema--migrations)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Services — Deep Dive](#7-services--deep-dive)
8. [Pipeline Orchestrator (The Core Engine)](#8-pipeline-orchestrator-the-core-engine)
9. [API Routes](#9-api-routes)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Configuration](#12-deployment-configuration)
13. [Development Workflow](#13-development-workflow)

---

## 1. Project Overview

A full-stack **AI-powered SEO blog content automation platform** that generates, optimizes, and publishes SEO-optimized blog articles to Shopify stores (and other CMS platforms) with an enterprise-grade pipeline, plugin system, editorial workflow, cost tracking, and analytics.

**Core Capabilities:**
- AI blog article generation with OpenAI (GPT-4o) — automatic outline, content, FAQ, metadata
- Keyword research via SerpAPI (Google search volume, competition, CPC, trends)
- Content safety checking (8+ hazard categories, hallucination detection, medical claims, electrical/gas hazards)
- Quality scoring (E-E-A-T, readability, SEO optimization, semantic richness, CTA quality)
- Multi-CMS publishing (Shopify primary, extensible to WordPress, Contentful, etc.)
- Plugin system with hook-based architecture (before/after pipeline stages)
- Editorial workflow (draft → review → approve/reject → publish)
- Cost tracking & budget enforcement per client
- Vector memory/embedding for duplicate detection and content relationships
- Self-improvement system that analyzes past results to optimize prompts
- Observability with distributed tracing spans
- Circuit breaker pattern for external API resilience
- Natural language chat interface for pipeline commands

---

## 2. Tech Stack

| Layer | Technology | Version/Notes |
|-------|-----------|---------------|
| **Runtime** | Node.js 22+ | TypeScript with `tsx` runner |
| **Backend Framework** | Express.js | Routes as modular routers |
| **Frontend Framework** | React 18+ | With TypeScript |
| **Build Tool** | Vite 5+ | React SPA with dev proxy |
| **Database** | PostgreSQL | 16/18, with `pg` driver |
| **Vector Extension** | pgvector | For embedding similarity search |
| **Queue/Jobs** | BullMQ (Redis) | Optional, graceful degradation |
| **Auth** | JWT (jsonwebtoken) + bcryptjs | Middleware-based |
| **AI/LLM** | OpenAI API (GPT-4o) | With mock mode for dev |
| **SEO Data** | SerpAPI | Google search data |
| **Images** | Pexels API | For article featured images |
| **Testing** | Vitest | 193 tests across 8 files |
| **Process Manager** | PM2 | `ecosystem.config.cjs` |
| **Container** | Docker + docker-compose | PostgreSQL, Redis, app |

---

## 3. Project Structure

```
/root/my-project/
├── backend/
│   ├── index.ts              # Express app factory (CORS, routes, startup)
│   ├── orchestrators/
│   │   └── blogPipeline.ts   # Enterprise pipeline orchestrator (24 stages)
│   ├── workers/
│   │   └── index.ts          # BullMQ worker processors
│   ├── validators/
│   │   └── index.ts          # Request validation schemas
│   ├── middleware/
│   │   └── auth.ts           # JWT auth middleware + role-based access
│   ├── routes/               # 24 route modules (see §9)
│   ├── services/             # 26 service modules (see §7)
│   ├── repositories/         # 4 data access layers (article, client, keyword, log)
│   ├── queues/
│   │   └── definitions.ts    # Queue names, job types, job schemas
│   ├── types/
│   │   └── index.ts          # Shared TypeScript interfaces & types
│   ├── utils/
│   │   ├── logger.ts         # Structured logging (winston-like)
│   │   ├── queue.ts          # BullMQ wrapper with graceful fallback
│   │   └── markdownToHtml.ts # MD → HTML converter
│   ├── database/
│   │   ├── schema.sql        # Core tables (30+ tables, triggers, functions, views)
│   │   ├── schema-comprehensive.sql  # Full schema in one file
│   │   ├── seed.sql          # Dev seed data
│   │   ├── migration_shopify_oauth.sql
│   │   ├── migration_v2.sql
│   │   ├── migration_platform_v1.sql
│   │   └── migration_enterprise_v4.sql
│   └── tests/                # See §11
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Router setup (react-router-dom v6)
│   │   ├── styles.css        # Full app CSS (dark theme, responsive)
│   │   ├── hooks/
│   │   │   └── useAuth.tsx   # Auth context provider
│   │   ├── services/
│   │   │   └── api.ts        # API client (axios, JWT injection, error handling)
│   │   ├── components/
│   │   │   ├── Layout.tsx    # App shell (sidebar nav, header)
│   │   │   ├── Card.tsx      # Reusable card component
│   │   │   ├── DataTable.tsx # Sortable, filterable data table
│   │   │   ├── Modal.tsx     # Overlay modal dialog
│   │   │   ├── Toast.tsx     # Toast notification system
│   │   │   ├── FormField.tsx # Reusable form input wrapper
│   │   │   └── ShopifyAppProvider.tsx  # Shopify OAuth app bridge
│   │   ├── pages/            # 24 page components (see App.tsx routes)
│   │   └── types/
│   │       └── index.ts      # Frontend type definitions
│   ├── index.html
│   ├── vite.config.ts        # Vite config (proxy /api → :3000)
│   ├── tsconfig.json
│   └── tsconfig.node.json
├── .env                      # Environment variables (keys, DB URL, JWT secret)
├── package.json              # Backend deps + scripts
├── tsconfig.json             # Backend TypeScript config
├── vitest.config.ts          # Unit test config
├── vitest.e2e.config.ts      # E2E test config
├── Dockerfile                # Multi-stage production build
├── docker-compose.yml        # PostgreSQL + Redis + App
├── docker/nginx.conf         # Nginx reverse proxy config
├── ecosystem.config.cjs      # PM2 process configuration
├── start-dev.sh              # Dev startup script (DB + backend + frontend)
└── .github/workflows/
    ├── ci.yml                # CI pipeline (lint, test, build)
    └── docker-deploy.yml     # Docker deployment
```

---

## 4. Database Schema & Migrations

### 4.1 Database Setup

- **Name:** `ai_seo_automation`
- **User:** `postgres` (password set in `.env`)
- **Run order:** `schema.sql` → `migration_shopify_oauth.sql` → `migration_v2.sql` → `migration_platform_v1.sql` → `migration_enterprise_v4.sql` → `seed.sql`
- **Trigger note:** PostgreSQL does not support `CREATE TRIGGER IF NOT EXISTS`. Instead use `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` pattern.

### 4.2 Core Tables (schema.sql)

- `clients` — Client/Shopify store configuration (shop URL, token, brand voice, service area, timezone, publish frequency, approval mode, budget limits, settings JSONB)
- `users` — User accounts (email, name, password_hash, role enum `['admin', 'editor', 'viewer', 'client']`, client_id FK, last_login_at)
- `articles` — Blog articles (title, slug, keyword, status enum, content_md, content_html, meta_title, meta_description, tags TEXT[], seo_score, word_count, quality_score, client_id FK, keyword_id FK, published_url, published_at, error_log TEXT)
- `keywords` — Keyword research data (keyword, search_volume, competition, cpc, trend_score, relevance_score, client_id FK, source enum)
- `keyword_clusters` — Grouped keywords with topic metadata
- `webhooks` — Webhook configurations (url, events TEXT[], secret, headers JSONB)
- `schedules` — Content publishing schedules
- `publishing_queue` — Queued publish actions with status tracking
- `activity_logs` — Audit log (level, action, message, metadata JSONB)
- `cost_tracking` — Cost per operation (provider, model, tokens_in/out, cost, article_id)
- `seo_analytics` — SEO performance data
- `article_images` — Associated images (url, alt_text, photographer info)
- `system_config` — Key-value configuration store
- `chat_sessions` / `chat_messages` — Chat history
- `jobs` — Job queue metadata

### 4.3 Migration v2 Tables

- `audit_trail` — Detailed entity change tracking
- `analytics_events` — User interaction events
- `campaigns` — Content marketing campaigns
- Improved triggers with `updated_at` auto-update

### 4.4 Platform v1 Tables (Platform Expansion)

- `api_keys` — Per-service API key management (service, label, masked_value, key_hash, is_active, client_id)
- `plugin_registry` — Plugin definitions (name, slug, version, description, entry_point, hooks TEXT[], config_schema JSONB, default_config JSONB)
- `plugin_instances` — Per-client plugin activation (client_id, plugin_id FK, config JSONB, is_enabled)
- Platform views, enhanced activity log triggers, config-by-category

### 4.5 Enterprise v4 Tables (Enterprise Features)

- `self_improvement_log` — Prompt optimization history
- `workflow_logs` — Pipeline execution logs per client
- `editorial_tasks` — Review assignments
- `fact_check_results` — Fact verification records
- `evaluation_results` — AI quality evaluation scores
- `content_intelligence` — Topic/saturation analytics
- `cms_connections` — Multi-CMS connections (provider enum, credentials JSONB, is_active)
- `publishing_history` — Publish records with provider, external_id/URL
- `brand_voice_profiles` — Brand voice configuration
- `enterprise_audit_log` — Compliance audit trail
- `vector_embeddings` — pgvector-based article embeddings

### 4.6 Views

- `v_client_summary` — Per-client stats (total articles, published, avg seo_score, avg quality_score, total cost)
- `v_daily_production` — Daily article production metrics
- `v_recent_articles` — Recent articles with keyword and client info
- `v_keyword_performance` — Keyword performance analytics
- `v_cost_analysis` — Cost breakdown by client/model
- `v_cms_publishing_health` — CMS publishing success rates

### 4.7 Custom Types (Enums)

```sql
CREATE TYPE article_status AS ENUM ('generated', 'approved', 'rejected', 'published', 'failed', 'archived');
CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer', 'client');
CREATE TYPE keyword_source AS ENUM ('manual', 'serpapi', 'suggestion', 'ai_generated');
CREATE TYPE log_level AS ENUM ('info', 'warn', 'error', 'debug');
CREATE TYPE approval_mode AS ENUM ('auto', 'manual');
CREATE TYPE cms_provider AS ENUM ('shopify', 'wordpress', 'contentful', 'custom');
CREATE TYPE article_editorial_status AS ENUM ('draft', 'in_review', 'approved', 'rejected', 'published');
```

### 4.8 Seed Data

- 2 users (admin + editor)
- 1 test client with full config
- 3 keywords with research data
- 2 articles (one published, one generated)
- Activity logs, SEO analytics entries

---

## 5. Backend Architecture

### 5.1 Entry Point (`backend/index.ts`)

```typescript
// Express app factory:
// 1. Load .env config
// 2. Create Express app
// 3. CORS setup (origin from env, credentials true)
// 4. JSON body parser
// 5. Health endpoint: GET /health → { status: 'healthy', database: 'healthy'|'unhealthy', memory: RSS, uptime }
// 6. Mount routes under /api/*
// 7. Initialize all enterprise services (graceful, catch errors)
// 8. Start server on PORT (env, default 3000)
// 9. Graceful shutdown (SIGTERM/SIGINT → close DB, Redis, server)
```

### 5.2 Config Loading

- `.env` file with: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `OPENAI_API_KEY`, `SERPAPI_API_KEY`, `PEXELS_API_KEY`, `SHOPIFY_API_KEY`, `SHOPIFY_SECRET`, `SHOPIFY_DEFAULT_ACCESS_TOKEN`, `REDIS_URL`, `CORS_ORIGIN`
- OPENAI_API_KEY empty → DEV MOCK MODE (system functions without AI)
- All keys loaded via `process.env` with defaults

### 5.3 Middleware Stack

```
Request → CORS → JSON Parser → Auth (protected paths) → Route Handler → Response
```

- Auth middleware: Extract JWT from `Authorization: Bearer <token>`, verify, attach `req.user`
- Auth middleware also: Rate limiting info, audit logging
- Role hierarchy: `admin` > `editor` > `client` > `viewer`

### 5.4 Database Connection

- `pg` Pool with `DATABASE_URL` or individual params (host, port, user, password, database)
- Pool shared across all routes and services via dependency injection
- Connection query per request for status verification

### 5.5 Queue System (`backend/utils/queue.ts`)

- BullMQ wrapper with Redis
- **Queue names:** `content-generation`, `keyword-research`, `shopify-publish`, `seo-analysis`, `default`
- **Graceful degradation:** If Redis unavailable, return mock job IDs and log warning
- Functions: `addJob(queue, jobData)`, `getJobStatus(jobId)`

### 5.6 Logger (`backend/utils/logger.ts`)

- Structured JSON logging (timestamp, level, message, context)
- Log levels: `error`, `warn`, `info`, `debug`
- Also writes to `activity_logs` table when pool is available
- Context-aware (request ID, user ID, client ID)

---

## 6. Frontend Architecture

### 6.1 Tech Stack

- React 18+ with TypeScript
- react-router-dom v6 for routing
- Axios for HTTP (with interceptors for JWT injection and 401 handling)
- Vite 5 for dev server and build

### 6.2 Routing (`App.tsx`)

```
/ → Redirect to /dashboard
/login → Login.tsx (public)
Unauthenticated → /login
Authenticated with Layout wrapper:
  /dashboard            → Dashboard.tsx
  /articles             → Articles.tsx
  /articles/:id         → ArticleDetail.tsx
  /pipeline             → PipelineDashboard.tsx
  /queue                → QueueDashboard.tsx
  /content-intelligence → ContentIntelligence.tsx
  /seo                  → (via SEO card)
  /analytics            → Analytics.tsx
  /observability        → Observability.tsx
  /cms                  → CmsConnections.tsx
  /webhooks             → Webhooks.tsx
  /brand-voice          → BrandVoice.tsx
  /fact-checking        → FactChecking.tsx
  /ai-evaluation        → AiEvaluation.tsx
  /security             → Security.tsx
  /plugins              → Plugins.tsx
  /api-keys             → ApiKeys.tsx
  /prompts              → Prompts.tsx
  /admin                → Admin.tsx
  /chat                 → Chat.tsx
  /pexels               → Pexels.tsx
  /clients              → Clients.tsx
  /config               → Config.tsx
  /settings             → Settings.tsx
  /improvements         → Improvements.tsx
  /cost-optimization    → CostOptimization.tsx
  /editorial-workflow   → EditorialWorkflow.tsx
  /shopify/welcome      → ShopifyWelcome.tsx
  /login                → Login.tsx
  /usage                → ApiUsage.tsx
```

### 6.3 Auth Flow (`hooks/useAuth.tsx`)

- Context provider wrapping the entire app
- On mount: check localStorage for JWT token
- If token exists: set as authorized, decode user info
- If no token: redirect to `/login`
- Login function: `POST /api/auth/login` → receive JWT → store in localStorage → redirect to `/dashboard`
- Logout function: clear localStorage → redirect to `/login`
- Axios interceptor: attach `Authorization: Bearer <token>` header to all requests, handle 401 by redirecting to login

### 6.4 API Client (`services/api.ts`)

```typescript
// Axios instance with baseURL from env
// Response interceptor: unwrap response.data
// Error interceptor: parse error messages, handle 401
// Functions:
//   getAuthHeaders() → { Authorization: 'Bearer ' + token }
//   get(resource, params?) → GET /api/{resource}
//   post(resource, data) → POST /api/{resource}
//   put(resource, data) → PUT /api/{resource}
//   del(resource) → DELETE /api/{resource}
```

### 6.5 Styling (`styles.css`)

- Dark theme with CSS custom properties
- Color palette:
  - Background: `#0f0f13` (app), `#1a1a23` (cards), `#24243a` (hover)
  - Primary: `#6c63ff` (purple), `#00d4aa` (accent green)
  - Text: `#e8e8f0` (primary), `#8888a0` (muted)
  - Danger: `#ff4444`, Warning: `#ffaa00`, Success: `#00d4aa`
  - Borders: `#2a2a3d`
- Component classes: `.card`, `.btn`, `.btn-primary`, `.btn-danger`, `.input`, `.select`, `.table`, `.modal-overlay`, `.toast`, `.toast-success`, `.toast-error`, `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`
- Responsive sidebar layout with collapsible nav
- Loading spinners, skeleton screens
- Form validation styles (error borders, error messages)
- Smooth transitions on all interactive elements

### 6.6 Shared Components

| Component | Props | Behavior |
|-----------|-------|----------|
| **Layout** | children | Sidebar (nav links + active state), header (user info + logout), main content area |
| **Card** | title, children, className, actions | Styled container with optional header and action buttons |
| **DataTable** | columns[], data[], onSort, onFilter | Sortable by column click, filterable by search input, pagination |
| **Modal** | isOpen, onClose, title, children, size | Overlay modal with backdrop click-to-close, escape key close |
| **Toast** | message, type (success/error/info), duration, onClose | Auto-dismissing notification, stacked positioning |
| **FormField** | label, error, children, required | Label + input wrapper with validation error display |

---

## 7. Services — Deep Dive

### 7.1 AI & Content Services

#### `openai.ts` — OpenAI Integration
- **Methods:** `generateBlogPost(params)`, `generateTitle(keyword)`, `generateOutline(keyword, title, blacklist)`, `generateFAQ(keyword, count)`, `generateMetadata(title, content, keyword)`, `enhanceSEO(content, keyword)`, `moderateContent(content)`, `generateArticleImage(title, keyword)`, `analyzeSEO(content, keyword)`, `generateKeywordVariations(seed, count)`, `chat(messages, options)`
- **Model management:** GPT-4o default, configurable via `setProvider()` and env vars
- **Mock mode:** When `OPENAI_API_KEY` is empty, all methods return realistic mock data
- **Error handling:** All API errors caught and logged, graceful fallback to heuristic methods

#### `chatEngine.ts` — Natural Language Command Engine
- **`parseCommand(input)` →** Pattern-matches user input to structured commands:
  - `generate N articles about KEYWORD [for client ID]` → `{ action: 'generate_article', count, keyword, clientId }`
  - `publish article ID [to blog BLOG_ID]` → `{ action: 'publish_article', articleId, blogId }`
  - `research keywords for SEED [in INDUSTRY]` → `{ action: 'research_keywords', seedKeyword, industry }`
  - `create client "NAME" shop: URL token: TOKEN` → `{ action: 'create_client', ... }`
  - `approve/reject article ID [because: REASON]` → approval workflow
  - `run plugin SLUG [hook HOOK_NAME]` → plugin execution
  - `analyze seo for article ID` → SEO analysis
  - `check status of job ID` → job status
  - `list articles/clients/keywords/users/plugins/api keys/logs` → data listing
  - `delete article/client ID` → soft delete
  - `update config KEY to VALUE` → system config
  - `help`, `hello`, `thanks`, `what can you do` → conversational fallbacks
- **`checkPermission(cmd, role)` →** Role-based access control matrix
- **`executeCommand(cmd, user)` →** Execute parsed command with job queuing or direct DB ops
- **`generateResponse(input, history, user)` →** Top-level orchestrator: parse → check permission → execute → return result

#### `contentSafety.ts` — Content Safety & Hazard Detection
- **`checkContent(content, keyword)` →** Scans for 8+ hazard categories:
  - `electrical_hazard` — DIY electrical work (severity: critical)
  - `gas_hazard` — Gas line/pipe DIY (critical)
  - `structural_hazard` — Load-bearing wall removal (critical)
  - `toxic_hazard` — Asbestos, chemical handling (critical)
  - `medical_claim` — Unsubstantiated health claims
  - `overpromise` — "Guaranteed results", "100% satisfaction"
  - `hallucinated_stat` — Unrealistic statistics ("75% of homes...")
  - `unsubstantiated_citation` — Vague references ("a study by Research Institute")
- Returns: `{ safe, flags: [{ category, severity, text, suggestion }], needsHumanReview, summary }`

#### `qualityScorer.ts` — Content Quality Scoring
- **`scoreArticle(content, keyword)` →** Multi-dimensional scoring:
  - `readability` (0-100) — Paragraph length, sentence complexity, list usage, heading structure
  - `seoOptimization` (0-100) — Keyword density (target 1-3%), title usage, first-100-words presence
  - `eatScore` (0-100) — E-E-A-T signals (experience indicators, credentials, citations, author info)
  - `semanticRichness` (0-100) — LSI keywords, semantic variations, entity coverage
  - `ctaQuality` (0-100) — Clear calls to action, urgency, contact info, offers
  - `uniqueness` (0-100) — Original phrasing, not template-like
  - `overall` (weighted average)
- Returns: `{ overall, readability, seoOptimization, eatScore, semanticRichness, ctaQuality, uniqueness, breakdown: {...}, suggestions: string[] }`

#### `seo.ts` — SEO Analysis & Validation
- **`analyzeContent(content, keyword)` →** Heuristic SEO analysis with keyword density, heading structure, intro keyword presence, readability score
- **`generateSlug(title)` →** URL-safe slug generation
- **`validateContent(article)` →** Validates title length (≥10 chars), content length (≥200 words), meta fields, tags (≥1), returns errors array
- **`generateSocialPreview(content, maxLength)` →** Strip markdown, truncate with ellipsis

#### `seoIntelligence.ts` — Advanced SEO Intelligence
- **`classifySearchIntent(keyword)` →** Returns intent type (informational/commercial/transactional/navigational) with confidence score and suggested content format
- **`analyzeSERP(keyword)` →** SERP feature analysis (featured snippets, PAA, knowledge panels, etc.) and entity landscape
- **`analyzeContentSEO(content, keyword)` →** Deep SEO content analysis with entity extraction and gap detection

#### `keywords.ts` — Keyword Research & Management
- **`discoverKeywords(clientId, industry, seedKeywords, count)` →** Keyword discovery with research data
- **`getBestKeywords(clientId, limit)` →** Top keywords by relevance and volume
- **`markKeywordUsed(keywordId, articleId)` →** Track keyword usage

#### `internalLinks.ts` — Internal Linking Engine
- **`refreshArticleCache(pool)` →** Cache all published articles for link opportunity analysis
- **`findLinkOpportunities(content, keyword, clientId)` →** Find relevant internal link targets
- **`injectLinks(content, links)` →** Inject markdown links into content

#### `factCheckService.ts` — Fact Verification
- **`verifyArticle(content)` →** Verify claims, return confidence score, fact checks, and citations
- Tracks: `fact_check_results` table

#### `brandVoice.ts` — Brand Voice Enforcement
- **`getContentGuidance(clientId)` →** Get forbidden phrases, preferred terminology, tone guidelines
- **`checkConsistency(content, clientId)` →** Score brand consistency, list violations
- Configurable profiles stored in `brand_voice_profiles` table

### 7.2 Publishing & CMS Services

#### `shopify.ts` — Shopify API Client
- **`fetchBlogs(shopConfig)` →** List Shopify blogs for a store
- **`fetchArticles(shopConfig)` →** List existing articles
- **`publishArticle(shopConfig, blogId, articleData)` →** Create and publish article to Shopify
- **`uploadImage(shopConfig, articleId, imageUrl, altText)` →** Upload article image
- **`getRateLimitStatus(shopConfig)` →** Check API rate limit (calls/remaining)

#### `shopifyOAuth.ts` — Shopify OAuth 2.0 Flow
- **`generateInstallUrl(shop, redirectUri)` →** Generates Shopify OAuth install URL with scopes
- **`handleCallback(shop, code)` →** Exchange code for access token, store session in DB
- **`getSession(shop)` →** Retrieve stored OAuth session
- Stores in `shopify_sessions` table

#### `multiCmsPublisher.ts` — Multi-CMS Publishing
- **`publish(clientId, articleId, provider)` →** Publish to configured CMS provider (Shopify, WordPress, Contentful, custom)
- Supports extensibility via connection config
- Records in `publishing_history` table

#### `pexelsService.ts` — Pexels Image Integration
- **`findImagesForArticle(title, sections, clientId)` →** Find relevant images: featured image + section images
- Returns: `{ featuredImage: { url, altText, photographer, photographerUrl, pexelsId }, sectionImages: [...] }`
- Caches results, async initialization

### 7.3 System & Infrastructure Services

#### `costTracker.ts` — Cost Tracking & Budget Management
- **`calculateOpenAICost(model, tokensIn, tokensOut)` →** Cost estimation for OpenAI models
- **`recordCost(entry)` →** Record cost entry to `cost_tracking` table
- **`getMonthlyUsage(params)` →** Aggregate monthly usage by client/provider
- **`isBudgetExceeded(clientId)` →** Check if monthly budget is exceeded
- Model pricing table for GPT-4o, GPT-4o-mini, etc.

#### `costOptimization.ts` — Cost Routing Engine
- **`routeTask(task)` →** Route AI tasks to optimal model/provider based on complexity and cost
- **`recordTokenUsage(params)` →** Track token usage for optimization analytics
- Returns: `{ model, provider, estimatedCost, maxTokens, reason }`

#### `vectorMemory.ts` — Semantic Memory & Embeddings
- **`generateEmbedding(text)` →** Generate vector embedding for text
- **`storeArticleChunks(articleId, content)` →** Chunk and store article embeddings
- **`findSimilar(embedding, threshold)` →** Find semantically similar content
- **`isDuplicate(content)` →** Check if content is duplicate (cosine similarity)
- Uses pgvector extension

#### `webhooks.ts` — Webhook Delivery System
- **`trigger(event, clientId, payload)` →** Fire webhooks matching event type
- Configurable per client, retry logic, signature verification

#### `observability.ts` — Distributed Tracing
- **`startSpan(name, parentContext)` →** Create tracing span with ID
- **`endSpan(spanId, status)` →** Close span with status
- **`recordAILatency(model, durationMs)` →** Track AI latency metrics
- Spans connect to form distributed traces

#### `circuitBreaker.ts` — Circuit Breaker Pattern
- Monitors external service call failures
- Opens circuit after threshold exceeded, prevents cascading failures
- Half-open state for recovery testing
- Protects: OpenAI, SerpAPI, Shopify API, Pexels API

#### `enterpriseSecurity.ts` — Security & Compliance
- Audit logging for sensitive operations
- Access control enforcement
- API key hashing and validation
- Enterprise compliance tracking

#### `selfImprovementService.ts` — Self-Improving Pipeline
- **`getSuggestions()` →** Analyze past pipeline runs for optimization opportunities
- **`getPerformanceStats()` →** Performance metrics by stage, model, client
- **`runFullAnalysis()` →** Full self-improvement analysis
- Records in `self_improvement_log` table, used to automatically refine prompts

#### `editorialWorkflow.ts` — Editorial Workflow
- **`createReviewAssignment(articleId, reviewerId)` →** Assign article for review
- **`advanceStatus(articleId, newStatus, userId)` →** Move article through workflow
- Supports: draft → in_review → approved/rejected → published

#### `contentIntelligence.ts` — Content Strategy Intelligence
- **`detectCannibalization(clientId, keyword)` →** Detect keyword cannibalization across articles
- **`findLinkingOpportunities(articleId)` →** Find internal linking opportunities
- **`analyzeTopicSaturation(clientId, topic)` →** Analyze topic saturation (saturation_score, article_count, recommendation)

#### `aiEvaluation.ts` — AI Quality Evaluation
- **`evaluateContent(content, keyword)` →** Multi-dimensional AI evaluation of content quality
- **`generateQualityReport(articleId)` →** Generate comprehensive quality report
- Returns: `{ overall, feedback, dimensions: { readability, seo, accuracy, ... } }`

#### `pluginService.ts` — Plugin System
- **`initialize(pool)` →** Initialize with DB pool, verify tables exist
- **`executeHook(hookName, context)` →** Execute all active plugins for a given hook
- **`getClientPlugins(clientId)` →** List active plugin instances for a client
- **`registerInstance(pluginSlug, clientId, config?)` →** Create a plugin instance
- **`toggleInstance(instanceId, clientId)` →** Enable/disable a plugin
- **`updateConfig(instanceId, clientId, config)` →** Update plugin configuration
- **`close()` →** Cleanup
- **Graceful degradation:** If plugin tables don't exist, return empty arrays (doesn't crash)

---

## 8. Pipeline Orchestrator (The Core Engine)

**File:** `backend/orchestrators/blogPipeline.ts`

### 8.1 Class: `EnterprisePipelineOrchestrator`

```typescript
constructor(pool: Pool)  // Takes DB pool
```

### 8.2 Main Method

```typescript
async runFullPipeline(
  clientId: string,
  keyword: string,
  options: PipelineOptions
): Promise<PipelineResult>
```

**PipelineOptions:**
```typescript
{
  publish?: boolean;       // Auto-publish after generation
  minWords?: number;       // Minimum word count
  maxWords?: number;       // Maximum word count
  bypassDedup?: boolean;   // Skip duplicate detection
  usePexels?: boolean;     // Use Pexels for images
}
```

### 8.3 Pipeline Stages (24 stages, executed in order)

| Stage | What It Does |
|-------|-------------|
| 1. `keyword_discovery` | Load client config, validate keyword, search volume data |
| 2. `search_intent` | Classify search intent (informational/commercial/etc.) |
| 3. `serp_entity_analysis` | Analyze SERP features and entity landscape |
| 4. `brand_voice` | Get brand voice guidance |
| 5. `title_generation` | Generate SEO-optimized title |
| 6. `outline_generation` | Generate article outline/sections |
| 7. `article_generation` | Generate full article content with OpenAI |
| 8. `seo_enhancement` | Enhance SEO with keyword optimization |
| 9. `quality_gate` | Score article quality (min 50/100 threshold) |
| 10. `fact_checking` | Verify factual claims |
| 11. `brand_consistency` | Check brand voice compliance |
| 12. `cannibalization_check` | Check for keyword cannibalization |
| 13. `content_safety` | Check for hazards, medical claims, etc. |
| 14. `html_conversion` | Convert Markdown to HTML |
| 15. `internal_linking` | Inject internal links |
| 16. `pexels_images` | Find and attach images from Pexels |
| 17. `faq_schema` | Add FAQ schema markup |
| 18. `cta_insertion` | Insert call-to-action |
| 19. `article_storage` | Save to database |
| 20. `vector_embedding` | Store vector embeddings for similarity |
| 21. `quality_evaluation` | AI-powered quality evaluation |
| 22. `topic_saturation` | Analyze topic saturation |
| 23. `editorial_workflow` | Create review assignment (if manual mode) |
| 24. `webhook_notification` | Fire completion webhook |

### 8.4 PipelineResult

```typescript
{
  success: boolean;
  articleId?: string;
  title?: string;
  keyword: string;
  clientId: string;
  duration: number;  // ms
  stages: PipelineStageResult[];
  published?: boolean;
  publishUrl?: string;
  wordCount?: number;
  seoScore?: number;
  qualityScore?: number;
  error?: string;    // Overall pipeline failure reason
}
```

### 8.5 Key Behaviors

- Each stage is wrapped in try/catch → stage failure does NOT stop the pipeline
- Stages report `{ stageName, success, duration, error?, result? }`
- Pipeline continues through all stages even if some fail
- Auto-publish only when `approval_mode === 'auto'`
- Manual approval mode: article stays in `generated` status for human review
- `semantic_dedup` stage skipped when `bypassDedup: true`

---

## 9. API Routes

All routes are mounted under `/api/`. Each route module exports a `create<R>Routes(pool)` factory function that returns an Express Router.

### 9.1 Route Inventory

| Route File | Path Prefix | Key Endpoints |
|-----------|-------------|---------------|
| `auth.ts` | `/api/auth` | `POST /login`, `POST /change-password`, `GET/POST /users`, `POST /users/invite` |
| `articles.ts` | `/api/articles` | `GET /` (list), `POST /generate`, `GET /:id`, `PUT /:id`, `POST /:id/approve`, `POST /:id/reject`, `POST /:id/publish`, `POST /:id/regenerate`, `GET /:id/preview`, `GET /:id/seo` |
| `clients.ts` | `/api/clients` | `GET /` (list), `POST /` (create), `GET /:id`, `PUT /:id`, `DELETE /:id`, `GET /:id/stats` |
| `admin.ts` | `/api/admin` | `GET /dashboard`, `GET /errors`, `GET /health`, `GET /config`, `POST /config`, `GET /system-logs`, `POST /notify` |
| `analytics.ts` | `/api/analytics` | `GET /:clientId/overview`, `GET /:clientId/logs`, `GET /:clientId/history`, `GET /:clientId/costs`, `GET /:clientId/seo`, `GET /:clientId/keyword-analytics`, `GET /:clientId/jobs` |
| `webhooks.ts` | `/api/webhooks` | `GET /:clientId/webhooks`, `POST /:clientId/webhooks`, `PUT /:clientId/webhooks/:webhookId`, `DELETE /:clientId/webhooks/:webhookId`, `POST /events/receive` |
| `plugins.ts` | `/api/plugins` | `GET /` (list registry), `GET /clients/:clientId`, `POST /clients/:clientId/register`, `POST /clients/:clientId/instances/:instanceId/toggle`, `PUT /clients/:clientId/instances/:instanceId/config`, `POST /hooks/:hookName/execute` |
| `chat.ts` | `/api/chat` | `GET /sessions`, `POST /sessions`, `GET /sessions/:id`, `POST /sessions/:id/messages`, `POST /command` (parse + execute) |
| `apiKeys.ts` | `/api/api-keys` | `GET /:clientId/api-keys`, `POST /:clientId/api-keys`, `PUT /:clientId/api-keys/:keyId`, `DELETE /:clientId/api-keys/:keyId`, `POST /:clientId/api-keys/:keyId/toggle` |
| `systemConfig.ts` | `/api/config` | `GET /public`, `GET /` (all), `GET /:key`, `PUT /:key`, `GET /categories/list` |
| `prompts.ts` | `/api/prompts` | CRUD for prompt templates |
| `cms.ts` | `/api/cms` | CMS connection management |
| `brandVoice.ts` | `/api/brand-voice` | Brand voice profile CRUD |
| `editorial.ts` | `/api/editorial` | Editorial workflow management |
| `factCheck.ts` | `/api/fact-check` | Fact check results & history |
| `evaluation.ts` | `/api/evaluation` | AI evaluation results & reports |
| `security.ts` | `/api/security` | Security audit logs & settings |
| `contentIntelligence.ts` | `/api/content-intelligence` | Content intelligence analytics |
| `observability.ts` | `/api/observability` | Traces, metrics, spans |
| `cost.ts` | `/api/cost` | Cost tracking & optimization |
| `analytics.ts` | See above |
| `shopifyStore.ts` | `/api/shopify` | Store-specific operations |
| `shopifyAuth.ts` | `/api/shopify/auth` | OAuth install/callback |
| `pexels.ts` | `/api/pexels` | Image search & management |
| `enterprisePipeline.ts` | `/api/pipeline` | Pipeline trigger & status |
| `admin.ts` | See above |

---

## 10. Authentication & Authorization

### 10.1 JWT Authentication

- **Login:** `POST /api/auth/login` with `{ email, password }` → verify bcrypt hash → return `{ token, user }`
- **Token payload:** `{ userId, email, role, clientId }`
- **Auth middleware:** Extract `Bearer <token>` from Authorization header → verify with `JWT_SECRET` → attach `req.user`
- **Token expiry:** Configurable (default 7 days)

### 10.2 Role-Based Access Control

| Action | Admin | Editor | Client | Viewer |
|--------|-------|--------|--------|--------|
| View data | ✅ | ✅ | ✅ | ✅ |
| Generate articles | ✅ | ✅ | ❌ | ❌ |
| Publish articles | ✅ | ✅ | ❌ | ❌ |
| Approve/Reject | ✅ | ✅ | ❌ | ❌ |
| Manage plugins | ✅ | ❌ | ❌ | ❌ |
| Create clients | ✅ | ❌ | ❌ | ❌ |
| Delete entities | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| System config | ✅ | ❌ | ❌ | ❌ |
| View logs | ✅ | ✅ | Own only | ❌ |
| Chat commands | ✅ | ✅ | Limited | ❌ |

### 10.3 Shopify OAuth

- **Install URL:** Redirects to Shopify with required scopes (`write_content`, `read_content`)
- **Callback:** Exchanges OAuth code for permanent access token
- **Session storage:** `shopify_sessions` table
- **JWT issuance:** After successful OAuth, issues JWT for frontend session
- **Frontend flow:** `ShopifyAppProvider.tsx` → detects Shopify context → redirects to install or shows main app

---

## 11. Testing Strategy

### 11.1 Test Infrastructure

- **Framework:** Vitest
- **Config:** `vitest.config.ts` (unit), `vitest.e2e.config.ts` (integration with longer timeout)
- **Total tests:** 193 (183 unit/service + 10 E2E integration)
- **All pass:** ✅ Verified 100% pass rate

### 11.2 Test Files

| File | Type | Tests | What It Tests |
|------|------|-------|---------------|
| `blogPipeline.test.ts` | Unit | Orchestrator | Full pipeline execution, all 24 stages present, publish flow, manual approval, graceful failure handling |
| `qualityScorer.test.ts` | Unit | Service | Multi-dimensional scoring (readability, SEO, E-E-A-T, semantic, CTA), poor/good content differentiation, long paragraphs, keyword stuffing, CTA detection, list bonus |
| `seo.test.ts` | Unit | Service | Heuristic SEO analysis (keyword density, heading structure), slug generation, content validation (title/content/tags), social preview generation, markdown stripping |
| `contentSafety.test.ts` | Unit | Service | 8 hazard categories (electrical, gas, structural, toxic, medical, overpromise, hallucinated stats, unsubstantiated citations), empty content, critical severity |
| `pluginService.test.ts` | Unit | Service | Uninitialized state, missing tables (graceful degradation), hook execution, instance management (register/toggle/config), error handling, Shopfiy publisher hooks |
| `chatEngine.test.ts` | Unit | Service | 20+ command patterns, role-based permissions, command execution (generate, publish, research, approve, reject, list, delete, status, plugin, config), conversation history, fallback responses, error states |
| `pipeline-e2e.test.ts` | Integration | E2E | Full pipeline with mocked services, 24-stage verification, publish flow, manual approval, stage-level failure, quality score, dedup bypass |
| `api-routes.test.ts` | Integration | Routes | Auth routes, client routes, article routes (9 endpoints), admin routes (6 endpoints), webhook routes, analytics routes, platform routes (API keys, plugins, chat, system config), mock helpers |

### 11.3 Testing Patterns

- **Dependency injection:** All services receive pool/DB as constructor params
- **Mock services:** `mockServices.ts` provides full mock implementations for OpenAI, SerpAPI, Shopify, Webhooks, Vector Memory, Cost Tracker, Content Safety, Quality Scorer, Internal Links, Keywords, SEO
- **Graceful degradation testing:** Tests verify system works when DB tables are missing, Redis is unavailable, or external APIs fail
- **Stage-level resilience:** Pipeline continues through failures, individual stages report success/failure independently

### 11.4 Running Tests

```bash
npm test           # Run all unit/service tests (vitest)
npm run test:e2e   # Run integration/E2E tests (vitest --config vitest.e2e.config.ts)
```

---

## 12. Deployment Configuration

### 12.1 Docker Setup

**Dockerfile:**
- Stage 1: Build TypeScript (`tsc` or esbuild)
- Stage 2: Copy dist + node_modules (prod only), run with `node dist/backend/index.js`

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:16, ports: 5432, volumes for persistence
    healthcheck: pg_isready
  redis:
    image: redis:7, ports: 6379
  app:
    build: ., ports: 3000, depends_on: postgres, redis
    environment: DATABASE_URL, REDIS_URL, JWT_SECRET etc.
```

**docker/nginx.conf:** Reverse proxy config (static files + /api proxy)

### 12.2 PM2 Configuration (ecosystem.config.cjs)

```javascript
module.exports = {
  apps: [{
    name: 'ai-seo-automation',
    script: 'backend/index.ts',
    interpreter: 'npx tsx',
    instances: 1,           // Single instance for stateful processes
    exec_mode: 'fork',
    env: { NODE_ENV: 'development' },
    env_production: { NODE_ENV: 'production' },
    max_memory_restart: '1G',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 4000,
  }]
}
```

### 12.3 CI Pipeline (.github/workflows/ci.yml)

```yaml
- Setup Node 22
- Install dependencies
- TypeScript compile check (npx tsc --noEmit)
- Run tests (npm test)
- Build frontend (cd frontend && npm run build)
- (Optional) Docker build
```

### 12.4 Environment Variables (.env)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_seo_automation
JWT_SECRET=<random-secret>
PORT=3000
OPENAI_API_KEY=sk-...  (empty → dev mock mode)
SERPAPI_API_KEY=...
PEXELS_API_KEY=...
SHOPIFY_API_KEY=...
SHOPIFY_SECRET=...
SHOPIFY_DEFAULT_ACCESS_TOKEN=...
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:5173
```


---

## 13. Development Workflow

### 13.1 Quick Start

```bash
# 1. Start PostgreSQL
sudo service postgresql start

# 2. Create database (if not exists)
createdb ai_seo_automation

# 3. Run migrations (in order)
psql -d ai_seo_automation -f backend/database/schema.sql
psql -d ai_seo_automation -f backend/database/migration_shopify_oauth.sql
psql -d ai_seo_automation -f backend/database/migration_v2.sql
psql -d ai_seo_automation -f backend/database/migration_platform_v1.sql
psql -d ai_seo_automation -f backend/database/migration_enterprise_v4.sql
psql -d ai_seo_automation -f backend/database/seed.sql

# 4. Copy and configure .env (use .env.example or template)
#    OPENAI_API_KEY empty = dev mock mode

# 5. Start backend (port 3000)
npm run dev

# 6. Start frontend (port 5173, proxies /api → :3000)
cd frontend && npm run dev

# 7. Open browser at http://localhost:5173
```

### 13.2 TypeScript Checks

```bash
npx tsc --noEmit     # Full project type check (0 errors expected)
```

### 13.3 Dev Mode Features

- **Mocked AI:** When `OPENAI_API_KEY` is empty, all OpenAI methods return realistic mock data
- **Graceful degradation:** Missing Redis, DB tables, or external APIs never crash the app
- **Hot reload:** Both tsx (backend) and Vite (frontend) support file watching

### 13.4 Key Scripts (package.json)

```json
{
  "dev": "tsx watch backend/index.ts",
  "start": "pm2 start ecosystem.config.cjs",
  "build": "tsc",
  "test": "vitest run",
  "test:e2e": "vitest run --config vitest.e2e.config.ts",
  "test:watch": "vitest"
}
```

---

## Key Architectural Decisions & Patterns

1. **Graceful degradation everywhere** — No external dependency (Redis, AI APIs, DB tables) can crash the app. Everything degrades to mock data or empty arrays.

2. **Dependency injection for DB** — The `pg.Pool` is created once and injected into all routes and services via factory functions (`createXxxRoutes(pool)`).

3. **Stage-level error isolation** — The pipeline orchestrator wraps each stage in try/catch. A single stage failure never stops the pipeline.

4. **Plugin system via hooks** — Instead of hardcoding integrations, plugins register for named hooks (before_content_generation, before_publish, after_publish, etc.) and the pipeline calls them dynamically.

5. **Job queue abstraction** — BullMQ is wrapped behind a simple interface (`addJob`, `getJobStatus`) that gracefully returns mock IDs when Redis is unavailable.

6. **Natural language CLI** — The chat engine uses regex-based pattern matching (not AI) to parse commands, making it fast and deterministic.

7. **pgvector for similarity** — Article embeddings enable semantic dedup detection and content relationship discovery without external vector databases.

8. **Self-improving prompts** — The self-improvement service analyzes past pipeline runs to optimize prompts and configurations over time.

9. **Cost-first routing** — The cost optimization engine routes tasks to the most cost-effective AI model based on task complexity.

---

## Final Verification Status

| Check | Status |
|-------|--------|
| TypeScript compilation | ✅ 0 errors |
| All unit tests | ✅ 183/183 pass |
| All E2E tests | ✅ 10/10 pass |
| Frontend Vite build | ✅ Builds in ~4.5s |
| Database migrations | ✅ 71 tables, 6 views |
| Dev environment | ✅ DB + Backend (:3000) + Frontend (:5173) all running |
| API proxy (Vite → Backend) | ✅ Working |
