# AEO — Answer Engine Optimization Prompt

**Purpose:** Structure content so AI answer engines (AI Overviews, ChatGPT, Perplexity, Gemini, featured snippets, voice assistants) can extract, cite, and quote it as a direct answer.

## Required Structure per Section

```
## [Question-based H2 heading]

[40-60 word direct answer. First sentence must be independently liftable.
Next 2-3 sentences add qualifying detail. This block is what AI extracts.]

[Supporting paragraphs — context, examples, nuance for human readers]

**Key takeaway:** [One-line summary — becomes AI snippet.]
```

## Rules

1. **Question-led headings** — Every H2 starts with who/what/why/how/where/when. "What is X" not "X explained".
2. **40-60 word answer blocks** — Immediate, direct answer under every H2. First sentence is the quote.
3. **Declarative language** — State facts clearly. No hedging, no "might", "could", "perhaps".
4. **Entity-clear** — Link every named entity (product, person, concept) to its canonical reference on first mention.
5. **FAQPage-ready** — Include 3-5 natural-language Q&A pairs. Real questions users ask, not keyword-stuffed.
6. **Standalone sections** — Each H2 section is independently valuable if extracted alone.
7. **No clever phrasing** — Extractors match against query strings. Be direct, not creative.

## Anti-Patterns

- Burying the answer under preamble
- Clever or brand-name headings that don't match real queries
- Generic paragraphs that any competitor could have written
- Missing entity links on first mention

## Surface-Specific Requirements

**AI Overviews:** 97% of citations come from organic top 20. Must rank to be cited. FAQPage schema gives 2-3x lift.

**ChatGPT:** 44.2% of citations from first 30% of page. Front-load the answer.

**Perplexity:** Cross-references sources. Attribute every statistic to a named source with date.

**Gemini:** Structured hierarchy, complete coverage, consistent entity naming.

**Claude:** Human-sounding prose. Varied sentence structure. Penalizes AI-sounding patterns.

**Featured snippets:** 40-60 word paragraphs, numbered lists, short tables. Query-in-heading + immediate answer.

## Output Format

```
# Title (question-optimized, under 60 chars)

Opening: One paragraph answering the primary question immediately.

## What is [Topic]?
[40-60 word answer]
[Supporting detail]

## Why is [Topic] Important?
[40-60 word answer]
[Supporting detail]

## How to [Do Something Related]
[40-60 word answer]
[Step-by-step if applicable]

## [Question]?
[40-60 word answer]

## Frequently Asked Questions
### [Real user question]?
[Concise answer]
### [Real user question]?
[Concise answer]
```
