=== TDS GEO WordPress Connector ===
Contributors: tdsgeo
Tags: AI, SEO, content, connector, rest-api, shopify, automation
Requires at least: 5.8
Tested up to: 6.4
Stable tag: 3.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Thin connector for TDS GEO Core — exposes WordPress REST API for post CRUD, media, taxonomies, and settings. All AI intelligence runs on the Core backend.

== Description ==

TDS GEO WordPress Connector is a lightweight REST API bridge between your WordPress site and TDS GEO Core (the central AI engine). After installation and API connection, TDS GEO Core can create, update, delete, and sync content on your WordPress site through this connector.

= What it does =

* **Post CRUD** — Create, read, update, and delete posts with full metadata
* **Media Sideloading** — Download and attach images from remote URLs
* **Taxonomy Sync** — Auto-create categories and tags as needed
* **SEO Plugin Integration** — Writes meta titles, descriptions, and focus keywords into Yoast SEO, Rank Math, All in One SEO, and SEOPress
* **Webhook Support** — Signature-verified incoming webhooks from TDS GEO Core
* **Batch Operations** — Create or update multiple posts in a single request
* **Activity Logging** — Structured logging with level filtering and context
* **API Key Auth** — Multi-key management with permissions and expiry
* **Rate Limiting** — Per-key rate limiting for API endpoints

= What it does NOT do =

* ❌ No content generation — all AI writing runs on TDS GEO Core
* ❌ No SEO analysis — all scoring runs on TDS GEO Core
* ❌ No research — all keyword research runs on TDS GEO Core
* ❌ No memory or knowledge base — that lives on TDS GEO Core
* ❌ No self-healing — that's managed by TDS GEO Core

== Installation ==

1. Upload the `tds-geo-wp` folder to the `/wp-content/plugins/` directory, or upload the ZIP directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Go to TDS GEO Connector → API Keys to generate an API key.
4. Enter the TDS GEO Core URL and API key in the Settings page.
5. The connector will register with TDS GEO Core and begin accepting commands.

== Frequently Asked Questions ==

= Does this plugin generate content? =

No. All content generation, SEO analysis, and research runs on TDS GEO Core. This plugin only provides the REST API endpoints for TDS GEO Core to manage content on your WordPress site.

= Does it work with existing SEO plugins? =

Yes! The plugin natively supports Yoast SEO, Rank Math, All in One SEO, and SEOPress. It writes meta titles, descriptions, and focus keywords directly into these plugins' meta fields.

= Is my data secure? =

Yes. All API communication requires authentication via API key. Webhooks are signed with a secret key. All input is sanitized, all output is escaped, and SQL queries use prepared statements.

= How do I connect this to TDS GEO Core? =

Go to TDS GEO Connector → API Keys, generate a new API key, then enter the TDS GEO Core URL and your API key in the Settings page. TDS GEO Core will then be able to communicate with your site.

== Changelog ==

= 3.0.0 =
* Complete rewrite as thin connector — all AI logic moved to TDS GEO Core
* Stripped OpenAI key storage (unused vestigial code)
* Stripped agent_url setting (unused vestigial code)
* Updated plugin description to accurately reflect connector-only architecture
* Removed stale admin JS AJAX handlers with no PHP backing
* Full REST API for posts, media, taxonomies, settings, webhooks
* SEO plugin integration (Yoast, Rank Math, AIOSEO, SEOPress)
* Multi-key authentication with permissions and rate limiting
* Webhook support with HMAC signature verification

= 2.0.0 =
* Initial autonomous agent architecture
* Website discovery and knowledge base
* AI-powered content pipeline with quality scoring
* REST API with webhook support
* Background worker queue with cron scheduling
