# Webhooks

Webhooks deliver near-real-time data about specific events in a shop.

## How It Works
1. App subscribes to a webhook topic (e.g., `orders/create`)
2. App specifies an HTTPS endpoint to receive webhooks
3. When event occurs, Shopify sends webhook payload to endpoint

## Key Concepts
- **Webhook subscription**: Declares topic + delivery destination (URL, Google Pub/Sub, or EventBridge)
- **Webhook topic**: Identifies resource + action (e.g., `products/create`)
- **Headers**: `X-Shopify-Topic`, `X-Shopify-Webhook-Id`, `X-Shopify-Hmac-Sha256`
- **Verify deliveries**: Check HMAC signatures, ignore duplicates via `X-Shopify-Webhook-Id`

## Ordering
- Shopify doesn't guarantee ordering within a topic or across topics
- Use timestamps (`X-Shopify-Triggered-At` or `updated_at`) to organize

## Best Practices
- **Don't rely on guaranteed delivery** - implement reconciliation jobs
- Periodically fetch data via API to stay consistent
- Use `updated_at` filters in GraphQL queries for reconciliation

## Required (Mandatory) Webhooks
- `app/uninstalled`
- `shop/redact`
- `customers/redact`
- `customers/data_request`

## Next-Gen: Events
- Developer preview for a subset of topics
- Can run side by side with webhooks
- Supports filtering via `filter` and `include_fields`

Source: https://shopify.dev/docs/apps/build/webhooks
