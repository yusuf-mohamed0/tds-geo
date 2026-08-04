/**
 * Detects whether the app is running inside the Shopify admin (embedded).
 *
 * Embedded users authenticate via `window.shopify.idToken()` rather than the
 * JWT login used by the standalone admin dashboard. This helper is shared by
 * the router (App) and the Layout guard so both agree on which auth surface
 * applies.
 */
export function isEmbedded(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('shop') && url.searchParams.has('host')) return true;
    if (window.top && window.top !== window.self) return true;
    if (url.searchParams.has('embedded')) return true;
    if (document.referrer.includes('myshopify.com') || document.referrer.includes('shopify.com')) return true;
  } catch {
    // Malformed URL — treat as non-embedded.
  }
  return false;
}