# LinkedIn Drafts — July 2026

---

## Post 1: Prompt Engineering Overhaul (Behind-the-Scenes Build)

**Hook:** I spent 3 weeks researching 30+ prompt engineering papers and 8 books. Then I rewrote our entire AI prompt from scratch.

**Body:**

Our AI SEO engine generates articles that must rank on Google AND get cited by ChatGPT, Perplexity, and Gemini.

One prompt serves three masters. And it was failing.

So I went deep.

I reviewed DSPy (automatic prompt optimization), GEPA (reflection loops that learn from article quality scores), MetaGlyph (automatic prompt generation), and the Princeton study on what makes content cited by AI search engines.

Three findings that changed everything:

1. XML tags beat markdown.
Claude gets 20-40% more accurate when sections are wrapped in XML instead of markdown headings. We converted our entire system prompt to an 11-block XML skeleton — role, voice, context, AEO rules, writing craft, EEAT, examples, retrieval budget.

2. Two-pass generation beats one-shot.
The first call plans (creative DNA + outline + sourced claims). The second writes. Separating strategy from execution doubled consistency.

3. Few-shot examples are non-negotiable.
Zero examples = the model invents its own structure every time. Two concrete examples with thinking + output locked the format.

We also added a retrieval budget — explicit instructions to never fabricate statistics, mark unverifiable claims, and omit rather than invent.

The old prompt was 249 lines of markdown. The new one is 12 structured blocks with XML tags, 2 examples, and anti-hallucination guards.

**Takeaway:** A better prompt isn't about more words. It's about better structure. The format of your instruction is as important as the content.

**Question:** What's the biggest prompt upgrade you've made that actually moved the needle?

---

## Post 2: The AI SEO Landscape (Original Data / Contrarian Take)

**Hook:** I mapped every AI SEO tool on the market. Here's what nobody is talking about.

**Body:**

There are 7 major platforms competing in AI search optimization right now.

Sight AI. Writesonic. BlogSEO. Profound. StoreRank. Genseo. And what we're building.

I spent a week analyzing every one — feature sets, pricing, integrations, gaps.

The surprise?

Every single platform costs $97–$1,597/month. None are open source. None support dual-CMS (Shopify + WooCommerce). None do multi-tenant.

The market is pricing out small and medium businesses.

So we went the other direction.

Built everything open source. Dual-AI support (OpenAI + Ollama local LLMs). Dual-CMS publishing. Multi-tenant architecture. Cost tracking per client to the penny.

The feature that buyers actually ask about most? Schema injection — adding JSON-LD structured data to articles at publish time for AI search engines to index.

Every platform offers this. But only one (ours) also pings IndexNow and Bing simultaneously after every publish so search engines crawl immediately.

**Numbers that matter:**
- 7 platforms analyzed
- $0 cost vs $97–$1,597/mo for comparable features
- Schema injection + IndexNow ping + freshness calendar in one system

**The insight:** The AI SEO space is consolidating around expensive SaaS. The opportunity is in open, modular, cost-transparent systems.

**Question:** What's the most overpriced tool in your stack right now?

---

## Post 3: The 878-product problem (Building in Public)

**Hook:** A client had 878 WooCommerce products. 128 had descriptions. 750 were empty.

**Body:**

That's not a content problem. That's a systems problem.

No human writer can fill 750 product pages profitably. And AI one-shot generation is too inconsistent.

So we built a pipeline that:

1. Crawls competitors for differentiation (up to 10 URLs per keyword)
2. Runs DataForSEO keyword research for volume, CPC, related terms
3. Generates a strategic outline with creative DNA and sourced claims
4. Writes the full article with schema injection
5. Publishes to Shopify or WooCommerce automatically
6. Pings IndexNow + Bing so search engines crawl immediately

Each step is a circuit-breaker-wrapped microservice that can fail independently. If DataForSEO is down, we skip keyword research. If the outline phase times out, we fall back to one-shot generation.

The system runs on a single $6/mo VPS.

**The result:** 750 product descriptions that didn't exist now get crawled, indexed, and cited.

**The principle:** If you're doing something repeatedly, automate it. If you're automating something important, make it resilient. If you're making it resilient, track every cost.

**Question:** What's the most repetitive task in your business that you haven't automated yet?

---

## Post 4: The Prompt Research Nobody Asked For (Contrarian Take / Framework)

**Hook:** I read 8 books and 30 papers on prompt engineering so you don't have to. Here's what's actually useful.

**Body:**

Most prompt engineering advice is surface-level. "Be specific. Use examples. Chain of thought."

I wanted to know what the actual research says.

Books that delivered:
- "Prompt Engineering in Practice" — the most practical guide to system prompt design
- "The Prompt Pattern Catalog" — 20 reusable patterns for different tasks
- "Building Effective Agents" — Anthropic's guide to combining prompts into pipelines

Papers that changed how I think:
- DSPy (2024) — automatically optimizes prompts using your own quality metrics
- SIPDO (2025) — incremental prompt evolution using LLM self-critique
- Princeton AEO study (2025) — what makes content citable by AI search engines
- MetaGlyph (2024) — automatic prompt generation from task descriptions

**The three things I actually use:**

1. **XML tags** — Wrapping each prompt section in `<tags>` improves Claude accuracy 20-40%. The model literally pays more attention to tagged content.

2. **Two-pass design** — Plan first, execute second. Give the model a chance to think structurally before writing.

3. **Retrieval budget** — Explicitly tell the model what to do when it doesn't know: "If uncertain, mark as [citation needed]. Never fabricate." Cuts hallucinations to near zero.

**What I stopped doing:**
- Chain-of-thought for structured generation (hurts consistency)
- Over-specifying word counts (leads to padding)
- Generic "you are an expert" (too vague to help)

**If you read one thing:** The Princeton AEO optimization study. It's the only paper I found that actually measures what makes content rank in AI search.

**Question:** What's the most underrated prompt technique you've discovered?
