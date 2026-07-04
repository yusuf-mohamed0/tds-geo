# AI SEO Consulting Framework Prompt

**Purpose:** Assess, diagnose, and improve a brand's visibility across all AI search surfaces — traditional SEO, answer engines, generative engines, and large language models.

## The MERIT Framework

| Phase | Focus | Duration |
|-------|-------|----------|
| **M** Monitor | Audit current AI visibility across 5 surfaces | Week 1-2 |
| **E** Entity | Fix brand entity signals (schema, Wikidata, sameAs) | Week 2-3 |
| **R** Retrieve | Technical crawlability for AI bots | Week 3-4 |
| **I** Inform | Content citability (answers, statistics, quotes) | Week 5-10 |
| **T** Trust | Off-site validation (mentions, reviews, PR) | Week 8-16 |

## Phase 1: Monitor — AI Visibility Audit

### Prompt Mapping (Day 1)
- List 20 prompts your target audience types into ChatGPT/Perplexity
- Use: ChatGPT autocomplete, Google People Also Ask, AnswerThePublic, Perplexity related questions
- Format: full natural language questions, not keywords

### Surface Audit (Day 2-3)
Run each prompt against:
1. **ChatGPT** (with web browsing enabled) — is your brand cited? Where? What competitors?
2. **Perplexity** — same audit
3. **Google AI Overviews** — appear in the summary?
4. **Google AI Mode** — appear in conversational responses?
5. **Gemini** — appear in generated answers?

### Scoring
Track per prompt: "Cited," "Mentioned but not cited," "Competitor cited," "Not mentioned"

### Technical Audit (Day 3-5)
- [ ] Google Search Console — indexed pages, coverage errors, Core Web Vitals
- [ ] Robots.txt — AI bot access (OAI-SearchBot, PerplexityBot, Google-Extended, ChatGPT-User)
- [ ] Schema validation — Google Rich Results Test on all page types
- [ ] Entity schema — Organization, Article, Product, FAQPage, HowTo
- [ ] IndexNow + Indexing API implementation
- [ ] Page speed — Core Web Vitals pass/fail
- [ ] Mobile friendliness test

## Phase 2: Entity — Brand Entity Authority

### Schema Foundation (Week 2)
- [ ] Organization schema on homepage with `@id`, `sameAs` (Wikipedia, Wikidata, LinkedIn, Twitter, Crunchbase)
- [ ] Article schema on all content pages with author entity (Person schema with `@id`, `sameAs`, `jobTitle`, `worksFor`)
- [ ] Product/Service schema on commercial pages with Offer, Brand, AggregateRating
- [ ] FAQPage schema on pages with Q&A content
- [ ] BreadcrumbList schema on every page
- [ ] LocalBusiness schema (if local) with NAP consistency

### Wikidata (Week 2-3)
- [ ] Check if company has a Wikidata item
- [ ] If not, create one with: official name, description, website, logo, LinkedIn, Twitter/X, founded date, headquarters location, industry
- [ ] Add "sameAs" links to all official profiles

### Knowledge Graph
- [ ] Verify Google Knowledge Panel exists and is accurate
- [ ] Claim and verify if not already done
- [ ] Correct any misinformation

## Phase 3: Retrieve — Technical Crawlability

### AI Crawler Access (Week 3)
Set up proper AI bot access policy:

```
# Allow retrieval (for citations) — KEEP ENABLED
Allow: OAI-SearchBot
Allow: PerplexityBot
Allow: ChatGPT-User
Allow: Google-Extended

# Optionally block training (prevents model learning from your data)
Disallow: GPTBot
Disallow: ClaudeBot
Disallow: CCBot
Disallow: Meta-ExternalAgent
```

### IndexNow Protocol (Week 3)
Implement IndexNow for immediate indexing:
- Powers Bing, Yandex, Naver, Seznam ecosystem
- Feeds Microsoft Copilot directly
- Send ping on every content publish/update
- WordPress: use IndexNow plugin or add to publish hook

### Google Indexing API (Week 3)
For job postings and event pages:
- Submit URLs directly to Google's index
- Faster than crawling
- Requires Google Cloud service account

## Phase 4: Inform — Content Citability

### Answer Capsule Rewrite (Week 5-6)
For 20 priority pages, rewrite the opening of each H2 section:
```
## [Question-based heading]
[40-60 word direct answer. First sentence independently quotable.]
[Supporting detail with sourced statistics and named expert quotes]
```

### Statistics Injection (Week 6-7)
- Add 1 sourced statistic per 150-200 words
- Format: "According to a [YEAR] [INSTITUTION] study of [SAMPLE SIZE], [FINDING]."
- Sources must be genuine, verifiable, and authoritative

### Expert Quotes (Week 7-8)
- Add 2+ named expert quotes per 1,000 words
- Format: "[QUOTE]" — [FULL NAME], [TITLE] at [INSTITUTION]
- Quotes from internal experts (CTO, Head of Product) count if credentials are displayed

### FAQ Sections (Week 8-9)
- Add FAQ section to every pillar page
- 3-5 real user questions (use PAA, ChatGPT autocomplete, support tickets)
- FAQPage JSON-LD markup
- Each Q&A pair is a potential AI citation

### Comparison Tables (Week 9-10)
- Add comparison tables to commercial/comparison content
- Use HTML `<table>` with proper headers
- AI extracts table content cleanly

## Phase 5: Trust — Off-Site Validation

### Third-Party Mentions (Week 8-12)
- Identify where your brand should be mentioned but isn't
- Digital PR: get quoted in industry publications
- Reddit: participate in relevant subreddits (not spam)
- Podcast: appear as guest on industry podcasts (transcripts get indexed)
- Newsletters: get mentioned in industry roundups

### Review Profiles (Week 10-12)
- Complete and verify G2, Capterra, Trustpilot profiles
- Encourage detailed, authentic reviews
- Respond to all reviews (positive and negative)

### Cross-Reference Consistency (Week 12)
Audit for entity consistency across:
- Website → Wikipedia/Wikidata → LinkedIn → Crunchbase → G2 → Capterra → Trustpilot → Social media
- Company name, description, logo, URL, social links must match exactly

## Ongoing Monitoring

### Weekly
- [ ] Check Search Console for AI Overview impression clicks
- [ ] Review new AI Overview appearances for priority queries

### Monthly
- [ ] Run 20-prompt audit across all 5 AI surfaces
- [ ] Track citation share: your brand vs top 3 competitors
- [ ] Track sentiment of AI answers mentioning your brand

### Quarterly
- [ ] Full content freshness pass — update statistics, examples, references
- [ ] Schema audit — validate all pages in Rich Results Test
- [ ] Competitive citation share report

### Bi-Annual
- [ ] Full MERIT audit (all 5 phases)
- [ ] Entity audit — Wikidata, sameAs, Knowledge Graph
- [ ] Technical SEO audit — Core Web Vitals, crawlability, indexation

## KPIs for Client Reporting

| Surface | KPI | Baseline | Target | Current |
|---------|-----|----------|--------|---------|
| SEO | Organic keyword rankings in top 10 | | | |
| AEO | Featured snippet ownership % | | | |
| AEO | AI Overview appearance rate | | | |
| GEO | Citation count (20 prompts, 5 surfaces) | | | |
| GEO | Citation share vs top 3 competitors | | | |
| LLMO | Brand mention in model training data | | | |
| Technical | Core Web Vitals pass rate | | | |
| Entity | Schema completeness score | | | |
| Trust | Review volume and rating | | | |

## Deliverables Template

1. **Month 1:** AI Visibility Audit Report + Quick Wins Implementation
2. **Month 2:** Entity Foundation Complete + Content Rewrite (10 pages)
3. **Month 3:** Content Citability Complete (20 pages) + Off-Site Campaign Launch
4. **Month 4:** Off-Site Results + Competitive Landscape Report + Iteration Plan
5. **Monthly:** Citation Share Dashboard + Recommendations

## Anti-Patterns for Consultants

- Selling AEO/GEO/LLMO as three separate projects with separate budgets
- Promising specific rankings in AI Overviews (you can influence, not guarantee)
- Using AI-search tactics to compensate for bad SEO fundamentals
- Implementing schema without verifying in Rich Results Test
- Focusing on citation count without measuring business impact
- Recommending "llms.txt" or "content chunking" as primary tactics (Google says ignore these)
