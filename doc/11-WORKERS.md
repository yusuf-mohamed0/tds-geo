# Background Workers

## Architecture

- **Queue Library:** BullMQ (Redis-backed)
- **Redis Connection:** Lazy connect via REDIS_URL; degrades gracefully if Redis is down
- **Concurrency:** Default 3 workers, configurable via WORKER_CONCURRENCY
- **Database:** Shared PostgreSQL pool (max 10 connections)

## Queues & Workers

| Queue | Concurrency | Purpose |
|---|---|---|
| CONTENT_GENERATION | 3 | Generate blog posts via OpenAI |
| KEYWORD_RESEARCH | 3 | SerpAPI keyword research (1 req/s rate limit) |
| SHOPIFY_PUBLISH | 1 | Publish articles to Shopify |
| IMAGE_GENERATION | 1 | DALL-E image generation |
| SEO_ANALYSIS | 3 | SEO content analysis |
| INTERNAL_LINKING | 3 | Find and inject internal links |
| WEBHOOK_DELIVERY | 3 | Trigger webhooks for events |
| CLIENT_SCAN | 2 | Scan client website (skips if <7 days old) |
| BATCH_CLIENT_SCAN | 1 | Batch scan all stale clients |
| FACT_CHECK | 2 | Verify article claims |
| BRAND_VOICE | 1 | Process brand voice embeddings |
| SEO_INTELLIGENCE | 3 | SERP analysis, entity extraction |
| MULTI_CMS_PUBLISH | 1 | Publish to any CMS |
| PEXELS_IMAGE | 2 | Fetch Pexels stock images |
| EDITORIAL_WORKFLOW | 2 | Submit/approve/reject reviews |
| CONTENT_INTELLIGENCE | 2 | Cannibalization, knowledge graph |
| AI_EVALUATION | 1 | LLM-as-judge benchmark |
| CONTENT_EMBEDDING | (default) | Store vector embeddings |
| DEAD_LETTER | 1 | Handle permanently failed jobs |

## Job Lifecycle

```
1. API route adds job to queue via addJob(queueName, jobName, data)
2. BullMQ stores job in Redis
3. Worker picks up job, processes it
4. On success: job completed, result stored
5. On failure: retry (up to max_attempts), then dead letter
6. Cost tracked per job (OpenAI tokens, model, duration)
```

## Running Workers

Workers run as a **separate Node.js process** managed by PM2:

```
ecosystem.config.cjs:
  - tds-geo-backend (Express API)
  - tds-geo-worker (BullMQ workers)
```

Both processes share code from the same build. The worker process only runs the queue handlers, not the HTTP server.

## Graceful Degradation

If **Redis is unavailable** (port 6379 not responding):

- Workers cannot accept new jobs
- API endpoints that add jobs to queues will fail silently
- The Express API continues working (all read/write operations work without Redis)
- Features that depend on queues (keyword research, image generation) are unavailable

The app was designed this way — Redis is optional. PostgreSQL is the only hard dependency.
