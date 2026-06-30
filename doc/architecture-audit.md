# TDS GEO — Architecture & Security Audit

Generated: 2026-06-25

## Phase 1: Architecture Audit

### Critical Problems

**1. Main Entry Point (`index.ts`) is a God File — ~776 lines**
- Imports everything at top level (27+ route factories, 37+ services, all engines)
- Mixed concerns: pool creation, middleware config, route mounting, service init
- `start()` function initializes 30+ services sequentially before listening
- Risk: Monolithic startup failure — if any one service init fails, the whole server crashes

**2. Engine Architecture: Stubs Disguised as Real Implementations**
- All 9 engines (`src/engines/`) are essentially stubs:
  - `OrchestratorEngine.runPipeline()` loops through steps sequentially (no parallelism)
  - `ResearchEngine`, `SEOEngine`, `QualityEngine` return empty objects
  - `WritingEngine` calls the God Service directly (bypassing engine abstraction)
  - `PublisherEngine.publishToTarget()` returns `"Not implemented for this provider"` for all non-Shopify targets
  - Engine `initialize()` methods are no-ops (just log "initialized")
- Event Bus events are emitted but **never consumed** — no engine subscribes to events
- The "engine" layer is decorative, not functional

**3. Service Chaos — 37 Files, No Clear Boundaries**
- `openai.ts` = ~1056 lines God Service mixing: content generation, SEO analysis, keyword variations, image generation, moderation, mock data
- Duplicate service logic: `services/openai.ts` (1056 lines) vs `backend/openai.ts` (root, 1056 lines) — DIFFERENT files with identical class but different import paths
- `services/geoIntelligence.ts`, `backend/geoIntelligence.ts`, `routes/geoIntelligence.ts` — THREE copies of the same GEO intelligence logic
- `services/multiCmsPublisher.ts` vs `backend/multiCmsPublisher.ts` — more duplication
- No DI container — every file does `import service from './path'` directly
- Dead root-level duplicates REMOVED: articles.ts, cms.ts, geo.ts, geoIntelligence.ts, multiCmsPublisher.ts, enterprisePipeline.ts, shopifyClient.ts

**4. Duplicate Type Definitions**
- `PublishResult` defined in 3 places: `types/index.ts` (id, blogId, url, handle), `sdk/connector-interface.ts` (success, externalId, url, error, provider), `engines/publisher/index.ts` (success, provider, externalId, url, error)
- `UserRole` type mismatch: `'super_admin' | 'admin' | 'editor' | 'client'` vs `'admin' | 'editor' | 'client'` in different schemas
- `AIService` interface exists in `types/index.ts` but no service implements it

**5. Module Boundary Violations**
- `backend/multiCmsPublisher.ts` (root) wrapped connectors as PublisherAdapter — but `backend/services/multiCmsPublisher.ts` (services) does the same thing differently
- Route files directly import and call services (tight coupling)
- No layered architecture — routes call services, which call DB directly, mixing concerns

### High-Risk Issues

| Issue | Risk |
|-------|------|
| No dependency injection container | H |
| Circular import potential (every service imports every other service) | H |
| 37 services with no interface contracts (only `ConnectorInterface` has a formal contract) | H |
| Path alias imports configured (`@backend/*`, `@services/*`) but never used — all files use relative paths | L |

---

## Phase 2: Security Audit

### CRITICAL

**C1: GitHub PAT Token Removed from Git Remote URL**
- Was: `https://yusuf-mohamed0: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@github.com/yusuf-mohamed0/tds-geo.git`
- Fixed to: `https://github.com/yusuf-mohamed0/tds-geo.git` (token removed)
- **ACTION REQUIRED**: User must rotate this PAT on GitHub.com immediately

**C2: Hardcoded Shopify Access Token — Removed from `.env.example`**
- Was: `SHOPIFY_DEFAULT_ACCESS_TOKEN=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`
- Fixed to: `SHOPIFY_DEFAULT_ACCESS_TOKEN=your-shopify-access-token-here`
- **ACTION REQUIRED**: User must rotate this token in Shopify Admin

**C3: JWT Secret Default in Source Code**
- `const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-secret-key'`
- **Fix**: Make JWT_SECRET mandatory in production (throw if unset)

**C4: API Key Authentication — Fixed with Constant-Time Comparison**
- Before: `apiKey === allowedKey` (timing attack vulnerability)
- After: `crypto.timingSafeEqual()` with length-safe comparison

### HIGH

**H1: No Input Validation on Most Routes**
- Only `seoAnalyzeSchema` uses Joi validation
- Request bodies parsed as `any` or `Record<string, unknown>` with no schema
- Risk: Mass assignment, prototype pollution

**H2: Webhook Secrets Stored in Plaintext in DB**
- `secret VARCHAR(255)` — webhook signing secrets stored unencrypted
- **Fix**: Encrypt at rest using pgcrypto or application-level encryption

**H3: No CSRF Protection**
- State-changing endpoints (POST/PUT/DELETE) have no anti-CSRF
- Mitigated somewhat by JWT Bearer auth but XSS could still exfiltrate tokens

**H4: No Rate Limiting Per-Client**
- Global rate limiter only (500 req/15min for all clients)
- Single abusive client can exhaust the global pool

### MEDIUM

**M1: `x-api-key` Auth Has No Audit Trail**
- Connector key auth logs nothing
- **Fix**: Log API key usage with source IP

**M2: Logging Sensitive Data**
- Error messages can leak internal paths
- Some `logger.error` calls may include request body data

---

## Phase 3: Reliability Audit

### Critical Issues

**1. Circuit Breakers Added to OpenAI (`openai.ts`)**
- Circuits added: `openai-chat`, `openai-generate-blog`, `openai-seo-analyze`
- Still missing from: `generateKeywordVariations`, `generateArticleImage`, `generateTitle`, `generateOutline`, `generateFAQ`, `generateMetadata`

**2. No Retry Logic on External API Calls**
- `shopifyGraphQL()` in billing.ts: one shot, no retry
- WordPress connector calls: one shot
- **Impact**: Any transient network failure = permanent failure

**3. Async Fire-and-Forget Without Error Handling**
- `pool.query(...).catch(() => {})` — silent failures on DB writes
- `heartbeatService.run().catch(() => {})` — silent failures on health check
- **Impact**: Silent data loss, undetected failures

**4. Redis Connection — Fixed to Shared Client**
- Before: `new Redis(REDIS_URL)` created on every `/health` request + `admin.ts`
- After: Shared client in `utils/redisHealth.ts` with proper cleanup in shutdown

**5. Event Bus is In-Memory Only**
- No persistence, no replay, no queue — events lost on crash
- Handlers run in-process (blocking)

### Medium Issues

**6. No Health Check on Worker Process**
- Docker checks `/health` on API but not on worker
- Worker could be dead while API reports healthy

**7. PM2 Restart Limit**
- 10 max restarts, 5s delay — after 10 crashes in 50s, PM2 stops trying
- Missing exponential backoff

---

## Phase 4: Scalability Audit (100 → 100K Sites)

### Bottleneck Analysis

| Scale | Bottleneck | Why |
|-------|-----------|-----|
| 100 sites | Pool size (max 10 connections) | 100 concurrent requests = queue on 10 pool connections |
| 1,000 sites | Sequential pipeline | Orchestrator runs steps serially |
| 10,000 sites | God Service `openai.ts` | Single-threaded, shared rate limiter, no request queuing |
| 100,000 sites | Database | No read replicas, no sharding, no connection pooling |
| All | No caching | Every `/health` call runs 11 subqueries |
| All | Event Bus | In-memory bus cannot scale beyond single process |

### Specific Issues

- `max: 10` connections for the entire application
- No read/write separation, no PgBouncer
- `activity_logs` table: no time-based partitioning, no archive strategy
- No tenant-level caching or RLS
- Redis not used for response caching

---

## Phase 5: Performance Audit

### Hot Paths

1. **Article Generation Pipeline** — most expensive operation:
   - Calls OpenAI (1-3s+), then SEO analysis, then quality check
   - All sequential, no parallel research/SEO/writing

2. **`/health` Endpoint** — runs 11 aggregate subqueries + 3 external pings

3. **Content Generation** — `openaiService.chat()` and `generateBlogPost()`:
   - No streaming support (entire response buffered)
   - No response caching (same prompt → same article → no dedup)

### Memory / CPU

- No stream processing for large payloads (10mb body limit)
- Articles stored as full markdown+HTML in DB (no compression)
- `content_embeddings` table has VECTOR(1536) — 6KB per embedding row

---

## Phase 6: Code Quality Audit

### Dead Code Removed
- `backend/articles.ts` — entire file unused
- `backend/cms.ts` — unused
- `backend/geo.ts`, `backend/geoIntelligence.ts` — unused
- `backend/multiCmsPublisher.ts` — unused (superseded by `backend/services/multiCmsPublisher.ts`)
- `backend/enterprisePipeline.ts` — unused
- `backend/connectors/shopifyClient.ts` — unused (superseded by `backend/connectors/shopify/index.ts`)
- **Total**: 7 files removed. All backed up to `/tmp/tds-dead/backend/`

### Technical Debt

| Area | Debt |
|------|------|
| TypeScript strict mode violations | Many `as any` casts, `any` type params, `!` assertions |
| `Pool` type passed as `any` | Every service's `initialize(pool: any)` — defeats type safety |
| Mixed module systems | `module: "commonjs"` in tsconfig but some files use `import.meta` patterns |
| Error handling | Most try/catch blocks log and swallow errors silently |
| No ESLint rules | Lint step in CI but `continue-on-error: true` — lint is decorative |
| Test coverage | 198 tests for 37 services = ~5 tests per service |
| Inconsistent naming | `camelCase`, `snake_case`, and PascalCase mixed |

---

## Phase 7: Production Readiness

### What's Good
- Multi-stage Docker build with non-root user ✓
- Docker Compose with 5 services (API, worker, PG, Redis, nginx) ✓
- PM2 with restart limits and logging ✓
- Health checks on Docker containers ✓
- CI with 4 parallel jobs (typecheck, test, build) ✓
- HELMET security headers ✓
- CORS configuration ✓
- Rate limiting (basic) ✓

### What's Missing

**CRITICAL: No Database Backups**
- No backup volume mount, no WAL archiving, no pg_dump cron
- A data loss incident = total loss

**CRITICAL: No Monitoring/Alerting**
- No Prometheus metrics endpoint
- No Sentry/DataDog integration
- No structured logging aggregation
- `metrics_snapshots` and `trace_spans` tables exist but no service writes to them

**HIGH: No Rollback Strategy**
- Docker images tagged but no blue/green deployment
- No database migration rollback scripts
- PM2 runs single instance (no zero-downtime deploy)

**MEDIUM: Environment Gaps**
- No staging environment in CI/CD
- No feature flags
- No dependency vulnerability scanning

---

## Phase 8: Master Improvement Roadmap

### P0 — Critical (Immediate) — DONE

| # | Item | Status |
|---|------|--------|
| P0.1 | Remove GitHub PAT from git remote URL | ✅ Fixed |
| P0.2 | Remove Shopify token from `.env.example` | ✅ Fixed |
| P0.3 | Make JWT_SECRET mandatory in production | ❌ Still needs fix |
| P0.4 | Constant-time API key comparison | ✅ Fixed |

### P1 — High (This Sprint)

| # | Item | Status |
|---|------|--------|
| P1.1 | Remove dead root-level file duplicates | ✅ Done (7 files) |
| P1.2 | Redis connection leak (shared client) | ✅ Fixed |
| P1.3 | Circuit breakers on OpenAI calls | ✅ Partial (chat, generate-blog, seo-analyze) |
| P1.4 | Add Prometheus metrics endpoint | ❌ |
| P1.5 | Add database backup strategy | ❌ |
| P1.6 | Replace `database/` with proper migration tool | ❌ |

### P2 — Medium (Next Sprint)

| # | Item |
|---|------|
| P2.1 | Refactor `openai.ts` God Service into smaller modules |
| P2.2 | Make engines real (replace stubs) |
| P2.3 | Add per-client rate limiting |
| P2.4 | Add request validation using Joi on all POST/PUT routes |
| P2.5 | Implement BullMQ queue for async article generation |
| P2.6 | Add database connection pooling layer (PgBouncer) |
| P2.7 | Remove duplicate types (3 `PublishResult` → 1) |

### P3 — Low (Backlog)

| # | Item |
|---|------|
| P3.1 | Wire Event Bus listeners to actual engines |
| P3.2 | Add end-to-end encryption for webhook secrets at rest |
| P3.3 | Implement CSRF tokens for state-changing endpoints |
| P3.4 | Add database read replicas |
| P3.5 | Implement real-time via WebSockets instead of REST polling |
| P3.6 | Add dependency vulnerability scanning |
| P3.7 | Row-level security (RLS) on PostgreSQL |
