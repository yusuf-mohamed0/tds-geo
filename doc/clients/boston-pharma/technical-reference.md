# Boston Pharma — Technical Reference

## Kivo Geo Integration

| Parameter | Value |
|---|---|
| **Client ID** | `6554060c-3618-485f-b705-1c69c10b524c` |
| **Slug** | `boston-pharma` |
| **Service Area** | `pharmaceutical` |
| **Brand Voice** | `B2B pharmaceutical manufacturing` |
| **Timezone** | `Africa/Cairo` |
| **Publish Frequency** | `manual` |
| **Approval Mode** | `auto` |
| **API Key** | `kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1` |
| **Auth Header** | `X-TDS-Geo-Key` |

## WordPress Site Details

| Field | Value |
|---|---|
| **Site URL** | https://boston-pharma.com |
| **WP Version** | 7.0 |
| **PHP Version** | 8.3.31 |
| **DB Prefix** | `wp_8n1vqj9f85_` |
| **DB Host** | `bostongr_WPKMQ` |
| **REST Namespace** | `kivo/v1` |
| **REST Base URL** | `https://boston-pharma.com/wp-json/kivo/v1` |
| **Webhook URL** | `https://boston-pharma.com/wp-json/kivo/v1/webhook` |
| **Admin Email** | `t.murad@bostongroup-eg.com` |
| **Connector Version** | 3.1.3 |
| **Connector DB Version** | 2 |

## Active WooCommerce Settings
- Product search (default search post type)
- Cart: slide-in style
- Product style: minimal
- Google for WooCommerce enabled

## SEO Configuration
- Yoast SEO 27.9 active
- OpenGraph enabled (Facebook, Twitter cards)
- Schema.org markup (Organization, WebPage, BreadcrumbList)
- Sitemap enabled
- Google Search Console connected

## Hosting
- Bluehost/Endurance
- Apache + nginx reverse proxy
- Endurance Page Cache (nginx-based)
- HTTP/2 enabled
- Strict Transport Security (max-age=300)

## Key URLs
- Homepage: https://boston-pharma.com
- About: https://boston-pharma.com/about-us/
- Contact: https://boston-pharma.com/contact/
- Blog: https://boston-pharma.com/blog/
- Cart: https://boston-pharma.com/my-cart/
- Products: https://boston-pharma.com/product-category/all/
- Offers: https://boston-pharma.com/product-category/offers/
- REST API: https://boston-pharma.com/wp-json/kivo/v1/
- Webhook: https://boston-pharma.com/wp-json/kivo/v1/webhook
- Arabic site: https://boston-pharma.com/ar/

## Active Must-Use Plugins
- `endurance-page-cache.php`
- `object-cache.php`
- `sso.php`
- Drop-in: `db-error.php`

## Auto-Update Enabled Plugins
- WooCommerce Advanced Free Shipping
- Bosta, COBLocks
- Google for WooCommerce, Google Site Kit
- Ninja Forms
- Sucuri Security
- Weglot
- WooCommerce
- Woo Update Manager
- Duplicate Post
- Yoast SEO

## Notes
- Boston Pharma is a **WordPress-only client** (no Shopify). Shopify fields on the backend are placeholders.
- Weglot translates EN → AR with automatic translation enabled.
- Ninja Forms used for contact forms (display-opinions-light.css).
- Google Ads conversion tracking active (AW-16695363279).
- Sucuri Security provides firewall, hardening, and 2FA.
- All-in-One WP Migration used for site backups/migration.
- The site uses the Salient theme with Material skin, WPBakery page builder.
