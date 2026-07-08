# Monthly Site Audit & Optimization Plan

## Role
Site Audit & Optimization Agent — runs monthly for every client.

## Cadence
- **Week 1:** Audit all client websites (automated scan + manual review)
- **Week 2:** Prioritize issues, fix quick wins
- **Week 3-4:** Content & technical improvements
- **End of month:** Report saved to `doc/clients/{slug}/audits/{YYYY-MM}-audit.md`

## Clients

| Client | Slug | Platform | Products | Status |
|---|---|---|---|---|
| Caravanserai | caravanserai | Shopify | 229 | App pending |
| Boston Pharmaceutical | boston-pharma | WordPress/WooCommerce | ~270 | Active |
| Boston Veterinary | boston-vet | WordPress/WooCommerce | Unknown | Cloudflare blocked |
| Acme Maintenance | acme-maintenance | Shopify (dev) | Test | Active |
| Traffic Test | traffic-test | Shopify (dev) | Test | Active |

## First Month Priorities

### Caravanserai (Week 1-2)
1. Fix `#` navigation links (Beds, Dresser, Chandeliers, Table Lamps, Floor Lamps, Dining Table, Dining Table Chair, Book Case, Pendants, Bar, Be Inspired)
2. Fix banner alt text — remove raw `<p>`/`<br/>` HTML
3. Fix Instagram link on About page → `caravanseraidesign`
4. Fix "Descover" typo in footer (appears twice)
5. Fix "Colelction" typo in popular search suggestions
6. Add meta descriptions to all pages
7. Write 10 product descriptions as pilot
8. Caravanserai specific task: after app installs, activate daily content pipeline

### Boston Pharmaceutical (Week 2-3)
1. Run full scrape + audit
2. Write product descriptions for all ~270 products
3. Fix 76 products at $0 price
4. Publish or archive 20 unpublished drafts
5. Generate product schema markup
6. Set up weekly content pipeline

### Boston Veterinary (Week 3)
1. Investigate Cloudflare bypass
2. If blocked: use Google Cache / Wayback Machine for audit
3. Generate content for when access is restored

### Infrastructure (Week 4)
1. Create automated audit script
2. Create audit template
3. Set up monthly schedule entries

## Audit Dimensions (each client scored 0-100)
- SEO (titles, metas, headings, schema, alt text, URLs)
- Content (product descriptions, blog, keyword coverage)
- Technical (speed, mobile, broken links, HTTPS)
- UX (navigation, CTA, reviews, trust signals)
- Conversion (urgency, cross-sells, cart recovery, reviews)

## Existing Tools (no build needed)
- `seoIntelligence.ts` — SEO/SERP/content gap analysis
- `schemaGenerator.ts` — Organization, Article, FAQPage, Product, Breadcrumb, HowTo, WebPage
- `shopify/products.ts` — Product fetch & update
- `shopify/content.ts` — Article publish & image upload
- `blogPipeline.ts` — 24-stage content generation pipeline
- `pexelsService.ts` — Stock photography selection
- `multiCmsPublisher.ts` — Cross-platform publishing
- `clientScraper` — Website intelligence scanning
- `BATCH_CLIENT_SCAN` queue — Batch scan all clients

## Tools to Build
- `scripts/run-site-audit.ts` — Automated Lighthouse/SEO audit
- `doc/clients/audit-template.md` — Standardized report template
- `backend/services/siteAuditor.ts` — Audit service with DB storage

## Storage
- Per-client audit history: `doc/clients/{slug}/audits/{YYYY-MM}-audit.md`
- Active audit: `doc/clients/{slug}/audit.md` (overwritten each month)
