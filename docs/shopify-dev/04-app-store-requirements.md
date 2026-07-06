# App Store Requirements

## Policy
- Use Shopify checkout (no offsite/third-party checkout)
- Create unique apps (no duplicates)
- Build web-based apps (no required desktop app)
- Use only factual info in listing
- Build single-merchant storefronts (marketplaces = sales channels)
- Use session tokens for authentication (no third-party cookies)
- Bill through Shopify Billing API or Shopify App Pricing
- Allow pricing plan changes without contacting support

## Functionality
- Build without critical errors (no 404/500)
- Use Shopify APIs (GraphQL Admin API required for new apps since April 2025)
- Use latest Shopify App Bridge version
- Provide consistent embedded experience
- Authenticate immediately after install (OAuth before any UI)
- Redirect to app UI after installation
- Initiate installation from Shopify-owned surface only

## Security
- Valid TLS/SSL certificate
- Request only necessary access scopes

## App Store Listing
- Brand consistently (app name must match between Dev Dashboard and App Submission)
- Accurate pricing (no pricing in images/logo)
- Truthful listing (no stats/claims/guarantees)
- Include test credentials
- Include demo screencast
- Provide emergency developer contact

## Category-Specific
- **Online store**: Use theme app extensions, no direct code changes
- **Payment**: Use Payments API, standalone (not embedded)
- **Sales channel**: Build with Polaris components, include navigation icon

Source: https://shopify.dev/docs/apps/store/requirements
