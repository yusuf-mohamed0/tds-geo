# Alamein Outdoor Furniture — App Process

Last updated: 2026-08-05

## Operating Goal

Run a weekly Shopify content pipeline that expands Alamein beyond outdoor furniture into playgrounds, outdoor fitness, game tables, commercial furniture, and street furniture while keeping all Shopify articles hidden until TDS-approved scheduling publishes them.

## Production State

| Item | Value |
|---|---|
| Slug | `alamein-2022` |
| Platform | Shopify |
| Shop | `alamein-2022.myshopify.com` |
| Blog | Posts, ID `79774056505` |
| Connector | Active Shopify token verified by production audit |
| Current risk | Public custom-domain blog quality needs manual review; no client contact documented |

## Full App Flow

1. Confirm `alamein-2022` is active in DB and Shopify Admin API responds.
2. Read `full-profile.md`, `brand-profile.md`, `seo-content-guide.md`, and `technical-reference.md`.
3. Select one uncovered or under-covered business line: playgrounds, outdoor fitness, game tables, commercial/street furniture, or outdoor furniture buying guidance.
4. Generate a complete EEAT article with original structure, Cairo/Egypt relevance, and no fabricated claims.
5. Create or update Shopify article as hidden draft only: `published: false`, `published_at: null`.
6. Set Shopify SEO fields: title max 70 chars, description max 160 chars, `summary_html` excerpt.
7. Schedule through TDS for Thursday 1:00 PM Cairo time.
8. On publish day, verify the Shopify URL returns `200`, metadata is present, and the article is visible in the target blog.
9. Record the result in the dashboard and client notes.

## Quality Gates

- Minimum 1,200 words unless a specific brief says otherwise.
- Quality score target: 65+.
- Must cover a real Alamein product/service line.
- Must not manually publish in Shopify outside the TDS scheduler.
- Must include internal links to relevant product/category pages when available.

## Runbook

| Frequency | Action |
|---|---|
| Daily | Check app health and failed publish jobs. |
| Weekly | Generate or approve one scheduled article for Thursday 1 PM Cairo. |
| Monthly | Audit blog coverage across all Alamein business lines. |
| Quarterly | Re-check Shopify token, blog ID, and storefront article listing quality. |

## Blockers To Clear

1. Add a named client contact to `contacts.md`.
2. Review the public blog listing because previous checks showed the page returns `200` but may show mostly contact/footer content.
3. Confirm future content queue after the initial four gap-closing drafts are exhausted.
