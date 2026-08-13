# Kivo Geo Content Operating Roles

Last updated: 2026-08-05

Every client article uses this shared role stack plus the client's own `writer-role.md` and `seo-content-guide.md`.

## Role Stack

| Role | Responsibility | Output Gate |
|---|---|---|
| Senior SEO Strategist | Search intent, topical coverage, internal linking, metadata | Clear primary intent and SEO title/meta description |
| Editorial Director | Structure, voice, paragraph value, no filler | Reads like a human expert, not generic AI content |
| Content Researcher | Brand facts, product context, source-safe claims | No fabricated statistics, studies, awards, quotes, or credentials |
| EEAT Consultant | Experience, expertise, authority, trust signals | Every major section has practical or expert value |
| GEO/AEO Specialist | Answer capsules, quotable passages, entity clarity, FAQ/schema opportunities | AI-search-ready sections and concise direct answers |
| Compliance Reviewer | Industry-specific risk review | No medical, veterinary, legal, or product claims beyond available evidence |
| CMS Publisher | Platform formatting, hidden draft state, metadata, scheduling | Draft is safe for Shopify/WordPress staging only |
| QA Operator | Final pass, links, status, blockers, audit logging | Documented status and next action |

## Universal Draft Rules

1. Save local articles in `doc/clients/{slug}/articles/` with frontmatter.
2. Use `status: local_draft` until a connector is verified and approval is explicit.
3. Do not schedule or publish if the client has a known connector, billing, or WAF blocker.
4. Include a GEO/AEO capsule near the top of every local draft.
5. Include a publishing checklist at the end of every local draft.
6. Before CMS upload, convert the local draft into a public article body: remove internal role labels, meta-draft blocks, FAQ-opportunity notes, connector/token notes, and publishing checklists.
7. Public CMS bodies must visibly reflect the client's own `brand-profile.md`, `writer-role.md`, `seo-content-guide.md`, and `geo-aeo-plan.md`; generic articles are not uploadable.
8. Keep Shopify content hidden first: `published: false`, `published_at: null`.
9. Keep WordPress content as draft/pending review unless write credentials and approval are confirmed.
10. Rerun `npm run audit:clients` before any production publishing batch.

## Public CMS Body Gate

The local markdown file may contain internal planning sections for QA, but the content sent to Shopify or WordPress must not contain internal operations language. The CMS payload must contain only customer-facing article content, SEO metadata, excerpt/summary, approved tags, and platform-safe formatting.

Forbidden in CMS bodies:
- `GEO/AEO Answer Capsule`
- `Meta Draft`
- `FAQ Opportunities`
- `Publishing Checklist`
- connector/token repair notes
- role-stack labels such as `Senior SEO Strategist`, `CMS Publisher`, or `QA Operator`

## Current Production Blockers

| Client | Blocker | Publishing Rule |
|---|---|---|
| `boston-vet` | Removed from active clients | Do not generate, schedule, or publish |
