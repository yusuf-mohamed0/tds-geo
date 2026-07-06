# Shopify App Development Docs

## Authentication & Authorization
- Apps rendered in Shopify admin use **session tokens**
- Standalone apps implement their own authentication
- **Token exchange** is the recommended token acquisition flow
- **Shopify managed installation** is the recommended install flow
- OAuth 2.0 is the industry-standard protocol

## App Types
- **Admin-embedded apps**: Rendered in Shopify admin, use session tokens + token exchange
- **Standalone apps**: Own authentication, authorization code grant
- **Admin-created custom apps**: Tokens generated in Shopify admin

## Tools
- Shopify CLI - scaffold apps, manage config, deploy
- @shopify/shopify-api - Node library for Admin/Storefront APIs, OAuth, webhooks, billing
- @shopify/admin-api-client - Lightweight Node Admin API client

Source: https://shopify.dev/docs/apps/build/authentication-authorization
