# TDS Geo — Architecture Plan

## Current State Assessment

| Component | Lines | Role | Fate |
|-----------|-------|------|------|
| `backend/` | 15,000+ | Partial Core (basic AI, 25-stage pipeline, Shopify connector) | **Evolve → TDS Geo** |
| `tds-geo-wp/` | 6,386 | Fat plugin with full AI, prompts, research, queue, scoring | **Strip → thin connector** |
| `frontend/` | — | Dashboard for backend | **Keep → talks to Core** |
| `tds-geo-nextjs/` | — | Next.js blog components | **Keep** |

### Critical Duplication (features in BOTH):

1. **Content generation** — Plugin has 18k-char advanced prompt. Backend has 23-line basic prompt.
2. **Quality scoring** — Plugin: 10 heuristic checks. Backend: 6 weighted dimensions + AI eval.
3. **Topic/keyword research** — Both do it differently.
4. **Background queue** — Plugin: MySQL polling. Backend: BullMQ/Redis.
5. **Knowledge/memory** — Plugin: MySQL key-value. Backend: pgvector embeddings.
6. **Scheduling** — Plugin: WP-Cron. Backend: BullMQ schedules.
7. **REST API** — Both expose full CRUD + generation APIs.
8. **Health/telemetry** — Both check system health independently.

---

## Phase 1: Move Intelligence to Core (NOW)

### 1.1 Move the 18k-char System Prompt

**From:** `tds-geo-wp/includes/class-content-generator.php:432-677`
**To:** `backend/prompts/writing-system-prompt.md`

The prompt file becomes a standalone text file loaded at runtime. The backend's `OpenAIService` reads it and uses it for all article generation. This single file is the source of truth — the plugin no longer owns the prompt.

**Files to create:**
```
backend/prompts/
├── writing-system-prompt.md   ← The full 18k-char prompt
├── research-prompt.md         ← Keyword/topic research
├── quality-score-prompt.md    ← Quality evaluation
└── seo-prompt.md              ← SEO analysis
```

**Files to modify:**
- `backend/services/openai.ts` — Load prompt from file, use it in `generateBlogPost()`
- `backend/routes/articles.ts` — Accept `prompt_version` parameter
- `backend/index.ts` — Mount prompts directory as static route for introspection

### 1.2 Upgrade Backend's `generateBlogPost()`

The backend's current method (line 53-180 of `openai.ts`) is a single-shot generation with a 23-line prompt. Replace it with the plugin's full pipeline:

```
generateBlogPost(topic):
  1. Load writing-system-prompt.md
  2. Inject site context, categories, date
  3. Call OpenAI with full prompt
  4. Parse JSON response
  5. Validate structure
  6. Return {title, content, meta, tags, ...}
```

The existing staged methods (generateTitle → generateOutline → enhanceSEO → generateFAQ → generateMetadata) stay as alternatives for the enterprise pipeline, but the main generation uses the full prompt.

### 1.3 Make Backend the Single AI Source

**Plugin change:** `ContentGenerator::generate_article()` now ONLY calls `BackendClient` — no local fallback.
**Plugin change:** `ContentGenerator::discover_topics()` now ONLY calls `BackendClient` — no local fallback.
**Plugin change:** `ContentGenerator::auto_generate()` becomes a thin method that calls backend endpoints.

The plugin's local OpenAI key becomes a fallback for when the backend is unreachable, not the primary path.

---

## Phase 2: Universal Connector Interface ✅ DONE

**Status:** Core has a standalone connector for WordPress. Shopify already works via existing service. Webflow/Ghost stubs exist.

### 2.1 Connector Contract

Every CMS connector implements the `PublisherAdapter` interface defined in `backend/types/index.ts:887` and re-exported from `backend/connectors/contract.ts`:

```typescript
interface PublisherAdapter {
  provider: CmsProvider;       // 'shopify' | 'wordpress' | 'webflow' | 'ghost' | 'custom_rest' | ...
  name: string;                // Human-readable name
  capabilities: PublisherCapabilities;  // Feature flags
  testConnection(): Promise<boolean>;
  publish(article: Article, config: Record<string, unknown>): Promise<PublishResult>;
  update(articleId: string, article: Partial<Article>): Promise<PublishResult>;
  delete(articleId: string): Promise<boolean>;
  getBlogs(): Promise<Array<{ id: number | string; title: string; handle: string }>>;
}
```

Connectors are stateless adapters registered in `MultiCmsPublisherService` (`backend/services/multiCmsPublisher.ts`). The service manages the adapter map and per-connection config persistence via the `cms_connections` DB table.

### 2.2 WordPress Connector

**Location:** `backend/connectors/wordpress.ts`

The `WordPressConnector` class implements `PublisherAdapter` with three auth modes (auto-detected from config):

| Mode | Header | Endpoint | Use Case |
|------|--------|----------|----------|
| `tds_geo` | `X-TDS-GEO-Key` | `tds-geo/v1/posts` | This project's TDS GEO WordPress plugin |
| `tds-geo` | `X-TDS-GEO-Key` | `tds-geo/v1/posts` | Legacy TDS Geo WP plugin |
| `native` | Basic Auth (App Passwords) | `wp/v2/posts` | Any vanilla WordPress site |

**Key details:**
- Config is stored per-article internally after publish (via `connectionConfigs: Map<string, Record<string, unknown>>`) so subsequent `update()` and `delete()` calls can re-authenticate without the config being re-passed.
- The connector is registered in `multiCmsPublisher.ts` via `this.adapters.set('wordpress', wordpressConnector)` — the entire 320-line inline implementation was replaced with a single import.
- A singleton `wordpressConnector` export is available for direct use.

### 2.3 Plugin Becomes Thin Connector (Phase 3 prep)

The plugin's REST API (`/tds-geo/v1/*`) serves as the WordPress-side endpoint that the Core WordPress connector calls. The plugin files to be removed in Phase 3:

| Plugin File | Lines | Replaced By |
|------------|-------|-------------|
| `class-content-generator.php` | 925 | `backend/services/openai.ts` + `backend/prompts/writing-system-prompt.md` |
| `class-content-research.php` | 159 | `backend/prompts/research-prompt.md` + `/api/articles/suggest-topics` |
| `class-content-analyzer.php` | 141 | Core's analytics engine |
| `class-quality-scorer.php` | 142 | Core's quality engine |
| `class-seo-report.php` | 202 | Core's reporting engine |
| `class-seo-auditor.php` | 108 | Core's SEO engine |
| `class-worker.php` | 304 | Core's queue system (BullMQ) |
| `class-knowledge-base.php` | 120 | Core's memory engine (pgvector) |
| `class-heal-engine.php` | 130 | Core's monitoring |
| `class-scanner.php` | 371 | Core handles scanning (backend/services/clientScraper.ts) |
| `class-telemetry.php` | 185 | Core handles telemetry |
| `class-update.php` | 133 | Connector auto-updates via Core |
| `class-graphify-client.php` | 183 | Core's knowledge graph |
| `class-diagnostics.php` | 59 | Redundant |
| `class-cache.php` | 61 | Redundant |
| `class-scheduler.php` | 52 | Redundant |
| `class-rate-limiter.php` | 46 | Redundant |
| `class-security.php` | 60 | Redundant |
| `class-health.php` | 92 | Redundant |
| `class-dashboard.php` | 320 | Simplified to Core status display |
| `class-logger.php` | 124 | Redundant |

**Total reduction after Phase 3: ~3,800 lines removed from plugin.**

### 2.4 Directory Structure

```
backend/connectors/
├── contract.ts       ← Re-exports PublisherAdapter + ConnectorFactory type
└── wordpress.ts      ← WordPressConnector class (3 auth modes)
```

Future connectors follow the same pattern — create a file in `backend/connectors/`, implement `PublisherAdapter`, register in `multiCmsPublisher.ts`.

---

## Phase 3: Global Memory

### 3.1 Memory Store

Core gets a unified memory layer:

```typescript
interface MemoryStore {
  // Site context
  getSite(siteId: string): Promise<SiteContext>;
  updateSite(siteId: string, data: Partial<SiteContext>): Promise<void>;
  
  // Brand voice
  getBrandVoice(siteId: string): Promise<BrandVoice>;
  updateBrandVoice(siteId: string, voice: Partial<BrandVoice>): Promise<void>;
  
  // Article history
  getArticleHistory(siteId: string, limit?: number): Promise<Article[]>;
  recordArticle(siteId: string, article: Article): Promise<void>;
  
  // Keywords & entities
  getKeywords(siteId: string): Promise<Keyword[]>;
  getEntities(siteId: string): Promise<Entity[]>;
  
  // Performance
  getPerformance(siteId: string): Promise<PerformanceMetrics>;
  recordPerformance(siteId: string, metrics: Partial<PerformanceMetrics>): Promise<void>;
}
```

### 3.2 Knowledge Graph

Core builds semantic relationships across all connected sites:

```
Article → belongs to → Category
Category → part of → Cluster
Cluster → supports → PillarPage
Article → mentions → Entity
Entity → related to → Entity
Article → links to → Article
Site → has → BrandVoice
BrandVoice → uses → Tone
Tone → applies to → Category
```

---

## Phase 4: Migration Path

### Order of Implementation (Tracked Progress):

```
✅ Week 1 (DONE): Move prompt files → backend
         └── backend/prompts/writing-system-prompt.md created (from plugin)
         └── backend/prompts/research-prompt.md created
         └── backend/prompts/index.ts prompt loader with {{VAR}} substitution
         └── OpenAIService + OllamaService use file-based prompts
         └── Plugin's BackendClient delegates to backend (falls back to local)

✅ Week 2 (DONE): Universal Connector Interface
         └── backend/connectors/contract.ts — PublisherAdapter contract
         └── backend/connectors/wordpress.ts — Standalone WordPress connector
         └── 320 lines of inline WordPress code removed from multiCmsPublisher.ts
         └── multiCmsPublisher.ts imports wordpressConnector singleton
         └── API key auth added to authenticate middleware
         └── /api/articles/suggest-topics endpoint added
         └── /generate endpoint fixed to return content fields
         └── BackendClient sends X-API-Key header

⬜ Week 3: Strip plugin to thin connector
         └── Plugin becomes pure REST receiver, no business logic
         └── Remove all 20 files listed in 2.3

⬜ Week 4: Build global memory
         └── Memory store in PostgreSQL
         └── Knowledge graph relationships

⬜ Week 5: Auto-update via Core
         └── Core pushes connector updates
         └── Plugin update mechanism removed
```

---

## Key Principles

1. **The Core is the only brain.** Every AI call, every prompt, every scoring decision lives in `backend/`.
2. **Connectors are pure CRUD.** They authenticate, sync, publish, return status — nothing more.
3. **No duplication.** If a feature exists in two places, it's a bug.
4. **Backward compatibility.** Every phase keeps existing endpoints working.
5. **Events over RPC.** Core emits events — connectors subscribe.
6. **Prompts as files.** All system prompts are standalone `.md` files, edited independently of code.

---

## Immediate Next Step

**Phase 1, Step 1:** Move the 18k-char system prompt from `class-content-generator.php` to `backend/prompts/writing-system-prompt.md` and update the backend's `OpenAIService` to use it.
