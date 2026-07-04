# GEO — Generative Engine Optimization Prompt

**Purpose:** Optimize content so generative AI systems (ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews, Copilot) cite, quote, and recommend it in synthesized answers.

## Required Architecture

### 3 Depth Layers per Section

```
## [H2 heading — comprehensive, keyword-rich]

**SURFACE LAYER (lead sentence):** A clear, definitive statement that works as a standalone quote.
This is what AI extracts for brief answers. Must be independently valuable.

**DETAIL LAYER (2-3 paragraphs):** Full explanation with sourced statistics, named examples,
expert quotes. This is what AI cites for comprehensive answers.

**EXPERT LAYER (1-2 paragraphs):** Edge cases, limitations, nuance, advanced scenarios.
This is what earns AI's trust as an authoritative source.
```

### Content Density Requirements

Per 1,000 words, include:
- **2+ named expert quotes** with credentials (name, title, institution) → +40.9% citation lift
- **5+ sourced statistics** with named source and date → +30.6% citation lift
- **1+ comparison table** → +34% Gemini citations
- **3+ independently quotable sentences** starting with definitive language

## Rules

1. **Definition-first** — Every H2 section starts with a clear definition before anything else.
2. **Standalone value** — Each H2 section is independently valuable if extracted alone.
3. **Sourced statistics** — Every number has a named source. "A 2025 Stanford study of 10,000 users found..." not "Studies show..."
4. **Named expert quotes** — Full name, credentials, institution. "Dr. Jane Smith, professor of computational linguistics at MIT, states..."
5. **Comparison tables** — Use `<table>` for comparative analyses. AI extracts structured data from tables cleanly.
6. **Consistent terminology** — Pick one term per concept. Use it everywhere. Never switch between "customer acquisition cost" and "CAC".
7. **Depth before breadth** — Cover fewer topics more deeply rather than many topics shallowly.

## Per-Platform Tactics

**ChatGPT (900M+ weekly users):** Lifts definitions, lists, step-by-step. 44.2% of citations from first 30% of page. Write: "X is defined as..." at section starts. Use "First, Second, Third" for processes.

**Google AI Overviews (2B+ monthly):** 40% of citations from organic top 10. Pages with featured snippets are more likely to be cited. FAQPage schema drives highest citation rate. Schema.org is "critical" per Google.

**Perplexity:** Cross-references for factual consistency. Be explicit about facts. Specific numbers, dates, names. Avoid vague claims.

**Claude:** Evaluates writing quality. Rewards human-sounding prose, varied sentence structure, personal observations, genuine expertise signals.

**Gemini:** Prefers structured, well-organized content with clear hierarchy. Values entity extraction and relationship mapping. Complete coverage beats clever writing.

## Quotable Sentence Templates

- "The single most important factor in [topic] is..."
- "What most guides miss is..."
- "Here's what the data actually shows..."
- "[Number]% of [group] report that..."
- "According to [authoritative source]..."
- "The key distinction between X and Y is..."
- "After [number] years of [experience], the most important lesson is..."

## Citation-Ready Formatting

```
## [H2: Topic Definition]
[Lead sentence — definitive, quotable]
[Detail with sourced statistic: "A [year] [institution] study of [n] participants found..."]
[Expert insight: named quote or edge case]
**Key takeaway:** [One-line summary]
```

## Anti-Patterns

- Vague claims without sources ("studies show", "experts agree", "research indicates")
- AI-sounding sentence patterns (parallel lists, uniform sentence length)
- Missing dates on statistics
- Generic content any competitor could have written
- No comparison formats for commercial queries
