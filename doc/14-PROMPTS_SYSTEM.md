# Prompts System

## Overview

All AI system prompts are stored as **standalone Markdown files** in `backend/prompts/`. They are loaded at runtime and injected with variables via `{{VARIABLE}}` substitution.

## Prompt Files

| File | Purpose |
|---|---|
| `writing-system-prompt.md` | Main article writing prompt (249 lines) |
| `research-prompt.md` | Keyword research + content gap analysis |
| `maintenancePrompt.txt` | Specialized prompt for property maintenance industry |

## How Prompts Are Loaded

```
loadPrompt(filename, vars)
  → Reads .md file from backend/prompts/
  → Replaces {{VARIABLE}} patterns with values
  → Returns rendered string

writingSystemPrompt({ topic, siteName, siteDescription, ... })
  → Loads writing-system-prompt.md
  → Fills in topic, client info, date, context
  → Returns complete system prompt for OpenAI
```

## The Writing System Prompt (Key Directives)

**Voice:** Malcolm Gladwell (framing) + David Ogilvy (clarity) + Hunter S. Thompson (boldness)

**GEO (Generative Engine Optimization)** — Instructions per AI search engine:

| AI Search | Requirements |
|---|---|
| **ChatGPT** | Definition-first, short sentences, bold takeaways |
| **Perplexity** | Factual consistency, attribution, specific numbers/dates |
| **Gemini** | Structured hierarchy, Q&A headings, 4 EEAT signals |
| **Claude** | Human-sounding prose, varied sentence structure, depth layering |

**Required structure:**
- H2 with definition-first opening
- 3 depth layers: surface → detail → expert
- Key takeaway blocks
- Entity density > 3%

**10 creative techniques:**
1. Open loop hook
2. Counter-argument
3. Narrative arc
4. Unexpected analogy
5. Confession/contrarian
6. Listicle inversion
7. Timeline/progression
8. Decision tree
9. Contrarian take
10. "Yes, and" expansion

**6-round internal review** (AI checks itself before outputting):
1. Information density
2. Novelty/uniqueness
3. GEO extractability
4. Credibility/fact-check
5. Readability
6. Final quality gate (min 8/10 per dimension)

**Output format:** Valid JSON with title, metaTitle, metaDescription, categories, tags, content (HTML), slug, entities, search intent

## Variables Available in Prompts

| Variable | Source | Example |
|---|---|---|
| `{{TOPIC}}` | User input | "SEO for dentists" |
| `{{SITE_NAME}}` | Client config | "Boston Pharma" |
| `{{SITE_DESCRIPTION}}` | Website intelligence | "Pharmaceutical distributor..." |
| `{{CATEGORIES}}` | Client config | "Health, Pharma, Regulation" |
| `{{DATE}}` | Current date | "July 1, 2026" |
| `{{YEAR}}` | Current year | "2026" |
| `{{BRAND_VOICE}}` | Brand voice profile | "Professional and educational..." |
| `{{GRAPHIFY_CONTEXT}}` | Knowledge graph | Related topics from graph |

## Customization

- **Global prompt templates** stored in `prompt_templates` DB table
- Templates can be versioned (via `prompt_versions` table)
- Admin can override prompts via `/api/prompts` routes
- Brand voice is injected via `buildBrandPrompt()` — not a static file, but built at runtime from the brand profile
- New prompt files can be added without code changes — just create a `.md` file in `backend/prompts/`
