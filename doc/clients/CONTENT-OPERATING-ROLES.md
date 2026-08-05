# TDS Geo Content Operating Roles

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
4. Include a GEO/AEO capsule near the top of every article.
5. Include a publishing checklist at the end of every local draft.
6. Keep Shopify content hidden first: `published: false`, `published_at: null`.
7. Keep WordPress content as draft/pending review unless write credentials and approval are confirmed.
8. Rerun `npm run audit:clients` before any production publishing batch.

## Current Production Blockers

| Client | Blocker | Publishing Rule |
|---|---|---|
| `boston-vet` | Production EC2 receives HTTP 403 from WordPress REST | Draft only until WAF allows `16.192.29.174` |
| `caravanserai` | Shopify Admin token returns HTTP 401 and billing is cancelled | Draft only until OAuth and billing are corrected |
| `flaunt-cosmetics-global` | Shopify Admin token returns HTTP 401 | Draft only until OAuth is corrected |
