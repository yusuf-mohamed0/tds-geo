# Caravanserai — App Process

Last updated: 2026-08-05

## Operating Goal

Run a Shopify content and brand-growth process for Egyptian craftsmanship, home decor, brass, furniture, and gifts while preserving the warm heritage brand voice and publishing through hidden drafts plus TDS scheduling.

## Production State

| Item | Value |
|---|---|
| Slug | `caravanserai` |
| Platform | Shopify |
| Shop | `caravanserai-gift-store.myshopify.com` |
| Domain | `https://caravanserai-design.com` |
| Blog | News, ID `78074216615` |
| Connector | Shopify storefront public blog returns `200`; Admin API token returns `401` from production |
| Current risk | Client is active while `billing_status = cancelled`; OAuth/token must be repaired before live publishing |

## Full App Flow

1. Confirm `caravanserai` is active in DB.
2. Repair Shopify OAuth/token until Admin API returns `200` for `shop.json`.
3. Resolve billing-state mismatch before scaling automated publishing.
4. Read `full-profile.md`, `brand-profile.md`, `seo-content-guide.md`, `technical-reference.md`, and `audit.md`.
5. Select a content theme: Egyptian craftsmanship, home decor, brass, furniture, artisan gifts, stores/showrooms, or design inspiration.
6. Generate EEAT article with heritage-aware, sophisticated, warm language and real store/product context.
7. Create Shopify hidden draft only with SEO fields and summary after token repair.
8. Schedule through TDS for Thursday 1:00 PM Cairo time.
9. After publish, verify public News URL, metadata, images/alt text, and internal links to product/category pages.
10. Update dashboard, weak-points notes, and product/content coverage counts.

## Quality Gates

- Minimum 1,200 words for articles.
- Must not sound generic or mass-market; preserve artisanal Egyptian design positioning.
- Must include SEO title, meta description, summary, and safe hidden-draft state before scheduling.
- Avoid manual publish outside TDS schedule.
- Do not scale automation until Shopify token and billing status are corrected or explicitly accepted.

## Runbook

| Frequency | Action |
|---|---|
| Daily | Check app health and Shopify connector failures. |
| Weekly | Approve/schedule one draft and verify prior publish. |
| Monthly | Audit broken nav links, typos, alt text, Instagram link, metadata, and product descriptions. |
| Quarterly | Review product-line coverage and showroom/location accuracy. |

## Blockers To Clear

1. Repair Shopify OAuth/token; production currently receives `401` from Admin API.
2. Fix `billing_status = cancelled` while active.
3. Confirm formal approval contact beyond WhatsApp-only workflow.
4. Continue monthly site fixes from `audit.md`.
5. Create the next article batch before the current seven-draft queue is exhausted.
