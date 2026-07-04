# LLMO — Large Language Model Optimization Prompt

**Purpose:** Structure content so large language models (ChatGPT, Claude, Gemini, Perplexity, and other LLMs) build an accurate internal representation of your brand, products, expertise, and entities — and cite you confidently in their responses.

## Core Principles

LLMO targets TWO pathways:
1. **Training data** — Your content on Common Crawl, Wikipedia, academic sources shapes the model's internal knowledge
2. **Live retrieval (RAG)** — Your content retrieved and cited at query time (this is where AEO + GEO tactics apply)

## The 6 Highest-Impact LLMO Tactics

### 1. Answer Capsules (Foundation)
After every H2 heading, write a 40-60 word direct answer that is self-contained and quotable.

### 2. Named Expert Quotes (+40.9% Citation Lift)
Format for maximum citability:
```
"[Direct quote with specific claim]" — [Full Name], [Title/Role] at [Institution/Company]
```
Include 2+ per 1,000 words. Credentials must be specific and verifiable. "Pranjal Aggarwal, a researcher at Princeton University" is citable. "Experts say" is not.

### 3. Sourced Statistics (+30.6% Citation Lift)
Format:
```
[Number]% of [population] [action/result], according to a [year] [institution] study of [sample size].
```
Include 1 per 150-200 words. Always name the source and year. Sample size disclosure strengthens the signal.

### 4. Comparison Tables (+34% Gemini Citations)
Use `<table>` for:
- Product/feature comparisons
- Before/after scenarios
- Methodology comparisons
- Cost/benefit analyses

### 5. FAQ Sections
Use real user search queries as question text. Phrase conversationally. Mark up with FAQPage JSON-LD. Format:
```
### [Full natural language question]?
[Concise, definitive answer with sourced evidence when possible]
```

### 6. Entity Consistency (Foundational)
Your company, product, people, partners must be written IDENTICALLY across:
- Your website → Wikipedia/LinkedIn → Reviews (G2, Capterra, Trustpilot) → Directories → Press mentions

## Section Architecture

```
## [Entity-Rich Heading]

**Answer capsule (40-60 words):** Direct, quotable definition.

[Detail paragraph with named expert quote and/or sourced statistic]

[Optional: Comparison table if relevant]

[Optional: Edge case or limitation paragraph]

**Entity notes:** [List key entities mentioned in this section — products, people, concepts, organizations]
```

## Content Structure for LLM Retrieval

**Within first 100 words:** Answer the primary question (44.2% of ChatGPT citations come here).
**H2 headings:** Match real user prompt language, not keyword variants.
**Paragraphs:** Each makes exactly one point. Max 5 sentences.
**Definitions:** Every named concept has an explicit definition somewhere in the page.
**Internal links:** Descriptive anchor text. Link to related cluster content.

## Topical Authority Architecture

Build content clusters:
```
Pillar: Comprehensive overview of major topic (3,000+ words)
├── Cluster 1: Deep dive on subtopic A (1,500-2,000 words)
├── Cluster 2: Deep dive on subtopic B
├── Cluster 3: Deep dive on subtopic C
├── ... (5-12 clusters)
```

All internally linked with entity-rich anchor text. This signals depth of expertise to LLM retrieval systems.

## Freshness

- Publish or significantly update content within the last 12 months
- ~65% of AI bot hits target content published within the past year
- Update statistics, examples, references on a quarterly cadence
- Use `dateModified` schema that reflects actual changes (not auto-generated timestamps)

## Definitive Language

Cited text is nearly twice as likely to contain definitive phrasing (36.2% vs 20.3%).

**DO:** "The most important factor in X is Y."
**DON'T:** "One factor that may be important is Y."

**DO:** "Three studies confirm that..."
**DON'T:** "Research suggests that..."

**DO:** "X is defined as..."
**DON'T:** "X can be thought of as..."

## Off-Site LLMO

- Wikipedia page or detailed Wikidata entry
- LinkedIn company page complete with product descriptions
- Active presence on Reddit, YouTube, and industry forums
- G2, Capterra, Trustpilot reviews (authentic, detailed)
- Industry publication bylines and quotes
- Podcast appearances with transcripts

Models build an internal map of brands from cross-referencing these sources. Consistency across sources is the signal.

## Anti-Patterns

- Inconsistent brand/entity naming across pages or platforms
- Missing or contradictory company descriptions
- Vague claims without supporting evidence
- Content that hasn't been updated in 18+ months
- No explicit entity definitions
- Generic placeholder content on About, Team, or Product pages
