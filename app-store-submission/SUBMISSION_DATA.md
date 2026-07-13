# Shopify App Store Submission — TDS Geo

> Fill every field below into the Partner Dashboard at https://partners.shopify.com

---

## 1. Basic App Information

### App Name
```
TDS Geo
```

### App Icon
Upload `screenshots/app-icon-square.png` (Swype logo on white — 1024×1024px)
> Also available: `app-icon-square-dark.png` (white logo on dark background)

### Primary Category
```
Store design › Site optimization › SEO
```

### Category Details — SEO Tools
Select ALL that apply:
- [x] AI generation — core feature: AI content generation
- [x] Content optimization — GEO analysis optimizes content for AI engines
- [x] Meta tags — auto-generates meta titles/descriptions
- [x] Metadata optimization — SEO metadata on all generated articles
- [x] SEO score — built-in GEO/SEO scoring engine
- [x] Keyword analysis — keyword extraction and optimization
- [x] Bulk editing — batch article generation and publishing
- [x] Duplicate content — EEAT framework ensures original content
- [x] APIs and webhooks — Shopify Admin API integration
- [x] Automations — one-click content generation pipeline
- [x] Reporting — dashboard with article stats and scores

### Category Details — Monitoring
Select ALL that apply:
- [x] Analytics — dashboard with KPIs, article stats, activity charts
- [x] Audits — GEO analysis audits content across 7 AI engines
- [x] Content analysis — per-paragraph citability scoring
- [x] Competitor analysis — citation tracking across AI engines
- [x] Insights and tips — AI-generated recommendations after analysis
- [x] Reporting — costs, quality metrics, generation history
- [x] SEO score — per-engine GEO readiness scores
- [x] Rank tracking — citation tracking (cited/not cited per engine)
- [x] Tracking — AI citation monitoring over time

### Languages
```
Arabic, English
```

---

## 2. App Store Listing Content

### App Introduction (98/100 chars)
```
Optimize your Store content for AI-powered search engines like ChatGPT, Perplexity, and Google Gem
```

### App Details (397/500 chars)
```
TDS Geo helps Shopify merchants optimize their content for Generative Engine Optimization (GEO) , the practice of structuring content so AI search engines naturally cite your store as a source.

AI-powered search engines are changing how customers discover products online. If your content isn't structured for how AI models extract and cite information, you're invisible to this growing audience.
```

### Features

**Feature 1 — AI Content Generation** (80/80)
```
AI content generation — automatically creates GEO-optimized articles tailored to
```

**Feature 2 — GEO Analysis & Improvement** (80/80)
```
GEO analysis & improvement — scores content across major AI engines and rewrites
```

**Feature 3 — Smart Publishing** (80/80)
```
Smart publishing — schedule and publish optimized content directly to your Shopi
```

### Demo Store URL
```
https://admin.shopify.com/store/traffic-test
```

### Feature Media
- **Video** (recommended): Upload `screenshots/app-walkthrough.webm` to YouTube as **unlisted**
  - **Duration**: ~90 seconds (under 3 min limit ✓)
  - **Dimensions**: 1600×900 ✓
  - **Content**: Login → Dashboard → Articles → Article Detail → GEO URL Audit → Citations → Costs → Clients
  - **YouTube URL**: `https://www.youtube.com/embed/GvqorasmfGU`
- **Video thumbnail**: `screenshots/02-dashboard.png` (1600×900px)

### Desktop Screenshots

| # | File | Alt text |
|---|---|---|
| 1 | `screenshots/02-dashboard.png` | TDS Geo embedded dashboard showing article generation statistics |
| 2 | `screenshots/04-articles-list.png` | TDS Geo articles management view with list of generated content |
| 3 | `screenshots/06-geo-analysis.png` | TDS Geo GEO analysis page showing content scoring across AI engines |

### Integrations
None required.

---

## 3. Support & Contact

### Preferred Support Channel
```
Support email address
```

### Support Email
```
web.development@trafficdigitalsolutions.com
```

### Privacy Policy URL
```
https://traffic.16.192.29.174.nip.io/privacy
```
> ✓ Verified — live and serving content.

### Developer Website
```
https://trafficdigitalsolutions.com
```

---

## 4. Pricing Details

### Public Plans (3 tiers)

| Display name | Price | Interval |
|---|---|---|
| **Traffic** | $29/month | Monthly (EVERY_30_DAYS) |
| **Professional** | $79/month | Monthly (EVERY_30_DAYS) |
| **Enterprise** | $199/month | Monthly (EVERY_30_DAYS) |

> Billing uses Shopify Billing API — `appSubscriptionCreate` GraphQL mutation.
> 3 plans defined in `backend/routes/billing.ts` (starter, professional, enterprise).

---

## 5. App Discovery Content

### App Card Subtitle (43/62)
```
Get your website cited by AI search engines
```

### Search Terms (5 terms)
```
GEO
AI content
SEO optimization
generative engine op
content marketing
```

### Web Search Content

**Title Tag** (60/60):
```
TDS Geo - AI Content Generation & GEO Optimization for Shopi
```

**Meta Description** (158/160):
```
TDS Geo automatically generates and optimizes Shopify content for AI search engines like ChatGPT and Perplexity. Improve your store's GEO score and get cited.
```

---

## 6. Install Requirements

### Sales Channel Requirements
```
My app requires Shopify Online Store
```
> Reason: The app publishes articles to the Shopify blog, which is part of the Online Store sales channel. Articles live at `/blogs/news` on the storefront.

### Geographic Requirements
None — worldwide.

---

## 7. Tracking Information

| Field | Value |
|---|---|
| **Measurement ID** | (set up Google Analytics and add ID here) |
| **API Secret** | (set up Google Analytics and add secret here) |

---

## 8. Contact Information

| Field | Value |
|---|---|
| **Merchant review email** | `web.development@trafficdigitalsolutions.com` |
| **App submission email** | `web.development@trafficdigitalsolutions.com` |

> Add `noreply@shopify.com` to your allowlist.

---

## 9. App Testing Information

### Login Details

| Field | Value |
|---|---|
| **Username** | `admin@tds-geo.internal` |
| **Password** | `TrafficDSgeo@2024` |
| **Account description** | Shopify store admin account for traffic-test.myshopify.com, provides full access to embedded TDS Geo app and all features |

> User exists in DB (role: admin, id: f6d7fa9a...). Also tested with `admin@tds-geo.internal` / `TDSg30!Pr0d#2026_X9`.

### Screencast URL
```
https://youtu.be/GvqorasmfGU
```

### Testing Instructions (900/2800 chars)
```
1. Visit https://traffic-test.myshopify.com/admin and log in with the test account
2. In the left sidebar, click "Apps" → "TDS Geo" to open the embedded app
3. Dashboard tab — verify 4 metric cards load (Total Clients, Articles, Avg Keyword Relevance, MTD Costs)
4. Click "Articles" tab — verify the list of generated articles appears with status badges
5. Click any article to view its full content, status, and SEO metadata
6. Click "GEO Analysis" tab — test both "Paste Content" and "Enter URL" modes:
   - Paste sample content and click Analyze to see the score ring, engine cards, and LLM audit
   - Enter a known URL and verify per-engine scores and recommendations load
7. Click "Citations" tab — verify stats cards, color-coded engine badges, and numbered recommendations
8. Click "Costs" tab — verify cost breakdown per model and monthly totals
9. Click "Quality" tab — verify quality metrics and scores
10. Click "Clients" tab — verify client list and click any client to view their dashboard
```

---

## Partner Dashboard Quick Links

| Task | Value |
|---|---|
| **Allowed redirection URL** | `https://traffic.16.192.29.174.nip.io/api/shopify/callback` |
| **OAuth scopes** | `write_products,read_products,write_content,read_content,write_script_tags,read_script_tags,write_themes,read_themes` |
| **Webhook compliance topics** | `customers/data_request`, `customers/redact`, `shop/redact`, `app/uninstalled` |
| **App URL** | `https://traffic.16.192.29.174.nip.io` |
| **API key** | `a178c8740049e04eec663378b6e30ad8` |
| **API secret** | ✅ Server `.env` has `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` — verify this matches Partner Dashboard |
