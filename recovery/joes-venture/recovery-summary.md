# Joe's Venture Product Recovery Summary

## Result

Product-level data was not recoverable from internal stored data, but archived public Wayback snapshots recovered most of the historical Shopify catalog.

## Recovery Counts

- Internal historical catalog count: 152 products and 24 collections.
- Archived product URLs checked: 158 Wayback CDX rows for `joesventure.com/products/*`.
- Unique product handles recovered: 151.
- Variant rows recovered: 758.
- Product-media URLs recovered: 217.
- Shopify CSV rows written: 834, including image-only rows.
- Archive fetch failures: 0.

## Recovery Source

- Source used: Internet Archive Wayback Machine snapshots only.
- Live `joesventure.com` and the current Shopify storefront were not accessed.
- CDX query cache: `wayback-products-cdx.json`.
- Cached archived pages: `wayback-product-pages/`.
- Repeatable extraction script: `recover_wayback_products.py`.
- Parsed data cache: `wayback-recovery-summary.json`.

## Internal Sources Checked

- Local repository docs and client profiles.
- Local git history for Joe's Venture references and removed product exports.
- Production PostgreSQL client, CMS, connected-site, credential, knowledge-base, embedding, activity-log, and chat tables.
- Production PostgreSQL schema for product, snapshot, crawl, cache, memory, embedding, and Shopify-related tables.
- Production server filesystem under internal app, home, log, backup, opt, tmp, and root locations.
- Production application, automation, nginx, and auth logs.
- Shopify OAuth state tables.
- GitHub issues, PRs, issue comments, PR bodies, and commit comments.

## Internal Findings

- Internal profile records only the historical aggregate count: 152 products and 24 collections.
- No `joes-venture` client row exists in production.
- No CMS connection, connected site, credential vault entry, knowledge document, content embedding, activity log, or chat record contains Joe's Venture product data.
- No dedicated product snapshot, product index, product cache, or product backup table exists in the production schema.
- Product-related local scripts fetch live Shopify/WooCommerce data and do not persist historical snapshots.
- `/tmp/test-products.json` exists on production but contains an empty array.
- Logs only show Shopify install-link redirects for `joes-leather-goods-e2f2.myshopify.com`.
- Shopify OAuth states exist for that shop, but no callback-created client/token record exists.

## Recovered Fields

- Product handle.
- Product title.
- Product description when present in archived schema/meta tags.
- Vendor, defaulted to `Joe's Venture` when not explicitly present.
- Product type/category when present in archived schema.
- Variant option values from archived Shopify/JSON-LD data.
- Variant SKU when present.
- Variant price and currency when present.
- Variant barcode, inventory tracker, and weight when present in embedded Shopify variant JSON.
- Product image/media URLs from archived Shopify product schema and variant media.
- SEO title and SEO description derived from recovered product title/description.

## Missing Or Partial Fields

- One product from the internal aggregate count was not found in the recovered archive set.
- Collection membership for the 24 historical collections was not reconstructed in this CSV.
- Inventory quantities were not reliably available from archived public pages and are left blank.
- Product metafields were not available from public archive snapshots.
- Compare-at prices, cost per item, tax codes, product Google Shopping categories, and Shopify-specific administrative fields are mostly unavailable.
- Some older archived products expose many variant IDs and option values but not formal option names; the CSV uses generic `Option 1`, `Option 2`, and `Option 3` labels where necessary.
- Products are written as `Published=FALSE` and `Status=draft` to avoid accidental publication after import.

## Confidence

- Catalog existence/count confidence: Medium. The internal profile documents 152 products and 24 collections.
- Archived product-detail recovery confidence: High for handles/titles/prices/variant option values present in archived structured data; medium for descriptions/images because availability varies by snapshot.
- Completeness confidence: High that 151 unique archived product handles were recovered; medium relative to the full historical catalog because the internal count indicates 152 products.

## CSV Artifact

- `shopify-products-recovered.csv` is a Shopify-compatible import CSV built from archived snapshots.
- `shopify-products-recovered-no-media.csv` is the safer import file when Shopify reports `Media upload failed` / `Image: Media processing failed`; it preserves the 758 recovered variant rows and removes all image fields and image-only rows.
- `media-url-manifest.csv` lists the 217 recovered media URLs separately for later manual/API upload after confirming which archived or CDN image URLs are still fetchable by Shopify.
- `shopify-products-recovered-hosted-media.csv` is the media-enabled import file using production-hosted image copies at `https://16.192.29.174.nip.io/assets/recovery/joes-venture/images/`.
- `hosted-media-manifest.csv` records which recovered image URLs were downloadable and which failed.
- Rows should be reviewed before import because archive-derived products may include stale prices, sold-out variants, discontinued items, or incomplete administrative fields.

## Media Import Note

Shopify's CSV importer fetches `Image Src` URLs directly during import. Archive-derived image URLs may fail if the original Shopify CDN URL is stale, blocked, redirected, or no longer returns a processable image. Use `shopify-products-recovered-no-media.csv` first to import the catalog cleanly, then upload media separately from `media-url-manifest.csv` after validating/rehoming the image files on a stable public host.

## Hosted Media Fix

The recoverable images were downloaded, validated, and rehosted on the production TDS domain so Shopify can fetch them from stable URLs. The hosted-media pass produced:

- 119 valid hosted image files.
- 119 production URLs verified with HTTP 200 and image content types.
- 98 image URLs that could not be recovered as valid image files from the original URL, generic Wayback image URL, or image-specific Wayback CDX captures.
- `shopify-products-recovered-hosted-media.csv` keeps all 151 product handles and references only the 119 verified hosted images.
