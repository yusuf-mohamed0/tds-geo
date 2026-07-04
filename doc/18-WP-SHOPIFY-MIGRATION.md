# WP → Shopify Full Migration Engine

**Document:** 18-WP-SHOPIFY-MIGRATION.md  
**Status:** Planned  
**Priority:** Medium  
**Estimated Effort:** 15–20 hours  

---

## 1. Overview

A comprehensive migration engine that extracts all content from a WordPress/WooCommerce site and imports it into a Shopify store, preserving SEO, media, structure, and relationships.

### Supported Source → Destination

| Source | Destination |
|--------|-------------|
| WordPress posts | Shopify blog articles |
| WordPress pages | Shopify blog articles (or skip) |
| WooCommerce products | Shopify products |
| WordPress media library | Shopify image assets |
| WordPress categories | Shopify collections |
| WordPress tags | Shopify tags |
| Yoast/RankMath SEO meta | Shopify SEO metafields |
| WordPress permalinks | Shopify URL redirects |
| WordPress authors | Shopify article author strings |

### Out of Scope (Phase 1)

- Orders / customers / user accounts
- WooCommerce product reviews → Shopify reviews
- WordPress plugins → Shopify apps mapping
- WordPress theme → Shopify theme (limelight/dawn)
- WordPress forms, contact entries
- Database-level migration (only REST API)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Migration Engine                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  ExportEngine │─▶│TransformEngine│─▶│  ImportEngine │      │
│  │  (reads WP)   │  │ (maps data)  │  │(writes Shopify)│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────────────────────────────────────────────┐       │
│  │              ProgressTracker                      │       │
│  │  (DB tables: migration_jobs, migration_items)     │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │              ReportGenerator                      │       │
│  │  (summary, errors, redirect map CSV)             │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐  ┌─────────────────────┐
│   WordPress Site    │  │   Shopify Store      │
│   (via TDS Geo      │  │   (via Admin REST    │
│    plugin API +     │  │    API 2025-07)      │
│    WC REST API)     │  │                      │
└─────────────────────┘  └─────────────────────┘
```

---

## 3. Database Schema

### Table: `migration_jobs`

```sql
CREATE TABLE migration_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id),
  source_type     TEXT NOT NULL DEFAULT 'wordpress',
  source_url      TEXT NOT NULL,                    -- WordPress site URL
  source_api_key  TEXT,                              -- TDS Geo API key
  source_wc_key   TEXT,                              -- WooCommerce consumer key
  source_wc_secret TEXT,                             -- WooCommerce consumer secret
  destination_type TEXT NOT NULL DEFAULT 'shopify',
  destination_shop TEXT NOT NULL,                    -- Shopify shop domain
  destination_token TEXT,                             -- Shopify access token
  status          TEXT NOT NULL DEFAULT 'draft',     -- draft|running|paused|completed|failed
  progress_pct    DECIMAL(5,2) DEFAULT 0,
  phase           TEXT DEFAULT 'export',             -- export|transform|import|redirect|complete
  stats           JSONB DEFAULT '{}',                -- { posts, products, media, ... }
  errors          JSONB DEFAULT '[]',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `migration_items`

```sql
CREATE TABLE migration_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL,                     -- post|page|product|media|category|tag
  source_id       TEXT NOT NULL,                     -- WordPress ID
  source_url      TEXT,                               -- WordPress permalink
  source_title    TEXT,
  destination_id  TEXT,                               -- Shopify ID (populated after import)
  destination_url TEXT,                               -- Shopify URL (populated after import)
  status          TEXT NOT NULL DEFAULT 'pending',    -- pending|exported|transformed|imported|failed
  error_message   TEXT,
  transform_data  JSONB,                              -- cached transformed payload
  retry_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_migration_items_job ON migration_items(job_id);
CREATE INDEX idx_migration_items_status ON migration_items(status);
CREATE INDEX idx_migration_items_type ON migration_items(item_type);
```

### Table: `migration_redirects`

```sql
CREATE TABLE migration_redirects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
  source_path     TEXT NOT NULL,                     -- /products/some-product
  destination_path TEXT NOT NULL,                    -- /products/some-product (Shopify path)
  status          TEXT DEFAULT 'pending',            -- pending|created|failed
  shopify_id      TEXT,                               -- Shopify redirect ID
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_migration_redirects_job ON migration_redirects(job_id);
```

---

## 4. Export Engine (`backend/engines/migration/export.ts`)

### Purpose
Read all data from the WordPress source via the TDS Geo plugin API + WooCommerce REST API.

### Methods

#### `exportAll(jobId, progressCallback)`

Orchestrator that runs all export methods in sequence.

#### `exportPosts(jobId): Promise<MigrationItem[]>`

- Calls `GET /wp-json/tds-geo/v1/posts?post_type=any&limit=100` with pagination
- Handles posts, pages, and any custom post type individually
- Extracts: title, content (rendered HTML), excerpt, status, slug, publish_date, author
- Extracts SEO meta: meta_title, meta_description (if stored in post_meta by plugin)
- Extracts featured image URL
- Writes each item to `migration_items` with `item_type = 'post'|'page'`

**Pagination:** TDS Geo plugin returns `limit` and `offset` params. Loop with offset+=100 until empty.

**Edge cases:**
- Password-protected posts → skip (can't read content)
- Posts in trash → skip
- Very long content (>100KB) → warn but include

#### `exportProducts(jobId): Promise<MigrationItem[]>`

- Calls `GET /wp-json/wc/v3/products?per_page=100` with WooCommerce API auth (consumer key + secret)
- Paginates using `x-wp-totalpages` header
- Extracts: title, description, short_description, SKU, regular_price, sale_price, stock_status, stock_quantity, weight, dimensions, categories, tags, images (URLs + alt text), attributes, variations
- Extracts Yoast SEO meta: `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`
- Writes each item to `migration_items` with `item_type = 'product'`

**Pagination:** WooCommerce REST API returns x-wp-totalpages header. Loop page++ until done.

**Edge cases:**
- Variable products → need to fetch variations separately via `GET /products/{id}/variations`
- Products with no images → flag for review
- Out-of-stock products → preserve stock status
- Grouped products → map as Shopify collection or note

#### `exportCategories(jobId): Promise<MigrationItem[]>`

- Calls `GET /wp-json/tds-geo/v1/categories`
- Extracts: name, slug, description, parent, count
- Writes each item with `item_type = 'category'`

**Edge cases:**
- Hierarchical categories → preserve parent/child via source_id mapping
- Uncategorized → map to Shopify's default collection

#### `exportTags(jobId): Promise<MigrationItem[]>`

- Calls `GET /wp-json/tds-geo/v1/tags`
- Extracts: name, slug, count
- Writes each item with `item_type = 'tag'`

#### `exportMedia(jobId): Promise<MigrationItem[]>`

- Calls `GET /wp-json/wp/v2/media?per_page=100` (or TDS Geo plugin if it supports media listing)
- Extracts: URL, title, alt_text, caption, description, mime_type, file_size, width, height
- Writes each item with `item_type = 'media'`
- Downloads first 5KB of each image to validate URL is accessible

**Pagination:** Standard WP REST API pagination via page param.

**Edge cases:**
- SVGs → Shopify doesn't support SVG uploads, flag as warning
- Very large images (>10MB) → flag for manual transfer
- Broken image URLs → mark failed with error

#### `exportAuthors(jobId): Promise<MigrationItem[]>`

- Calls `GET /wp-json/tds-geo/v1/authors`
- Extracts: display_name, email
- Stored for mapping during import

#### `exportUrls(jobId): Promise<void>`

- Reads `wp_options` via `GET /wp-json/tds-geo/v1/admin/db/query` or computes from post slugs + site URL
- Builds a complete URL map: all posts, products, pages, categories, tags → their WordPress permalinks
- Stores in `migration_redirects` for redirect generation

### Error Handling
- Each individual item export is wrapped in try/catch
- Failures record `error_message` on the `migration_items` row
- Progress reported after each 100 items
- Supports pause/resume: if a job is interrupted, `exportAll` skips items already exported

---

## 5. Transform Engine (`backend/engines/migration/transform.ts`)

### Purpose
Transform WordPress data model into Shopify-compatible format.

### Methods

#### `transformAll(jobId, progressCallback)`

Processes all exported items and populates `transform_data` JSONB column.

#### `transformPostToArticle(wpPost): TransformResult`

| WP Field | → Shopify Article Field | Notes |
|----------|------------------------|-------|
| `post_title` | `title` | Truncate to Shopify max 255 chars |
| `post_content` (HTML) | `body_html` | Clean shortcodes, convert Gutenberg blocks, rewrite internal WP URLs |
| `post_excerpt` | N/A | Shopify articles don't have excerpt; embed as first paragraph |
| `post_status` | `published` | 'publish' → true, 'draft' → false, 'future' → set published_at |
| `post_date` | `published_at` | ISO 8601 format |
| `tags` (names) | `tags` | Comma-separated string |
| `featured_image_url` | `image` | URL to be downloaded by import engine |
| `author.display_name` | `author` | String |
| `meta_title` | metafield `global.title_tag` | |
| `meta_description` | metafield `global.description_tag` | |

**Content Cleanup Rules (critical):**
1. Strip WordPress shortcodes (`[gallery]`, `[caption]`, `[contact-form]`, etc.) using regex
2. Convert Gutenberg HTML comments (`<!-- wp:paragraph -->`) to clean HTML
3. Rewrite internal WordPress image URLs to relative paths (for later mapping to Shopify CDN)
4. Remove empty `<p>` tags, excessive `<br>` tags
5. Fix heading hierarchy (ensure H1→H2→H3 order)
6. Wrap tables in `<div class="table-wrapper">` for responsive display

#### `transformProduct(wpProduct): TransformResult`

| WP Field | → Shopify Product Field | Notes |
|----------|------------------------|-------|
| `title` | `title` | |
| `description` | `body_html` | Cleaned HTML |
| `short_description` | embed in body_html or store in metafield | |
| `SKU` | `variants[0].sku` | |
| `regular_price` | `variants[0].price` | |
| `sale_price` | `variants[0].compare_at_price` | |
| `stock_status` | `variants[0].inventory_management` + `inventory_quantity` | 'instock' / 'outofstock' |
| `weight` | `variants[0].weight` | Convert unit if needed |
| `categories` | `product_type` or collections | First category → product_type |
| `tags` | `tags` | Comma-separated |
| `images` | `images` | Array of { source_url, alt_text, position } |
| `attributes` | `options` | Map to product options |
| `variations` | `variants` | Each variation → Shopify variant |
| `_yoast_wpseo_title` | metafield `global.title_tag` | |
| `_yoast_wpseo_metadesc` | metafield `global.description_tag` | |

**Product-specific rules:**
- Virtual products → set `variant.requires_shipping = false`
- Downloadable products → set `variant.requires_shipping = false` (Shopify handles downloads differently)
- Products with no SKU → generate from title slug + ID
- Price formatting → strip currency symbol, keep as decimal string
- Variable product with no variations → create as simple product

#### `transformCategoryToCollection(wpCategory): TransformResult`

| WP Field | → Shopify Collection Field |
|----------|---------------------------|
| `name` | `title` |
| `slug` | `handle` |
| `description` | `body_html` |
| `parent` | parent collection mapping |

Shopify collections are either:
- **Custom collections** (manually add products) → use when WP category has `count < 50`
- **Smart collections** (auto-collect by product type/tag) → use when WP category has `count >= 50`

#### `transformTag(wpTag): TransformResult`

Tags in Shopify are simple strings on products/articles. No tag creation API needed — set directly on the product/article.

#### `transformMedia(wpMedia): TransformResult`

Stores the source URL for later download + upload to Shopify.

#### URL Rewriting

Each transformed item's content is scanned for internal WP URLs (e.g., `https://old-site.com/wp-content/uploads/2024/image.jpg`) and replaced with placeholder tokens (e.g., `%%MEDIA_123%%`). During import, these are replaced with Shopify CDN URLs once images are uploaded.

---

## 6. Import Engine (`backend/engines/migration/import.ts`)

### Purpose
Push transformed data to Shopify via Admin REST API, respecting rate limits.

### Methods

#### `importAll(jobId, progressCallback)`

Processes all transformed items in dependency order:
1. Collections (products depend on them)
2. Products (media depends on product IDs)
3. Articles (media depends on article IDs)
4. Media uploads (after products/articles exist)
5. URL redirects (after everything has new URLs)

#### `createCollection(shopConfig, collectionData): Promise<ShopifyCollection>`

- Calls `POST /admin/api/2025-07/custom_collections.json` or `smart_collections.json`
- Sets title, handle, description (body_html), image (if available)

**New backend method needed:** `shopifyService.createCollection(shopConfig, data)`

#### `createProduct(shopConfig, productData): Promise<ShopifyProduct>`

- Calls `POST /admin/api/2025-07/products.json`
- Supports all fields: title, body_html, vendor, product_type, tags, status, variants, options, images

**New backend method needed:** `shopifyService.createProduct(shopConfig, data)`

#### `updateProductImages(shopConfig, productId, images): Promise<void>`

- For each image URL, call `POST /admin/api/2025-07/products/{id}/images.json`
- If multiple images, upload in order with position

#### `createArticle(shopConfig, blogId, articleData): Promise<ShopifyArticle>`

- Calls `POST /admin/api/2025-07/blogs/{blogId}/articles.json`
- Sets title, body_html, tags, author, published, published_at, image

**Already exists:** `shopifyService.publishArticle()`

#### `createRedirect(shopConfig, sourcePath, destinationPath): Promise<void>`

- Calls `POST /admin/api/2025-07/redirects.json`
- Sets path (source), target (destination), redirect_type (301)

**New backend method needed:** `shopifyService.createRedirect(shopConfig, source, target)`

#### `setSEOMetafields(shopConfig, resourceType, resourceId, metaTitle, metaDescription)`

- Uses Metafield API: `POST /admin/api/2025-07/products/{id}/metafields.json` or `articles/{id}/metafields.json`
- Namespace: `global`, keys: `title_tag`, `description_tag`

**Already exists:** `upsertMetafield()` in products.ts — needs to be promoted to shared utility.

### Rate Limiting

Shopify Admin API limits: **40 requests per second per app per store**.

Strategy:
- Token bucket rate limiter: 40 tokens, refill 40/sec
- Each batch request acquires a token before executing
- If 429 received, exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
- Queue items in groups of 5 for parallel execution (within rate limit)

Implementation: extend `backend/services/shopify/rate-limit.ts` with a `RateLimiter` class.

```typescript
class ShopRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number;  // tokens per second

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) { this.tokens--; return; }
    const waitMs = ((1 - this.tokens / this.refillRate) * 1000) + 1;
    await sleep(waitMs);
    return this.acquire();
  }
}
```

### Batched Execution

```typescript
async function importBatch(jobId, items, importFn, batchSize = 5) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(item => rateLimiter.acquire().then(() => importFn(item)))
    );
    for (const result of results) {
      // Update migration_items status
    }
    updateJobProgress(jobId, (i + batchSize) / items.length * 100);
  }
}
```

---

## 7. Progress Tracker (`backend/engines/migration/tracker.ts`)

### Purpose
Persist migration state for resume capability and real-time monitoring.

### Methods

#### `createJob(clientId, sourceUrl, destinationShop): Promise<MigrationJob>`

- Inserts row into `migration_jobs`
- Returns job ID

#### `updateJobProgress(jobId, pct, phase, stats?)`

- Updates `progress_pct`, `phase`, `stats` JSONB

#### `addItem(jobId, type, sourceId, sourceTitle): Promise<MigrationItem>`

- Inserts into `migration_items`
- Returns item ID

#### `updateItemStatus(itemId, status, destinationId?, error?)`

- Updates status, destination_id, destination_url, error_message

#### `getPendingItems(jobId, type, limit = 100): Promise<MigrationItem[]>`

- Returns items with `status = 'pending'` for a given type
- Used by resume logic

#### `getJobSummary(jobId): Promise<JobSummary>`

```typescript
interface JobSummary {
  total: { posts: number, products: number, media: number, categories: number, tags: number };
  imported: { posts: number, products: number, media: number, categories: number, tags: number };
  failed: { posts: number, products: number, media: number, categories: number, tags: number };
  errors: Array<{ itemId, type, title, message }>;
  duration: number;  // seconds
}
```

---

## 8. Report Generator (`backend/engines/migration/report.ts`)

### Purpose
Generate human-readable migration reports.

### Methods

#### `generateSummary(jobId): Promise<MigrationReport>`

Returns a structured report object.

#### `generateRedirectCsv(jobId): Promise<string>`

Generates CSV for redirect import:

```csv
source_path,destination_path,redirect_type
/produgärzen/boston-vitamin-c,/collections/vitamins/products/boston-vitamin-c,301
/about-us,/pages/about-us,301
```

Shopify can import this CSV directly into Navigation → URL Redirects.

#### `generateErrorReport(jobId): Promise<string>`

Lists all failed items with error messages for manual review.

#### `generateMediaManifest(jobId): Promise<string>`

Lists all media files that need manual transfer (broken URLs, oversized files, unsupported types).

---

## 9. Shopify Service Extensions (`backend/services/shopify/`)

### New Method: `createProduct()`

```typescript
async function createProduct(
  shopConfig: ShopifyConfig,
  product: {
    title: string;
    bodyHtml?: string;
    vendor?: string;
    productType?: string;
    tags?: string;
    status?: 'active' | 'draft';
    variants?: Array<{
      price: string;
      compareAtPrice?: string;
      sku?: string;
      inventoryQuantity?: number;
      inventoryManagement?: 'shopify' | null;
      weight?: number;
      weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
      option1?: string;
    }>;
    options?: Array<{ name: string; values: string[] }>;
    images?: Array<{ attachment?: string; src?: string; alt?: string; position?: number }>;
    metafields?: Array<{ namespace: string; key: string; value: string; type: string }>;
  }
): Promise<any>
```

- Calls `POST /admin/api/2025-07/products.json`
- Returns created product with Shopify IDs

File: `backend/services/shopify/products.ts`

### New Method: `createCollection()`

```typescript
async function createCollection(
  shopConfig: ShopifyConfig,
  collection: {
    title: string;
    handle?: string;
    descriptionHtml?: string;
    image?: { src?: string; alt?: string };
    collects?: Array<{ productId: number }>;  // for custom collections
    rules?: Array<{ column: string; relation: string; condition: string }>;  // for smart collections
    disjunctive?: boolean;
    published?: boolean;
  }
): Promise<any>
```

- Calls `POST /admin/api/2025-07/custom_collections.json` or `smart_collections.json`
- Returns created collection with Shopify ID

File: `backend/services/shopify/collections.ts` (new file)

### New Method: `createRedirect()`

```typescript
async function createRedirect(
  shopConfig: ShopifyConfig,
  redirect: {
    path: string;        // source path (e.g., "/products/old-product")
    target: string;      // destination path (e.g., "/products/new-product")
    redirectType?: number;  // 301 (default) or 302
  }
): Promise<any>
```

- Calls `POST /admin/api/2025-07/redirects.json`
- Returns created redirect with Shopify ID

File: `backend/services/shopify/redirects.ts` (new file)

### New Method: `ensureBlogExists()`

```typescript
async function ensureBlogExists(shopConfig: ShopifyConfig): Promise<number>
```

- Checks if "News" or "Blog" blog exists
- If not, creates one via `POST /admin/api/2025-07/blogs.json`
- Returns blog ID

### New Utility Function: `upsertMetafield()`

Promote from `products.ts` to a shared utility:

```typescript
async function upsertMetafield(
  shopConfig: ShopifyConfig,
  ownerType: 'products' | 'articles',
  ownerId: number,
  namespace: string,
  key: string,
  value: string,
  type: string = 'single_line_text_field'
): Promise<void>
```

File: `backend/services/shopify/metafields.ts` (new file, or keep in a shared location)

### Rate Limiter Enhancement

Extend `backend/services/shopify/rate-limit.ts`:
```typescript
class RateLimiter {
  constructor(maxPerSecond: number = 40);
  async acquire(): Promise<void>;
  async batchAcquire(count: number): Promise<void>;
}
```

Update the `getQueue()` in `client.ts` to use this rate limiter.

---

## 10. API Routes (`backend/routes/migration.ts`)

### `POST /api/migration/start`

Start a new migration job.

**Request:**
```json
{
  "clientId": "uuid",
  "source": {
    "url": "https://old-wp-site.com",
    "apiKey": "kai_...",
    "wcConsumerKey": "ck_...",
    "wcConsumerSecret": "cs_..."
  },
  "options": {
    "includePosts": true,
    "includeProducts": true,
    "includeMedia": true,
    "includeRedirects": true,
    "dryRun": false,
    "batchSize": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "status": "running",
  "estimatedItemCount": 0
}
```

### `GET /api/migration/:jobId/status`

Get migration job status.

**Response:**
```json
{
  "jobId": "uuid",
  "status": "running",
  "phase": "import",
  "progressPct": 45.2,
  "stats": {
    "posts": { "total": 150, "imported": 68, "failed": 2 },
    "products": { "total": 80, "imported": 40, "failed": 0 },
    "media": { "total": 300, "imported": 120, "failed": 5 },
    "categories": { "total": 12, "imported": 12, "failed": 0 }
  },
  "errors": [
    { "itemType": "post", "sourceId": "123", "title": "Some Post", "error": "Image download failed" }
  ],
  "duration": "12m 34s",
  "estimatedRemaining": "15m 20s"
}
```

### `GET /api/migration/:jobId/report`

Get final migration report.

**Response:** Summary report + downloadable CSV URLs.

### `POST /api/migration/:jobId/pause`

Pause a running migration.

### `POST /api/migration/:jobId/resume`

Resume a paused/failed migration.

### `POST /api/migration/:jobId/cancel`

Cancel a migration job (marks remaining items as skipped).

---

## 11. CLI Script (`scripts/wp-to-shopify-migrate.mjs`)

For headless/scheduled usage:

```bash
# Start migration
node scripts/wp-to-shopify-migrate.mjs start \
  --client <clientId> \
  --source https://old-wp-site.com \
  --api-key kai_... \
  --destination traffic-test.myshopify.com

# Check status
node scripts/wp-to-shopify-migrate.mjs status <jobId>

# Generate report
node scripts/wp-to-shopify-migrate.mjs report <jobId> --format json

# Export redirect CSV
node scripts/wp-to-shopify-migrate.mjs redirects <jobId> --output redirects.csv

# Dry run (export + transform only, no import)
node scripts/wp-to-shopify-migrate.mjs start --dry-run ...
```

---

## 12. UI / Dashboard Integration

### New Page: `/migrate` (in the frontend SPA or admin section)

- **Start Migration** form with source/destination configuration
- **Migration Dashboard** showing active/past jobs
- **Real-time Progress** via Server-Sent Events (SSE) or polling `GET /api/migration/:jobId/status`
- **Report View** with expandable error list and download links

### Existing Pages to Update

- **Client Detail Page:** Add "Migrate to Shopify" button if client has both WordPress connection and Shopify config
- **Admin Dashboard:** Show migration health/status

---

## 13. Implementation Order

### Phase 1: Foundation (Est. 4–5 hours)

| Step | File | Description |
|------|------|-------------|
| 1.1 | `backend/services/shopify/metafields.ts` | Extract `upsertMetafield` to shared utility |
| 1.2 | `backend/services/shopify/products.ts` | Add `createProduct()` method |
| 1.3 | `backend/services/shopify/collections.ts` | Add `createCollection()` method (new file) |
| 1.4 | `backend/services/shopify/redirects.ts` | Add `createRedirect()` method (new file) |
| 1.5 | `backend/services/shopify/rate-limit.ts` | Add `RateLimiter` class with token bucket |
| 1.6 | `backend/services/shopify/client.ts` | Integrate `RateLimiter` into `getQueue()` |
| 1.7 | `backend/services/shopify/index.ts` | Export new methods |

### Phase 2: Database + Tracking (Est. 2–3 hours)

| Step | File | Description |
|------|------|-------------|
| 2.1 | `backend/engines/migration/migration-schema.sql` | SQL to create migration tables |
| 2.2 | `backend/engines/migration/tracker.ts` | `createJob()`, `updateJobProgress()`, `addItem()`, `updateItemStatus()` |
| 2.3 | `backend/engines/migration/tracker.ts` | `getPendingItems()`, `getJobSummary()` |
| 2.4 | Migration SQL deployment script | Run on DB as part of setup |

### Phase 3: Export Engine (Est. 3–4 hours)

| Step | File | Description |
|------|------|-------------|
| 3.1 | `backend/engines/migration/export.ts` | `exportPosts()`, `exportPages()` |
| 3.2 | `backend/engines/migration/export.ts` | `exportProducts()` with variation handling |
| 3.3 | `backend/engines/migration/export.ts` | `exportCategories()`, `exportTags()` |
| 3.4 | `backend/engines/migration/export.ts` | `exportMedia()`, `exportAuthors()` |
| 3.5 | `backend/engines/migration/export.ts` | `exportUrls()` — build redirect map |
| 3.6 | `backend/engines/migration/export.ts` | `exportAll()` orchestrator with resume |

### Phase 4: Transform Engine (Est. 3–4 hours)

| Step | File | Description |
|------|------|-------------|
| 4.1 | `backend/engines/migration/transform.ts` | Content cleanup utilities (strip shortcodes, clean Gutenberg) |
| 4.2 | `backend/engines/migration/transform.ts` | `transformPostToArticle()` |
| 4.3 | `backend/engines/migration/transform.ts` | `transformProduct()` |
| 4.4 | `backend/engines/migration/transform.ts` | `transformCategoryToCollection()` |
| 4.5 | `backend/engines/migration/transform.ts` | URL rewriting with media placeholder tokens |
| 4.6 | `backend/engines/migration/transform.ts` | `transformAll()` orchestrator |

### Phase 5: Import Engine (Est. 4–5 hours)

| Step | File | Description |
|------|------|-------------|
| 5.1 | `backend/engines/migration/import.ts` | Rate-limited batch executor |
| 5.2 | `backend/engines/migration/import.ts` | `importCollections()` |
| 5.3 | `backend/engines/migration/import.ts` | `importProducts()` + `importProductImages()` |
| 5.4 | `backend/engines/migration/import.ts` | `importArticles()` + `importArticleImages()` |
| 5.5 | `backend/engines/migration/import.ts` | `importRedirects()` |
| 5.6 | `backend/engines/migration/import.ts` | `importAll()` orchestrator with resume |

### Phase 6: Reporting + API (Est. 3–4 hours)

| Step | File | Description |
|------|------|-------------|
| 6.1 | `backend/engines/migration/report.ts` | `generateSummary()`, `generateRedirectCsv()` |
| 6.2 | `backend/engines/migration/index.ts` | Main migration orchestrator combining all engines |
| 6.3 | `backend/routes/migration.ts` | API routes (start, status, report, pause, resume, cancel) |
| 6.4 | `backend/index.ts` | Mount `/api/migration` routes |
| 6.5 | `scripts/wp-to-shopify-migrate.mjs` | CLI script |

### Phase 7: Testing + Polish (Est. 3–4 hours)

| Step | Description |
|------|-------------|
| 7.1 | Test with small WordPress site (10 posts, 5 products) |
| 7.2 | Test media migration (images of various sizes/types) |
| 7.3 | Test resume after interruption |
| 7.4 | Test with large catalog (500+ products) |
| 7.5 | Generate and verify redirect CSV |
| 7.6 | Edge case: password-protected, trashed, drafts |
| 7.7 | Error recovery: fix failures and re-run |

### Total: ~22–29 hours

---

## 14. Edge Cases & Error Handling

### Known Edge Cases

| Scenario | Handling |
|----------|----------|
| **WP site is down during export** | Retry 3x with exponential backoff, then fail gracefully with partial data |
| **Shopify API rate limited (429)** | Backoff + retry via RateLimiter; log warning |
| **Product has 200+ images** | Shopify max is 250 images; upload first 250, warn about overflow |
| **Post content has shortcodes** | Strip unknown shortcodes with regex `\[(\w+)[^\]]*\](?:.*?\[\/\1\])?` |
| **Gutenberg blocks** | Convert to clean HTML via regex patterns for common blocks |
| **Very large site (10k+ posts)** | Use BullMQ queue with concurrency 2; process in batches of 50 |
| **Image > 20MB** | Shopify max is 20MB for images; skip with warning |
| **Unsupported image format (SVG, WEBP)** | Shopify doesn't support SVG; convert WEBP to JPEG before upload |
| **Category with 0 products** | Skip collection creation, note in report |
| **Draft products** | Import as draft, preserve status |
| **Variable product with 200+ variants** | Shopify max is 100 variants; split into multiple products with warning |
| **Duplicate SKU** | Shopify requires unique SKU; append `-2`, `-3` etc. |
| **URL path longer than 255 chars** | Shopify max is 255; truncate with hash suffix |

### Error Categories

| Category | Action |
|----------|--------|
| **Critical** (auth failure, API unavailable) | Pause entire job, notify admin |
| **Item-level** (single product fails) | Mark item as failed, continue job, log error |
| **Warning** (image too large, missing field) | Mark item with warning, continue, include in report |
| **Info** (minor transformations) | Log with details for review |

### Retry Logic

```typescript
async function withRetry(fn, item, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      if (isRateLimit(err)) {
        const retryAfter = parseInt(err.headers['retry-after'] || '1');
        await sleep(retryAfter * 1000);
      } else {
        await sleep(attempt * 2000);  // 2s, 4s, 6s
      }
    }
  }
}
```

---

## 15. Security Considerations

- **API keys in transit:** All API calls are HTTPS. Source WooCommerce keys and Shopify tokens are stored encrypted in the `credential_vault` table when possible.
- **No data persistence beyond job:** After a migration completes, source WooCommerce/Shopify credentials can be purged from `migration_jobs`.
- **Rate limiting:** Built-in rate limiter prevents abuse of Shopify API.
- **File validation:** Downloaded media is validated for MIME type before upload to Shopify.
- **Audit trail:** All errors and actions are logged with timestamps.

---

## 16. Future Enhancements (Phase 2)

- **Incremental sync:** Re-run migration to catch only new/changed items since last run
- **Order migration:** Transfer historical orders (requires Shopify Orders API + payment mapping)
- **Customer migration:** Transfer user accounts (requires password hashing considerations)
- **Review migration:** Transfer WooCommerce product reviews to Shopify (via Shopify Reviews API or app)
- **WPML/Polylang support:** Handle multilingual sites
- **ACF field mapping:** Migrate Advanced Custom Fields to Shopify metafields
- **Database-level export** for ultra-large sites (direct MySQL read via the plugin's admin DB endpoint)

---

## 17. Appendices

### A. Useful Shopify API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/api/2025-07/products.json` | POST | Create product |
| `/admin/api/2025-07/products/{id}.json` | PUT | Update product |
| `/admin/api/2025-07/products/{id}/images.json` | POST | Add product image |
| `/admin/api/2025-07/custom_collections.json` | POST | Create custom collection |
| `/admin/api/2025-07/smart_collections.json` | POST | Create smart collection |
| `/admin/api/2025-07/blogs/{id}/articles.json` | POST | Create article |
| `/admin/api/2025-07/redirects.json` | POST | Create URL redirect |
| `/admin/api/2025-07/products/{id}/metafields.json` | POST | Set product metafield |

### B. Useful WordPress/WooCommerce REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/wp-json/tds-geo/v1/posts` | GET | List all posts (any type) |
| `/wp-json/tds-geo/v1/posts/{id}` | GET | Get single post |
| `/wp-json/tds-geo/v1/categories` | GET | List categories |
| `/wp-json/tds-geo/v1/tags` | GET | List tags |
| `/wp-json/tds-geo/v1/authors` | GET | List authors |
| `/wp-json/tds-geo/v1/media` | GET | Get media item |
| `/wp-json/wc/v3/products` | GET | List WooCommerce products |
| `/wp-json/wc/v3/products/{id}` | GET | Get single product |
| `/wp-json/wc/v3/products/{id}/variations` | GET | Get product variations |
| `/wp-json/wc/v3/products/categories` | GET | List product categories |
| `/wp-json/wc/v3/products/tags` | GET | List product tags |
| `/wp-json/wp/v2/media` | GET | List media library |

### C. Content Cleanup Regex Patterns

```javascript
// Strip WordPress shortcodes
content = content.replace(/\[(\w+)[^\]]*\](?:.*?\[\/\1\])?/gs, '');

// Strip Gutenberg HTML comments
content = content.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');

// Remove empty paragraphs
content = content.replace(/<p>\s*(<br\s*\/?>\s*)*<\/p>/gi, '');

// Fix heading hierarchy
content = content.replace(/<h3>/gi, '<h4>').replace(/<\/h3>/gi, '</h4>');
content = content.replace(/<h2>/gi, '<h3>').replace(/<\/h2>/gi, '</h3>');
content = content.replace(/<h1>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>');

// Wrap tables for responsive display
content = content.replace(/<table>/gi, '<div class="table-wrapper"><table>');
content = content.replace(/<\/table>/gi, '</table></div>');
```

### D. Redirect CSV Format (Shopify-Compatible)

```csv
Old Path,New Path,Redirect Type
/produkte/boston-vitamin-c,/products/boston-vitamin-c,301
/uber-uns,/pages/about-us,301
/kontakt,/pages/contact,301
/kategorie/gesundheit,/collections/health,301
```
