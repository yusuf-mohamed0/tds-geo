=== KOZMO AI — Autonomous WP Agent ===
Contributors: kozmoai
Tags: AI, SEO, content, automation, autonomous, agent, artificial intelligence, content generation, SEO optimization
Requires at least: 5.8
Tested up to: 6.4
Stable tag: 2.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Autonomous AI agent for WordPress. Automatically understands, manages, optimizes, and grows your website with AI-powered SEO content automation.

== Description ==

KOZMO AI transforms your WordPress site into an AI-powered autonomous content platform. After installation and API connection, the AI agent:

* **Discovers** your entire website — structure, content, theme, plugins, SEO config
* **Analyzes** content quality, keyword coverage, topical authority, and gaps
* **Generates** high-quality, SEO-optimized articles with full pipeline (keyword research → writing → optimization → publishing)
* **Scores** every article for quality (meta, readability, images, links, schema) with automatic rewriting until score ≥ 95
* **Monitors** site health with self-healing error recovery
* **Maintains** content freshness — updates old posts, improves internal linking, repairs broken links
* **Reports** continuously through a modern admin dashboard

== Features ==

* **Website Discovery Engine** — Full scan of site structure, content, taxonomies, media, theme, plugins, SEO, users
* **Knowledge Base** — Persistent storage of all website intelligence synced with the AI agent
* **Content Intelligence** — Thin content detection, duplicate titles, keyword coverage, outdated content, cannibalization
* **Article Pipeline** — Full creation pipeline with quality scoring (title, content length, readability, images, meta, keywords, links, schema)
* **Quality Threshold** — Articles score ≥ 95 are auto-published; below threshold triggers automatic rewriting
* **Self-Healing Engine** — Automatic error detection, root cause analysis, and recovery with exponential backoff
* **SEO Plugin Support** — Native integration with Yoast, Rank Math, All in One SEO, SEOPress
* **Background Workers** — Queue-based async processing with cron scheduling
* **REST API** — Full CRUD for posts, media, taxonomies, settings, webhooks
* **Webhook Support** — Signature-verified incoming webhooks from the AI agent
* **API Key Auth** — Multi-key management with read/write/admin permissions and expiry
* **Rate Limiting** — Per-key rate limiting for API endpoints
* **Modern Dashboard** — Live stats, health monitoring, queue status, activity feed
* **Secure** — Nonce verification, capability checks, input sanitization, output escaping, CSRF protection
* **Automatic Cleanup** — Log rotation, old error cleanup, queue maintenance

== Installation ==

1. Upload the `kozmo-ai-wp` folder to the `/wp-content/plugins/` directory, or upload the ZIP directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Go to KOZMO AI → API Keys to get your initial API key.
4. Enter your API key and agent URL in the KOZMO AI Settings page.
5. The AI agent will automatically scan your website and begin operations.
6. Monitor activity from the KOZMO AI Dashboard.

No additional configuration required — the agent handles everything automatically.

== Frequently Asked Questions ==

= What does the plugin do automatically? =

After activation and API connection, the plugin automatically scans your website, builds a knowledge base, analyzes content health, and processes tasks from the AI agent including article creation, updates, SEO optimization, and maintenance.

= Does it work with existing SEO plugins? =

Yes! The plugin natively supports Yoast SEO, Rank Math, All in One SEO, and SEOPress. It writes meta titles, descriptions, and focus keywords directly into these plugins' meta fields.

= Is my data secure? =

Yes. All API communication requires authentication. Webhooks can be signed with a secret key. All input is sanitized. All output is escaped. SQL queries use prepared statements.

= How do I control what gets published? =

Configure the minimum quality score (default 95) and auto-publish settings in the Settings page. You can also set the default post status. The AI agent can override these per-article.

= What happens if something fails? =

The self-healing engine detects failures, logs them, and automatically attempts recovery. Tasks are retried with exponential backoff. Critical errors are flagged in the dashboard.

== Changelog ==

= 2.0.0 =
* Initial release — complete autonomous AI agent for WordPress
* Website discovery and knowledge base
* AI-powered content pipeline with quality scoring
* Self-healing error recovery system
* Modern admin dashboard with live statistics
* Full REST API with webhook support
* Background worker queue with cron scheduling
* Multi-key authentication with permissions
* SEO plugin integration (Yoast, Rank Math, AIOSEO, SEOPress)
* Rate limiting and security hardening
* Database migrations and automatic cleanup
