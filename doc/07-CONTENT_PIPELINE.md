# Content Generation Pipeline

## Overview

When a user clicks "Generate", the article goes through **24+ stages** in sequence. Each stage is wrapped in try/catch — one failure doesn't kill the whole pipeline.

## Stage by Stage

```
Stage  1: Validation
          → Check input parameters (keyword, client, limits)
          → Verify budget and rate limits

Stage  2: Context Loading
          → Load client brand voice profile
          → Load website intelligence (scraped data)
          → Load knowledge base (RAG) context
          → Load article history (avoid repeats)

Stage  3: Keyword Analysis
          → Score the selected keyword
          → Check search volume and competition

Stage  4: Title Generation (via GPT-4o)
          → Generate 5+ title options
          → Score each for SEO and click-through

Stage  5: Outline Generation
          → Create full article outline with sections
          → Identify key points per section

Stage  6: Article Generation
          → Write full long-form article via OpenAI
          → Follow brand voice guidelines
          → Include target keywords naturally

Stage  7: Content Safety Check
          → Scan for 8+ hazard categories
          → Block or flag unsafe content

Stage  8: Fact Checking
          → Verify claims against known data
          → Flag uncertain statements

Stage  9: Brand Voice Enforcement
          → Check tone consistency
          → Scan for forbidden phrases
          → Apply preferred terminology

Stage 10: SEO Analysis
          → Keyword density check
          → Readability scoring
          → Internal link suggestions
          → Meta description optimization

Stage 11: Internal Link Optimization
          → Suggest links to other articles
          → Build topic clusters

Stage 12: FAQ Generation
          → Generate FAQ schema from content
          → Add structured data

Stage 13: Metadata Generation
          → Meta title, description
          → Open Graph tags
          → Twitter card data

Stage 14: Featured Image
          → Search Pexels for relevant image
          → Or generate via DALL-E
          → Or use client's default image

Stage 15: Quality Scoring
          → Multi-dimension evaluation
          → Score 0-100
          → Flag low-quality content

Stage 16: Cost Tracking
          → Log OpenAI token usage
          → Log API call costs
          → Deduct from client budget

Stage 17: Webhook Dispatch
          → Notify connected systems
          → Trigger post-publish workflows
```

## After the Pipeline

### Approval Check

| Mode | Behavior |
|---|---|
| **Auto** | Quality score > threshold → auto-publish |
| **Manual** | Status = 'draft' → editor reviews and approves |

### Publishing

| Destination | How |
|---|---|
| **Shopify** | Shopify Admin REST API: upload image → create article with tags + metadata |
| **WordPress** | POST to WordPress plugin `tds-geo/v1/posts` → plugin creates post |
| **Next.js** | POST webhook → Next.js stores content + triggers ISR revalidation |

### Post-Publish

- Activity logged to database
- Cost recorded
- Self-improvement service analyzes results
- Dashboard updated with real-time metrics
- n8n workflow triggered (if configured)

## Pipeline Architecture

The pipeline is built as a **state machine** — each stage can:
- **Pass** → proceed to next stage
- **Fail** with error → pipeline stops (non-fatal, article marked as failed)
- **Warn** → stage completes but flags an issue (proceeds)

## Key Files

| File | Purpose |
|---|---|
| `backend/orchestrators/blogPipeline.ts` | Main pipeline orchestrator (1089 lines) |
| `backend/orchestrators/CeoOrchestrator.ts` | GEO-specific pipeline variant |
| `backend/services/openai.ts` | OpenAI API client |
| `backend/prompts/` | AI system prompts as Markdown files |
| `backend/services/brandVoice.ts` | Brand voice injection + consistency check |
| `backend/services/factCheck.ts` | Fact checking service |
| `backend/services/seoEngine.ts` | SEO analysis |
| `backend/services/qualityEngine.ts` | Quality scoring |
| `backend/services/costTracker.ts` | Cost tracking |
| `backend/connectors/shopify/` | Shopify publisher |
| `backend/connectors/wordpress.ts` | WordPress publisher |

## AI Models Used

| Task | Model | Provider |
|---|---|---|
| Article generation | GPT-4o | OpenAI |
| Embeddings | text-embedding-3-small | OpenAI |
| Image generation | DALL-E 3 | OpenAI |
| Simple tasks (fallback) | Ministral 3:14b | Ollama (cloud) |
| Prompt compression | Headroom | Docker sidecar |
