# CMS Connectors

## Architecture

Connectors follow a standard `ConnectorInterface` and are registered at startup. Each connector handles publishing, reading, and syncing content with a specific CMS platform.

```
ConnectorManager (in-memory registry)
  ├── shopify    → Shopify Admin API
  ├── wordpress  → WordPress REST API + Kivo Geo plugin
  ├── webflow    → Stub (not implemented)
  ├── ghost      → Stub (not implemented)
  └── woocommerce → Extends WordPress connector
```

## Common Interface

Every connector implements:

| Method | Purpose |
|---|---|
| `connect(config)` | Test connection, return boolean |
| `health()` | Health check status |
| `publish(article)` | Create content |
| `update(id, article)` | Update existing content |
| `delete(id)` | Delete content |
| `getContent(id)` | Read content |
| `getMedia(id)` | Get media info |
| `getCategories()` | List categories |
| `getTags()` | List tags |
| `sync()` | Full sync |
| `disconnect()` | Cleanup |

## Connector Status

| Connector | Publish | Read | Media | Sync | Real? |
|---|---|---|---|---|---|
| **shopify** | ✅ | ✅ | ✅ | ✅ | Yes — fully implemented |
| **wordpress** | ✅ | ✅ | ✅ | ✅ | Yes — fully implemented |
| **webflow** | ❌ | ✅ | ❌ | ❌ | No — stub only |
| **ghost** | ❌ | ✅ | ❌ | ❌ | No — stub only |
| **woocommerce** | ✅ | ✅ | ✅ | ✅ | Yes — extends WordPress |

## Shopify Connector

- Uses Shopify Admin REST API via `shopifyService`
- Handles OAuth tokens stored per-shop
- Publishes articles as blog posts with images
- Rate-limited with exponential backoff

## WordPress Connector

- Connects to WordPress site via REST API
- **Three auth modes:**
  1. Application Password (WordPress built-in)
  2. Kivo Geo plugin API key (X-Kivo-Key header)
  3. JWT (custom plugin)
- Creates posts via WordPress REST API
- Uploads featured images as media attachments
- Syncs categories and tags

## WooCommerce Connector

- Extends WordPress connector (WooCommerce is a WordPress plugin)
- Same REST API pattern, overrides provider name to 'woocommerce'
- Can publish products or content to WooCommerce stores

## Connector Manager

- **Startup:** Reads all active `cms_connections` from DB, auto-connects each
- **Health checks:** Every 5 minutes, updates status via heartbeat service
- **Events:** Emits `CONNECTOR_REGISTERED`, `CONNECTOR_HEALTH_CHANGED` on event bus
- **Capabilities:** Each connector declares capabilities (publish, read, media, sync)

## Adding a New Connector

1. Create file in `backend/connectors/{name}/index.ts`
2. Implement `ConnectorInterface`
3. Register in `backend/connectors/index.ts`
4. Add connection config handling in `backend/connector-manager/`
