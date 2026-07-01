# SEO Analysis

## How SEO Scoring Works

SEO analysis runs during the content pipeline (Stage 10) and as a background worker. Each article gets scores stored in the database.

## Scores Stored Per Article

| Score | Column | Range | What It Measures |
|---|---|---|---|
| SEO Score | `seo_score` | 0-100 | Overall SEO fitness |
| Readability | `readability_score` | 0-100 | How easy to read |
| Quality Score | `quality_score` | 0-100 | General content quality |
| E-E-A-T Score | `eat_score` | 0-100 | Experience, Expertise, Authoritativeness, Trustworthiness |

## What SEO Analysis Checks

The `seoService.analyzeContent(content, keyword)` checks:

### Keyword Optimization
- Keyword density (target: 1-2%)
- Keyword placement (title, H1, first paragraph, last paragraph)
- Secondary/LSI keyword usage
- Keyword stuffing detection

### Structure
- Heading hierarchy (exactly one H1, proper H2/H3 nesting)
- Paragraph length (optimal: 2-4 sentences)
- Use of bulleted/numbered lists
- Image alt text presence

### Readability
- Flesch Reading Ease score
- Sentence length distribution
- Transition word usage
- Passive voice detection

### Technical SEO
- Meta title length (optimal: 50-60 chars)
- Meta description length (optimal: 150-160 chars)
- URL slug quality
- Open Graph tag presence

## SEO Intelligence (Enterprise)

Beyond basic scoring, the enterprise system provides:

### SERP Analysis
- Searches Google for the target keyword
- Analyzes what competitors rank for
- Identifies featured snippet opportunities

### Entity Extraction
- Extracts named entities from content (people, places, brands)
- Maps entities to knowledge graph
- Suggests related entities to include

### Content Gap Analysis
- Compares client content against competitors
- Finds topics competitors cover that client doesn't
- Suggests new article topics

### Internal Linking
- Suggests links from new article to existing content
- Scores link relevance
- Builds topic cluster structure

## How Scores Feed the Pipeline

```
After article generation:
  → seoService.analyzeContent(article, keyword)
  → If score < threshold: flag for revision
  → If score >= threshold: proceed to next stage
  → Store scores in articles table
  → Log suggestions for improvement
```

## Related Files

| File | Purpose |
|---|---|
| `backend/services/seo.ts` | Main SEO analysis service |
| `backend/services/seoIntelligence.ts` | Enterprise SEO intelligence |
| `backend/workers/index.ts` | SEO analysis worker (handleSeoAnalysis) |
| `backend/types/index.ts` | SeoAnalysis type definition |
