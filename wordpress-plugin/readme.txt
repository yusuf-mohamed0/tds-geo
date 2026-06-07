=== Vireon WordPress Integration ===
Contributors: vireon
Tags: ai content, seo, content automation, rest api, publishing
Requires at least: 5.6
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect your WordPress site to Vireon — the AI-powered SEO content automation platform. Receive and publish AI-generated articles directly from Vireon.

== Description ==

The Vireon WordPress Integration plugin connects your WordPress site to the Vireon AI SEO Content Automation platform. Once installed and configured, Vireon can:

* **Create posts** directly from the Vireon dashboard
* **Update existing posts** with new SEO-optimized content
* **Manage categories and tags** automatically
* **Set featured images** from remote URLs
* **Configure SEO metadata** for Yoast, Rank Math, AIOSEO, and SEOPress
* **Schedule posts** for future publication
* **Receive real-time webhook events** from Vireon

= Key Features =

* **Secure API Key Authentication** — Generate and manage API keys with granular read/write permissions
* **Full REST API** — 10+ endpoints for complete content management
* **SEO Plugin Integration** — Auto-populates Yoast, Rank Math, AIOSEO, and SEOPress fields
* **Media Handling** — Downloads and attaches featured images from URLs
* **Webhook Support** — Real-time content sync via signed webhooks
* **Activity Logging** — Built-in logger with filterable log viewer
* **Admin Dashboard** — Stats overview, quick actions, and connection testing
* **Batch Operations** — Create or update multiple posts in a single request

= Supported SEO Plugins =

* Yoast SEO
* Rank Math
* All in One SEO (AIOSEO)
* SEOPress
* The SEO Framework

== Installation ==

1. Upload the `vireon-integration` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to **Vireon → API Keys** and generate an API key
4. Copy the API key and enter it in your Vireon CMS Connection settings
5. Go to **Vireon → Settings** to configure default post status and import preferences
6. Test the connection from the Vireon dashboard or use the 'Test Connection' button

== Frequently Asked Questions ==

= Do I need a Vireon account? =

Yes. This plugin connects your WordPress site to the Vireon AI SEO Content Automation platform. You need an active Vireon account.

= Is my data secure? =

All API communication uses your site's existing HTTPS connection. API keys are stored securely in your WordPress database with SHA-256 hashing. Webhook payloads can be signed with a shared secret for additional security.

= Will this work with my existing SEO plugin? =

Yes. The plugin automatically detects and integrates with Yoast SEO, Rank Math, All in One SEO, SEOPress, and The SEO Framework.

= Can I control what gets published? =

Yes. You can set the default post status to "Draft" (recommended) so all Vireon-created posts go through your normal review workflow. Articles can also be scheduled for future publication.

== Changelog ==

= 1.0.0 =
* Initial release
* REST API with 10+ endpoints for content management
* API key authentication with read/write permissions
* Admin dashboard with stats, settings, and logs
* SEO plugin integration (Yoast, Rank Math, AIOSEO, SEOPress)
* Featured image download and attachment
* Batch post operations
* Webhook receiver with signature verification
* Activity logging with filterable log viewer

== Upgrade Notice ==

= 1.0.0 =
Initial release.
