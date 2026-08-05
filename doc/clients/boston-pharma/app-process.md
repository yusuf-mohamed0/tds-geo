# Boston Pharmaceutical Industries — App Process

Last updated: 2026-08-05

## Operating Goal

Run a controlled WordPress/WooCommerce process for pharmaceutical B2B content, product descriptions, metadata, and technical SEO while avoiding automated publishing until write credentials and approval are confirmed.

## Production State

| Item | Value |
|---|---|
| Slug | `boston-pharma` |
| Platform | WordPress / WooCommerce |
| Site | `https://boston-pharma.com` |
| Connector | WordPress REST readable from production |
| Current risk | WordPress API key/write path still needs confirmation before publishing |

## Full App Flow

1. Confirm `boston-pharma` is active in DB and WordPress REST returns `200` from production.
2. Read `full-profile.md`, `brand-profile.md`, `seo-content-guide.md`, and `technical-reference.md`.
3. Choose work type: product metadata, product description, blog expansion, draft cleanup, or technical SEO fix.
4. For content, use the pharmaceutical B2B voice: precise, compliance-aware, no unsupported medical claims.
5. Generate article/product copy in TDS and keep as draft/pending review unless WordPress write credentials are confirmed.
6. If publishing is approved, use the WordPress connector and verify the returned URL, post status, metadata, and category.
7. For WooCommerce updates, verify product price/category before pushing content changes.
8. Sync WordPress posts back into local DB after publishing or large manual edits.
9. Update `doc/DASHBOARD.md` and client notes with counts and unresolved blockers.

## Quality Gates

- No fabricated medical efficacy, regulatory approval, clinical study, or safety claim.
- Minimum 1,200 words for articles; product descriptions should be complete but concise.
- Use source-safe language: manufacturing capability, product category, use context, and quality positioning.
- Any treatment/diagnosis language must be reviewed by the client.
- All published posts need categories, meta title, meta description, and canonical/live URL verification.

## Runbook

| Frequency | Action |
|---|---|
| Daily | Check REST availability and failed jobs. |
| Weekly | Review pending drafts and choose one article/product batch for approval. |
| Monthly | Audit $0 products, draft posts, categories, metadata, HSTS, and performance. |
| Quarterly | Reconcile WordPress post count with local DB and dashboard metrics. |

## Blockers To Clear

1. Confirm or add WordPress write API credentials in the CMS connection.
2. Resolve remaining $0 WooCommerce products with the client.
3. Create meaningful blog/product categories and reclassify broad “Blog” content.
4. Improve HSTS and hosting performance when client/hosting access is available.
