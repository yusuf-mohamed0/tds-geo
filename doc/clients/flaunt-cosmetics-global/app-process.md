# Flaunt Cosmetics Global — App Process

Last updated: 2026-08-05

## Operating Goal

Run a safe Shopify beauty-content process focused on education, trust, UAE/Egypt climate relevance, and eye-shape tutorials while respecting single-SKU/out-of-stock constraints.

## Production State

| Item | Value |
|---|---|
| Slug | `flaunt-cosmetics-global` |
| Platform | Shopify |
| Shop | `c9d9a9.myshopify.com` |
| Domain | `https://flauntcosmetics.com` |
| Target blog | Beauty Tips, ID `116005503268` |
| Connector | Active Shopify token verified by production audit |
| Current risk | Single SKU is out of stock; content should avoid hard conversion claims |

## Full App Flow

1. Confirm `flaunt-cosmetics-global` is active in DB and Shopify Admin API responds.
2. Read `full-profile.md`, `brand-profile.md`, `seo-content-guide.md`, and `technical-reference.md`.
3. Select a content theme: eyeliner stamp education, eye-shape guide, UAE heat/humidity, beginner makeup, office/event looks, or makeup prep/removal.
4. Generate original beauty content with practical tutorial value and no generic AI filler.
5. Keep new TDS content in Beauty Tips, not the general News archive, unless explicitly approved.
6. Create Shopify hidden draft only with SEO fields and summary.
7. Require manual approval before any hidden draft becomes visible.
8. Schedule approved content for Thursday 1:00 PM Cairo time.
9. Verify live URL, metadata, product CTA state, and whether out-of-stock messaging is appropriate.

## Quality Gates

- Minimum 1,200 words for articles unless creating a focused tutorial brief.
- No unsupported product performance claims.
- No pressure-buy CTAs while the SKU is out of stock; use education, waitlist, or brand-trust CTAs.
- Keep all TDS drafts hidden until manual approval.
- Avoid duplicating existing Beauty Tips drafts; audit drafts before publishing.

## Runbook

| Frequency | Action |
|---|---|
| Daily | Check Shopify connector and failed publish jobs. |
| Weekly | Review one Beauty Tips draft for approval/scheduling. |
| Monthly | Audit Beauty Tips drafts for duplication, noindex needs, and content gaps. |
| Quarterly | Review stock status, CTA strategy, UAE/Egypt positioning, and UGC opportunities. |

## Blockers To Clear

1. Confirm stock/restock plan for No Hassle Eyeliner Stamp Set.
2. Establish named approval contact beyond `wecare@flauntcosmetics.com`.
3. Audit existing Beauty Tips drafts before publishing new batches.
4. Build “Eyeliner Stamp 101” and regional climate series as next content cluster.
