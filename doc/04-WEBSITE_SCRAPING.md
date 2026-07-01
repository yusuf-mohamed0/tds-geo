# Website Scraping — Per-Client Intelligence

## What It Scrapes

When triggered, the scraper crawls up to **15 predefined pages** on the client's website plus any internal links found on the homepage.

### Pages Scanned

| Page | Purpose |
|---|---|
| `/` (homepage) | Main value proposition, brand positioning |
| `/about` | Company background, mission, team |
| `/services` or `/products` | What they sell, service descriptions |
| `/contact` | Contact info, locations |
| `/blog` | Existing content (if exists) |
| `/faq` | Common customer questions |
| Any internal links on homepage | Additional context |

### Raw Data Extracted Per Page

| Data Point | Example |
|---|---|
| Page title | "Digital Marketing Agency — SEO Services" |
| Meta description | "We help businesses grow with SEO" |
| All headings (h1, h2, h3) | `h1: "Our Services"`, `h2: "SEO Packages"` |
| Full paragraph text | Body content of the page |
| CTA buttons + links | "Book a Call → /contact" |
| Contact info | email, phone, address |
| Social links | LinkedIn, Facebook, Instagram URLs |
| Tech stack hints | `wp-content/` → WordPress, `cdn.shopify.com` → Shopify |

### Derived Insights

After analyzing all pages together, the system derives:

| Insight | How It's Determined |
|---|---|
| **Services** | Extracted from services/products/text |
| **Industries** | Detected from keywords (e.g., "healthcare", "SaaS", "e-commerce") |
| **Target audience** | From text patterns: "We help small business owners..." |
| **Unique selling points** | Repeated phrases: "24/7 support", "Money-back guarantee" |
| **Primary tone** | Keyword-scored across 6 dimensions (see below) |
| **Common terms/jargon** | Frequency analysis of industry-specific words |
| **Content gaps** | Missing pages that competitors have |
| **CTA patterns** | How they ask users to take action |

### Tone Analysis (6 Dimensions)

Each dimension scored 0-100 based on keyword matching in page text:

| Dimension | Keywords |
|---|---|
| Professional | formal, enterprise, solution, strategic |
| Friendly | we, you, help, together, team |
| Authoritative | expert, leader, trusted, years |
| Educational | learn, guide, tutorial, understand |
| Urgent | now, today, limited, hurry |
| Empathetic | understand, support, care, journey |

## Triggering a Scan

### Manual (via API)

```
POST /api/scraper/scan/{clientId}
  → Spawns Python script: python scrape_client.py <url>
  → Parses JSON output
  → Stores in website_intelligence table
  → Returns structured data
```

### Manual (single client)

```
GET /api/scraper/intelligence/{clientId}
```

### Batch Scan (admin only)

```
POST /api/scraper/scan-all
  → Scans all clients without existing intelligence
  → 2-second delay between scans to avoid rate limiting
```

## How It Feeds Article Generation

Before the AI writes an article, the system:

1. Loads scraped intelligence for this client
2. Formats it into a `ClientIntelligencePrompt` block:
   - Company name and description
   - Services offered
   - Target audience
   - Brand voice/tone
   - Unique selling points
   - Key terminology to use
   - CTA style examples
3. Injects this into the AI's system prompt

**Result:** Articles are written specifically for that client's business, not generic templates.

## Database Schema

Table: `website_intelligence` (one record per client, UNIQUE on `client_id`)

| Column | Description |
|---|---|
| `client_id` | Unique per client |
| `url` | Scanned website URL |
| `domain` | Extracted domain |
| `pages_scanned` | Number of pages crawled |
| `site_name` | Business name |
| `description` | Meta description |
| `services` | Array of {name, description, page} |
| `industries` | Detected industries |
| `target_audience` | Audience descriptions |
| `unique_selling_points` | USPs |
| `tone_analysis` | Tone scores + primary/secondary tone |
| `common_terms` | Industry terminology |
| `page_structure` | All h1/h2/h3 across pages |
| `contact_info` | Email, phone, address |
| `social_links` | Social media URLs |
| `tech_stack_hints` | Detected technologies |
| `content_gaps` | Missing content suggestions |
| `is_stale` | Whether a re-scan is needed |

## Related Files

| File | Purpose |
|---|---|
| `scripts/scraper/scrape_client.py` | Python scraper (643 lines) |
| `backend/services/clientScraper.ts` | TypeScript integration + DB storage |
| `backend/routes/clientScraper.ts` | API endpoints for scraping |
| `backend/database/migration_website_intelligence.sql` | Table schema |
