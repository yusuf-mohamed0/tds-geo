# Kivo OS System — PROJECT_MAP

## [TECH_STACK]

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | v22.22.2 | LTS |
| Language | TypeScript | ^5.4.5 | Strict mode |
| Database | PostgreSQL | 18.3 | + pgvector extension (optional) |
| Backend | Express.js | ^4.21.x | Helmet + CORS + Rate limiting |
| Queue | BullMQ | ^5.8.0 | Redis-backed (optional, degrades gracefully) |
| AI | OpenAI API | ^4.73+ | GPT-4o, text-embedding-3-small, DALL-E 3 |
| SEO | SerpAPI (Google), custom SEO analysis | — | Keyword data, content scoring |
| E-commerce | Shopify Admin REST API | 2024-07 | Article publishing, image upload |
| Auth | JWT (jsonwebtoken + bcryptjs) | — | Bearer tokens, 24h expiry |
| Frontend | React 18 + Vite + React Router | React ^18.3, Vite ^5.2 | SPA with TypeScript |
| Charts | Recharts | ^2.x | Cost/token visualization |
| Container | Docker + docker-compose | — | Node + PostgreSQL + Nginx |
| CI/CD | GitHub Actions | — | Tests + Docker deploy |
| Process Mgr | PM2 (ecosystem.config.cjs) | — | Production process manager |

## [SYSTEM_FLOW]

```
                        ┌──────────────────────────┐
                        │     Client Manager        │
                        │  Register → Configure     │
                        └────────────┬─────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │   Keyword Discovery       │
                        │  SerpAPI → DB → Cluster   │
                        └────────────┬─────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │   Pipeline Orchestrator   │
                        │  blogPipeline.ts (17 stgs)│
                        └──────┬──────────┬───────┘
                               │          │
                    ┌──────────▼──┐ ┌────▼──────────┐
                    │  Queue-based │ │  Direct (sync)│
                    │  (BullMQ)    │ │  (development)│
                    └──────┬──────┘ └────┬──────────┘
                           │             │
                           ▼             ▼
                    ┌──────────────────────────────┐
                    │    Article Generation         │
                    │  OpenAI → SEO → Links → FAQ   │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   Review / Approve            │
                    │   Dashboard → Manual/Auto     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   Shopify Publishing          │
                    │   images → publish → track    │
                    └──────────────────────────────┘

  ─── Admin Flow ───────────────────────────────────
  Login → JWT → Dashboard → Clients/Articles/Config
  Chat → Natural language → Queue Jobs → Results
  Plugin System → Register → Configure → Enable
```

## [ARCHITECTURE]

### Backend (Express + TypeScript)

```
backend/
├── index.ts                  # Entry: Express app + route mounting + service init
├── orchestrators/
│   └── blogPipeline.ts       # 17-stage pipeline orchestrator
├── workers/
│   └── index.ts              # BullMQ workers (content gen, keywords, shopify, etc.)
├── routes/
│   ├── auth.ts               # Auth routes (delegates to middleware/auth.ts)
│   ├── clients.ts            # Client CRUD
│   ├── articles.ts           # Article generation/CRUD/publish
│   ├── webhooks.ts           # Webhook management
│   ├── analytics.ts          # Analytics overview/logs/costs/SEO
│   ├── admin.ts              # Admin dashboard/config/errors
│   ├── apiKeys.ts            # API key management
│   ├── plugins.ts            # Plugin registry/instances
│   ├── prompts.ts            # Prompt template editor
│   ├── chat.ts               # Chat session/messages
│   └── systemConfig.ts       # System configuration CRUD
├── services/
│   ├── openai.ts             # OpenAI (GPT, embeddings, images)
│   ├── shopify.ts            # Shopify Admin API
│   ├── seo.ts                # Content SEO analysis
│   ├── keywords.ts           # Keyword discovery/storage
│   ├── qualityScorer.ts      # Content quality scoring
│   ├── costTracker.ts        # API cost tracking & budgets
│   ├── contentSafety.ts      # Content safety checks
│   ├── serpapi.ts            # SerpAPI keyword data
│   ├── webhooks.ts           # Webhook delivery service
│   ├── vectorMemory.ts       # pgvector RAG (graceful degradation)
│   ├── internalLinks.ts      # Internal link optimization
│   ├── pluginService.ts      # Plugin registry (tables-optional)
│   ├── chatEngine.ts         # Chat command processing
│   └── selfImprovementService.ts  # Auto-analysis & suggestions
├── repositories/
│   ├── articleRepo.ts        # Article DB access
│   ├── clientRepo.ts         # Client DB access
│   ├── keywordRepo.ts        # Keyword DB access
│   └── logRepo.ts            # Activity log DB access
├── middleware/
│   └── auth.ts               # JWT auth + full auth route factory
├── validators/
│   └── index.ts              # Zod/JSON schema validators
├── utils/
│   ├── logger.ts             # Winston + LogBuffer (async batch DB logger)
│   ├── queue.ts              # BullMQ connection/worker factory
│   └── markdownToHtml.ts     # MD → HTML converter
├── queues/
│   └── definitions.ts        # Queue names enum
├── types/
│   └── index.ts              # Shared TypeScript types/interfaces
├── database/
│   ├── schema.sql            # Complete schema (merged v3)
│   ├── schema-comprehensive.sql  # Reference schema
│   ├── seed.sql              # Seed data
│   ├── migration_v2.sql      # Legacy migration
│   └── migration_platform_v1.sql  # Platform tables migration
└── tests/
    ├── orchestrators/
    ├── services/
    ├── mocks/
    └── integration/
```

### Frontend (React 18 + Vite)

```
frontend/
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Router + ToastProvider
│   ├── styles.css            # Global styles
│   ├── components/           # Shared primitives
│   │   ├── Card.tsx          # Card, CardHeader, CardBody, CardFooter
│   │   ├── Modal.tsx         # Modal with overlay + Escape
│   │   ├── DataTable.tsx     # Typed table with pagination/sort/loading
│   │   ├── FormField.tsx     # InputField, SelectField, TextareaField, etc.
│   │   ├── Toast.tsx         # ToastProvider + useToast()
│   │   └── Layout.tsx        # App shell + sidebar
│   ├── pages/                # 16 route pages
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Articles.tsx
│   │   ├── ArticleDetail.tsx
│   │   ├── Clients.tsx
│   │   ├── Analytics.tsx
│   │   ├── Admin.tsx
│   │   ├── Settings.tsx
│   │   ├── Config.tsx
│   │   ├── Plugins.tsx
│   │   ├── Chat.tsx
│   │   ├── ApiKeys.tsx
│   │   ├── Prompts.tsx
│   │   ├── Webhooks.tsx
│   │   ├── ApiUsage.tsx
│   │   └── Improvements.tsx
│   ├── hooks/useAuth.tsx     # Auth context + JWT management
│   ├── services/api.ts       # API client (axios)
│   └── types/index.ts        # Frontend TypeScript types
└── index.html
```

### Key Design Decisions

1. **Singleton services with `initialize(pool)`** — All services share one DB pool passed at startup, avoiding redundant connections
2. **Graceful degradation** — Redis, pgvector, and plugin tables are optional; workers warn in standby mode
3. **Async batch logging** — LogBuffer batches DB writes every 2s (configurable), non-blocking
4. **Route delegation** — auth.ts → middleware/auth.ts (single source of truth for auth)
5. **Shared publish helper** — `shopifyService.publishArticleWithTracking()` used by both routes and workers
6. **Frontend primitives** — Card, DataTable, FormField, Modal, Toast: reusable components with consistent styling

## [ORPHANS & PENDING]

| Item | Status | Description |
|------|--------|-------------|
| Frontend → Shared Components | ✅ COMPLETE | All 16 pages use Card, DataTable, FormField, Modal, Toast |
| Frontend → TypeScript types | ✅ COMPLETE | Shared component props aligned across all pages (0 type errors) |
| Backend → Plugin test coverage | ✅ COMPLETE | 18 tests covering uninitialized, tables missing, hook execution, instance management |
| Backend → ChatEngine test coverage | ✅ COMPLETE | 98 tests covering parseCommand, checkPermission, executeCommand, generateResponse, ruleBasedClassify, fallbackResponse |
| Backend → E2E pipeline test | ✅ COMPLETE | 10 tests covering full success, stage ordering, publish, manual approval, failure modes, quality score, dedup options |
| Docs → README.md update | ✅ COMPLETE | README rewritten with full architecture, API ref, setup, Docker, CI/CD |
| CI → Pipeline test step | ✅ COMPLETE | Separate `e2e` CI job runs in parallel with `backend` and `frontend`; excluded from `npm test` via vitest.config.ts |
| Docker → Frontend build step | ✅ COMPLETE | Added `frontend-builder` + `frontend` (nginx) stages to Dockerfile; nginx service builds from target `frontend` in compose |

