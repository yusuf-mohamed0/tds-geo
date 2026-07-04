# AI Search Optimization Master Knowledge Base

**Google SEO | AEO | GEO | LLMO | AI SEO Consulting**

**YUSUF KO STA <YKS /> — Code. Build. Ship.™**

Updated: July 2026

---

## Architecture

This document unifies five overlapping disciplines into one operational framework. Every tactic is mapped to its primary discipline, all surface types it serves, and the measurable outcome it drives.

```
                    ┌─────────────────────────────────────┐
                    │          LLMO (Brand Entity)         │
                    │  Model-level brand representation    │
                    │  Training data + entity consistency  │
                    └────────────┬────────────────────────┘
                                 │
                    ┌────────────▼────────────────────────┐
                    │     GEO (Generative Citations)       │
                    │  ChatGPT · Perplexity · Gemini ·     │
                    │  Claude · Copilot · AI Overviews     │
                    └────────────┬────────────────────────┘
                                 │
                    ┌────────────▼────────────────────────┐
                    │     AEO (Answer Extraction)          │
                    │  Featured Snippets · PAA · Voice ·  │
                    │  AI Overviews · Answer Cards         │
                    └────────────┬────────────────────────┘
                                 │
                    ┌────────────▼────────────────────────┐
                    │   SEO (Search Engine Ranking)        │
                    │  Technical · Content · Links · UX    │
                    │  Core Web Vitals · EEAT             │
                    └─────────────────────────────────────┘
```

**The stacking rule:** Each layer builds on the one below. Fix SEO first. Then layer AEO structure on top. Then engineer for GEO citability. Then invest in LLMO entity authority for long-term positioning.

**Tactical overlap:** ~70-80% across AEO, GEO, LLMO. Same structured data, entity authority, citation-ready content serves all three. The divergence is in platform scope, content depth, and measurement.

---

## Part 1: SEO — Search Engine Optimization (Foundation)

### Confirmed Google Ranking Factors (2026)

| Category | Factor | Weight | Source |
|----------|--------|--------|--------|
| Content | Helpful, reliable, people-first content | Highest | Google Search Central |
| Content | Search intent match | Critical | Google Quality Rater Guidelines |
| Content | EEAT signals (Experience, Expertise, Authority, Trust) | High | Google (indirect via quality) |
| Content | Original research, data, firsthand expertise | High | Google Helpful Content System |
| Content | Content freshness / recency | Medium | Google (Some queries) |
| Technical | Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1) | Confirmed | Google Search Central |
| Technical | Mobile-first indexing & mobile friendliness | Confirmed | Google |
| Technical | HTTPS security | Confirmed | Google |
| Technical | Crawlability & indexability | Required | Google Search Essentials |
| Technical | Structured data (schema.org) | Signal | Google (critical for AI features) |
| Links | Quality backlinks from authoritative sources | High | Google (PageRank still active) |
| Links | Internal linking structure | Medium | Google |
| User | Click-through rate (CTR) | Denied | Google (not a factor) |
| User | Bounce rate | Denied | Google (not used for ranking) |
| User | Dwell time / pogo-sticking | Inferred | Not confirmed but correlated |
| Brand | Brand searches | High | Google (confidential court docs) |
| Brand | Entity authority (knowledge graph) | High | Google |
| Site | Domain age | Minimal | Google (not meaningful alone) |
| On-page | Keyword in title | Signal | Google |
| On-page | Keyword density | Myth | Google (no magical density) |
| On-page | Meta description | Signal | Indirect (CTR influence) |

### Google's Search Essentials (Required)

1. **Technical:** Pages must be indexable, crawlable, renderable
2. **Spam:** No cloaking, sneaky redirects, doorway pages, auto-generated content
3. **Policy:** No hacked content, malware, deceptive practices

### EEAT — What Actually Matters

**EEAT is NOT a direct ranking factor.** It's a framework Google's quality raters use to evaluate content quality. However, the systems Google uses to measure content quality correlate strongly with EEAT signals.

| Signal | How to Demonstrate |
|--------|-------------------|
| **Experience** | Firsthand accounts, case studies, specific use cases, "I found that..." |
| **Expertise** | Author credentials, credentials display, education, certifications, years in field |
| **Authoritativeness** | Cited by other authoritative sites, industry recognition, awards |
| **Trustworthiness** | Accurate information, transparent about sources, clear author attribution, factual accuracy |

**Critical finding (Google official, 2024):** "Thinking E-E-A-T is a ranking factor — No, it's not."

### Google's Official Guide for Generative AI Features

Key points from Google's AI optimization guide (2026):

1. **RAG-based (Retrieval-Augmented Generation):** AI features rely on core Search ranking systems to retrieve relevant pages, then generate responses with citations
2. **Existing SEO best practices continue to work** — technical SEO, content quality, structured data
3. **Page must be indexable and eligible for snippets** to appear in AI features
4. **Crawlability is critical** — AI models use publicly accessible, crawlable content
5. **No special AEO/GEO "hacks"** — Google explicitly says to ignore "chunking" content, creating unnecessary `llms.txt` files, or pursuing inauthentic mentions
6. **Cite authoritative sources** — AI features show what's being said across the web

---

## Part 2: AEO — Answer Engine Optimization

### Definition

AEO is the discipline of structuring content so AI-powered answer engines (ChatGPT, Perplexity, Google AI Overviews, voice assistants, featured snippets) can extract, cite, and quote it directly.

### Target Surfaces

| Surface | Format | Priority (2026) |
|---------|--------|-----------------|
| Google Featured Snippet | Position 0 answer box | Medium (declining) |
| Google AI Overviews | AI-generated summary above results | High |
| People Also Ask | Expandable Q&A boxes | Medium |
| Voice assistants (Siri, Alexa, Assistant) | Spoken answers | Low |
| ChatGPT (web browsing) | Inline citations | High |
| Perplexity | Source citations | High |
| Claude (web search) | Answer cards | Medium |
| Gemini | Generated summaries | Medium |
| Bing Copilot | Synthesized answers | Medium |

### The 6 AEO Levers That Work in 2026

#### 1. 40-60 Word Answer Blocks at Section Start

Format: Question-based H2 → immediate direct answer (40-60 words) → supporting detail.

The first sentence must be liftable on its own. The next 2-3 sentences add qualifying detail. This block is the extractor's unit.

```
// Example structure
## What is Answer Engine Optimization?

Answer Engine Optimization (AEO) is the practice of structuring content so AI systems can extract, cite, and quote it as a direct answer. It targets featured snippets, AI Overviews, ChatGPT, and Perplexity. Unlike traditional SEO which optimizes for blue-link rankings, AEO optimizes for passage extraction and citation.
```

#### 2. Question-Led Headings

Phrase H2s as the user phrases the question, including the question word. "What is X" beats "X explained" because extractors match against query strings. Avoid clever phrasing.

#### 3. FAQPage + HowTo Schema

- Valid JSON-LD that mirrors visible content
- FAQPage schema: 2-3x higher AI citation likelihood than unmarked equivalents
- Pages with proper schema: 3.2x more AI Overview citations
- Critical: visible content must match schema — mismatches disqualify markup
- Google (March 2026): schema is "critical for modern search features"
- Microsoft (May 2026): confirmed schema usage for Copilot

#### 4. Entity-Clear Writing

When naming a product, person, or technical concept, link it to its canonical reference (Wikipedia, Wikidata, official domain) on first mention. Extractors use these links for disambiguation and authority scoping.

#### 5. Segmented AI Crawler Access

Configure `robots.txt` to allow AI retrieval crawlers while optionally blocking training crawlers:

```
# Allow retrieval (citations)
Allow: OAI-SearchBot
Allow: PerplexityBot
Allow: ChatGPT-User
Allow: Google-Extended

# Block training (optional)
Disallow: GPTBot
Disallow: ClaudeBot
```

#### 6. Quarterly Freshness

Refresh high-value pages quarterly. ~65% of AI bot hits target content published within the past year. Update statistics, dates, references on a fixed cadence.

### AEO vs SEO — Key Differences

| Factor | SEO | AEO |
|--------|-----|-----|
| Primary goal | Rank in search results | Appear in AI-generated answers |
| Visibility | Blue links, snippets | AI summaries, citations, answer cards |
| Main platforms | Google, Bing | AI Overviews, ChatGPT, Perplexity, Gemini |
| Content focus | Helpful pages matching intent | Direct answers, structured info, proof |
| Measurement | Rankings, traffic, clicks | Citations, mentions, AI referral traffic |

---

## Part 3: GEO — Generative Engine Optimization

### Definition

GEO is the discipline of optimizing content for retrieval and citation by generative AI search systems (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews, Microsoft Copilot). Coined by Aggarwal et al. (KDD 2024, Princeton/IIT Delhi).

### The Five GEO Surfaces (2026)

| Surface | Users/Month | Key Behavior |
|---------|-------------|--------------|
| ChatGPT | 900M+ weekly | Lifts definitions, lists, step-by-step. Cites early-section content. |
| Google AI Overviews | 2B+ monthly | 97% of citations come from top-20 organic results. RAG-based. |
| Perplexity | Growing fast | Cross-references sources for factual consistency. Prefers attributed data. |
| Gemini | Growing | Entity + relationship extraction. Values completeness. |
| Claude | Enterprise | Evaluates writing quality, sentence structure. Penalizes AI-sounding prose. |

### The 5 Core GEO Moves

#### 1. Open Site to the Right Crawlers

Not all AI bots are equal. Allow retrieval bots, optionally block training bots (see AEO lever #5 above).

#### 2. Write Answer-First Content with Sourced Citations

Format for GEO extractability:
- **Definition-first architecture:** Every H2 section begins with a clear definition
- **Standalone section value:** Each H2 must be independently valuable if extracted alone
- **3 depth layers per section:**
  - SURFACE: Clear lead sentence (what AI extracts for brief answers)
  - DETAIL: 2-3 paragraphs (what AI cites for comprehensive answers)
  - EXPERT: Edge cases, limitations (what earns AI's trust)
- **Sourced statistics:** 1 per 150-200 words → 30.6% citation lift (KDD 2024)
- **Named expert quotes:** 2+ per 1,000 words → 40.9% citation lift
- **Comparison tables:** 34% more Gemini citations

#### 3. Build Entity Authority

- Wikipedia page or consistent Wikidata entry
- LinkedIn, Crunchbase, G2/Capterra profiles
- Consistent NAP (name, address, phone) across all directories
- ChatGPT cites Wikipedia in ~47.9% of top-10 sources
- Reddit, YouTube, LinkedIn are the most-cited domains across ChatGPT, Perplexity, AI Mode

#### 4. Earn Mentions Where AI Looks

AI search engines cite Reddit, YouTube, and LinkedIn most:
- Get mentioned in Reddit threads (comparison posts, recommendations)
- Publish on YouTube (transcripts get indexed and cited)
- Contribute to industry publications and newsletters
- Earn unlinked brand mentions — these affect LLM recall more than backlinks alone

#### 5. Track Citation Share Monthly

- Pick 20 representative prompts your target audience types into ChatGPT
- Audit across ChatGPT, Perplexity, Gemini, AI Overviews monthly
- Track: Are you cited? Where in the answer? What competitors are cited instead?

### Per-Platform GEO Tactics

**ChatGPT:** Largest user base. Optimize for: definitions, lists, step-by-step, clear pro/con comparisons. ChatGPT cites from the first 30% of a page (44.2% of citations).

**Google AI Overviews:** Highest commercial overlap with organic SEO. Nearly 40% of citations come from organic top 10. Pages earning featured snippets are more likely to be cited.

**Perplexity:** Most citation-focused. Rewards content with specific numbers, dates, named sources. Avoids vague claims.

**Claude:** Evaluates writing quality itself. Rewards human-sounding prose, penalizes AI patterns. Prioritize: varied sentence structure, personal observations, genuine expertise.

### GEO KPI Tracking

| KPI | Tool | Frequency |
|-----|------|-----------|
| Citation count per prompt | Manual audit, Semrush AIO, Profound, Otterly | Monthly |
| Citation share vs competitors | Same | Monthly |
| Sentiment of AI answers | Manual review | Monthly |
| Click-through from AI answers | Google Search Console (AI Overview clicks) | Weekly |
| Brand mention rate in training data | Not directly measurable (inferred) | Quarterly |

---

## Part 4: LLMO — Large Language Model Optimization

### Definition

LLMO is the most upstream discipline. While AEO targets answer extraction and GEO targets query-time retrieval, LLMO targets the training data and knowledge that large language models internalize during training. It's about being embedded in the model's understanding, not just cited at query time.

### Scope

LLMO is the superset that contains AEO and GEO:

```
LLMO (all LLM interactions)
├── Direct LLM queries (ChatGPT, Claude, Gemini)
├── RAG-based applications
├── AI agents browsing the web
└── Search (AEO + GEO)
    ├── GEO (generative search engines)
    └── AEO (answer-focused extraction)
```

Every AEO win is a GEO win is an LLMO win — but not the other way around.

### The 6 Highest-Impact LLMO Tactics (Ranked)

| # | Tactic | Citation Lift | Source |
|---|--------|--------------|--------|
| 1 | Answer capsules (40-60 words after every H2) | Baseline | Multiple |
| 2 | Named expert quotes with credentials (2+/1K words) | +40.9% | KDD 2024 |
| 3 | Sourced statistics with attribution (1/150-200 words) | +30.6% | KDD 2024 |
| 4 | Comparison tables | +34% Gemini | Evertune |
| 5 | FAQ sections with natural language questions | High | Multiple |
| 6 | Entity consistency across all web presence | Foundational | Multiple |

### The Two Pathways to LLM Visibility

**Pathway 1: Training Data (Base Model Knowledge)**
- LLMs are trained on Common Crawl, web archives, books, academic papers
- Content on these sources shapes the model's internal knowledge
- This is the slow, foundational pathway
- Tactics: Wikipedia presence, consistent entity information across the web, authoritative external citations

**Pathway 2: Live Retrieval (RAG at Query Time)**
- When a user asks a question, the model retrieves relevant web pages via search
- This is the fast, actionable pathway
- Tactics: AEO + GEO strategies (above) cover this entirely

### LLMO-Specific Tactics Beyond AEO/GEO

#### 1. Entity Consistency

Your company, product, people, and partners must be written identically across:
- Your website (especially About, Products, Team pages)
- Wikipedia (if applicable)
- LinkedIn, Crunchbase, G2, Capterra
- Industry directories and review sites
- Press mentions and news articles
- Social media profiles

#### 2. Topical Hubs with Internal Links

Build content clusters: one pillar page per major topic → 5-12 supporting cluster pages → all internally linked with descriptive anchor text. This signals to AI systems that your site has broad, deep expertise on a topic.

#### 3. Definitive Language

Cited text is nearly twice as likely to contain definitive phrasing (36.2% vs 20.3%) than uncited text. Use clear statements, not hedging. "The most important factor is..." not "One factor that may be important is..."

#### 4. Front-Load Answers

44.2% of ChatGPT citations come from the first 30% of a page. Answer the core question immediately — within the first 100 words — then expand.

#### 5. Agentic RAG Readiness

As AI systems evolve toward agentic RAG (multiple retrieval + reasoning loops), inconsistencies across pages compound. Every page must tell a consistent story about your brand. Errors that were invisible in single-retrieval become amplified in multi-step agentic systems.

---

## Part 5: AI SEO Consulting Framework

### The MERIT Framework (Industry Standard)

Published by Searchbloom (2025, updated 2026). Five pillars:

| Pillar | Focus | Key Activities |
|--------|-------|----------------|
| **M** — Monitor | AI visibility baseline | Prompt audit across ChatGPT, Perplexity, Gemini, AI Overviews. SQL-based tracking. |
| **E** — Entity | Brand entity authority | Wikidata, Wikipedia, sameAs, consistent entity schema, knowledge graph integration |
| **R** — Retrieve | Technical crawlability | Robots.txt for AI crawlers, IndexNow + Indexing API, sitemap optimization, page speed |
| **I** — Inform | Content citability | Answer capsules, expert quotes, sourced statistics, FAQ schema, comparison tables |
| **T** — Trust | Off-site validation | Third-party mentions, review profiles, digital PR, unlinked brand mentions |

### Consulting Engagement Structure

**Phase 1: Audit & Baseline (Weeks 1-2)**
1. Map 20 critical prompts per buyer persona
2. Audit current visibility across all 5 AI surfaces
3. Technical SEO audit (crawlability, schema, Core Web Vitals)
4. Content audit (answer-extractability, entity consistency)
5. Entity audit (Knowledge Graph, Wikidata, sameAs completeness)
6. Baseline citation share report

**Phase 2: Quick Wins (Weeks 3-4)**
1. Fix robots.txt for AI crawler access
2. Implement IndexNow + Indexing API
3. Add FAQPage schema to top 10 pages
4. Rewrite top 5 pages with answer-first opening paragraphs
5. Fix entity schema (Organization, Article, Product on all pages)

**Phase 3: Content Engineering (Weeks 5-10)**
1. Create answer capsules for all H2s on 20 priority pages
2. Add sourced statistics and expert quotes to priority content
3. Build comparison tables for commercial intent queries
4. Develop topical hubs with internal linking
5. Implement quarterly freshness calendar

**Phase 4: Authority Building (Weeks 8-16)**
1. Wikidata entry creation/improvement
2. Wikipedia article (if eligible)
3. Industry publication contributions
4. Reddit mention strategy
5. Review profile optimization (G2, Capterra, Trustpilot)

**Phase 5: Measurement & Iteration (Ongoing)**
1. Monthly citation share tracking
2. Weekly AI Overview appearance monitoring
3. Quarterly content refresh
4. Bi-annual full audit

### Measurement Framework

| KPI | SEO | AEO | GEO | LLMO |
|-----|-----|-----|-----|------|
| Visibility | Keyword rankings | Snippet ownership % | Citation count | Brand mention in model answers |
| Traffic | Organic sessions | AI Overview referral clicks | ChatGPT/Perplexity referral | Not directly measurable |
| Share | Search visibility % | Answer share vs competitors | Citation share vs competitors | Entity recall rate |
| Quality | Bounce rate, time on page | Answer accuracy | Sentiment of AI citations | Brand consistency score |
| Conversion | Goal completions | Assisted conversions | AI-assisted conversions | Brand lift studies |

### Tools Landscape

| Category | Tools |
|----------|-------|
| AI Citation Tracking | Semrush AIO, Profound, Otterly, Peec, LLM Pulse |
| Traditional SEO | Semrush, Ahrefs, SE Ranking, Google Search Console |
| Schema Testing | Google Rich Results Test, Schema Markup Validator |
| Crawler Audit | Screaming Frog, Sitebulb, Botify |
| Entity Research | Wikidata Query Service, Google Knowledge Graph API |
| Content Optimization | SurferSEO, Frase.io, Clearscope, MarketMuse |

### Common Pitfalls

| Pitfall | Why It Fails |
|---------|-------------|
| Treating AEO/GEO/LLMO as separate projects | 70-80% tactical overlap. One unified strategy costs less and works better. |
| Chasing "GEO hacks" (llms.txt, content chunking) | Google explicitly says these are unnecessary. Focus on fundamentals. |
| Ignoring organic rankings for AI visibility | 97% of AI Overview citations come from organic top 20. |
| Over-implementing schema | Invalid schema is worse than no schema. Content-schema mismatch disqualifies markup. |
| Not measuring | If you can't track citation share, you can't optimize it. |
| Keyword thinking instead of prompt thinking | Users now ask full questions. Target prompts, not short-tail keywords. |

---

## Part 6: Implementation Checklists

### ✅ SEO Foundation Checklist

- [ ] Site is indexable (Search Console, robots.txt, sitemap.xml)
- [ ] HTTPS configured and enforced
- [ ] Mobile-friendly (Google Mobile-Friendly Test)
- [ ] Core Web Vitals pass (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] No duplicate content issues
- [ ] Clear heading hierarchy (H1 → H2 → H3)
- [ ] Internal linking structure
- [ ] Quality backlink profile
- [ ] Content matches search intent
- [ ] Author bylines and credentials displayed

### ✅ AEO Checklist

- [ ] Question-based H2 headings (starting with who/what/why/how/where)
- [ ] 40-60 word direct answer block under each H2
- [ ] First sentence of each H2 is independently liftable
- [ ] FAQPage schema on pages with Q&A content
- [ ] HowTo schema on instructional pages
- [ ] Entity linking via sameAs on Organization schema
- [ ] Robots.txt allows AI retrieval crawlers (OAI-SearchBot, PerplexityBot, Google-Extended)
- [ ] Content matches schema (no mismatches)

### ✅ GEO Checklist

- [ ] Definition-first architecture for all H2 sections
- [ ] Sourced statistics (1 per 150-200 words)
- [ ] Named expert quotes with credentials (2+ per 1,000 words)
- [ ] Comparison tables on commercial/comparison content
- [ ] Standalone section value (each H2 is independently useful)
- [ ] Depth layering (surface → detail → expert)
- [ ] Consistent entity naming throughout
- [ ] Off-site mentions on Reddit, YouTube, LinkedIn
- [ ] Quarterly freshness calendar
- [ ] 20-prompt citation tracking dashboard

### ✅ LLMO Checklist

- [ ] Entity consistency: brand name, products, people written identically everywhere
- [ ] Wikipedia/wikidata presence (or plan to create)
- [ ] Company profiles on LinkedIn, Crunchbase, G2, Capterra
- [ ] Topical hubs built (pillar + 5-12 cluster pages)
- [ ] Internal links with descriptive anchor text
- [ ] Definitive language used (not hedging)
- [ ] Answers front-loaded (within first 100 words)
- [ ] Content refreshed within last 12 months
- [ ] Answer capsules on every H2
- [ ] Off-site brand mentions across authoritative third-party sites

### ✅ Ongoing Measurement Checklist

- [ ] Monthly: run 20 prompts across ChatGPT, Perplexity, Gemini, AI Overviews
- [ ] Track: are you cited? where? what competitors are cited instead?
- [ ] Track: sentiment of AI answers about your brand
- [ ] Weekly: Search Console for AI Overview click data
- [ ] Quarterly: full content freshness pass
- [ ] Quarterly: schema audit
- [ ] Bi-annual: entity audit (Wikidata, sameAs, Knowledge Graph)

---

## Quick Reference: Discipline Comparison

| Dimension | SEO | AEO | GEO | LLMO |
|-----------|-----|-----|-----|------|
| **Born** | 1997 | 2018 | 2023 | 2024 |
| **Target** | Search rankings | Direct answers | Generative citations | Model-level understanding |
| **Surfaces** | Google, Bing | AI Overviews, snippets, voice | ChatGPT, Perplexity, Gemini, Claude | All LLM interactions |
| **Primary signal** | Links, content, technical | Extractability, schema | Citations, statistics, entities | Entity consistency, authority breadth |
| **Content depth** | 1,000-2,000 words | 40-60 word answer blocks | 1,500-3,000+ words | Encyclopedia-level depth |
| **Key format** | Blog posts, guides | Q&A, definitions, lists | Long-form with data and quotes | Pillar pages, topical clusters |
| **Measurement** | Rankings, traffic | Snippet ownership | Citation share | Brand mention rate |
| **Academic backing** | Decades of research | Limited | Princeton KDD 2024 | Emerging |

---

## Sources

- Google Search Central: SEO Starter Guide, AI Optimization Guide, Core Web Vitals
- Aggarwal et al. (KDD 2024): "Generative Engine Optimization" — Princeton/IIT Delhi
- Searchbloom MERIT Framework (2025/2026)
- Google Quality Rater Guidelines (EEAT)
- HubSpot: Google Ranking Factors 2026
- Nuwtonic: Confirmed/Denied Ranking Factors 2026
- Backlinko: Generative Engine Optimization (2026)
- CXL: Answer Engine Optimization Guide (2026)
- LLM Pulse: GEO Complete Guide (2026)
- SERPBAYS: GEO 2026 Guide
- SEO Grade: Generative Engine Optimization (2026)
- Search Engine Land: What Is LLMO (2025)
- Contently: What Is LLMO (2026 Playbook)
- LLMO Framework: LLMO vs SEO vs AEO vs GEO
- AI Search Insider: SEO vs AEO vs GEO vs LLMO
- Neil Patel: AEO vs GEO vs LLMO
- XHack: 3-Layer Integration Framework
- Google/Microsoft: Official schema confirmation for AI features (March/May 2026)
- Airticler: AI Search Visibility Guide for Consultants (2026)
- Gigawatt Group: AI SEO for Consulting Firms (2026)
