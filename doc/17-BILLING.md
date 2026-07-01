# Billing System

## Overview

Uses **Shopify's AppSubscription GraphQL API** for recurring charges. Shopify handles payment collection, invoicing, and payouts to you.

All billing is currently **inactive** — no pricing plan is live. The code is ready to activate when needed.

## Pricing Plans

| Plan | Price | Interval |
|---|---|---|
| Starter | $29/month | Every 30 days |
| Professional | $79/month | Every 30 days |
| Enterprise | $199/month | Every 30 days |

## Billing Flow

```
1. Merchant clicks "Subscribe" in the embedded app
2. → POST /api/billing/create { shop, plan, returnUrl }
3. → Backend calls Shopify GraphQL: appSubscriptionCreate mutation
     → Returns confirmationUrl
4. → Merchant redirected to Shopify's confirmation page
5. → Merchant approves
6. → Shopify redirects to: /api/billing/callback?charge_id=X&shop=Y
7. → Backend verifies charge via GraphQL node(id) query
8. → If ACTIVE: update client billing_status='active', billing_plan
9. → Merchant redirected to success page
```

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/billing/plans` | GET | None | List available plans |
| `/api/billing/create` | POST | Validate schema | Create Shopify subscription |
| `/api/billing/callback` | GET | None | Shopify redirect callback |
| `/api/billing/status` | GET | None | Get billing status for a shop |

## Database

Added to `clients` table:

| Column | Type | Purpose |
|---|---|---|
| `shopify_subscription_id` | VARCHAR(255) | Shopify subscription GID |
| `shopify_charge_id` | BIGINT | Charge ID |
| `billing_plan` | VARCHAR(50) | starter/professional/enterprise |
| `billing_status` | VARCHAR(20) | pending/active/cancelled/declined |
| `billing_activated_at` | TIMESTAMPTZ | When activated |

`billing_events` table tracks:
- subscription_created
- subscription_activated
- subscription_cancelled
- subscription_declined

## Test Mode

For development/test stores, `test: true` is sent in the `appSubscriptionCreate` mutation. Shopify handles this as a test charge (no real payment).

## To Activate Billing

1. Uncomment/enable billing routes in the frontend
2. Create plan selection UI in the embedded app
3. Test with a test store
4. Enable for production
