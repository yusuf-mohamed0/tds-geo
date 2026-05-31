// ──────────────────────────────────────────────
// Shopify App Bridge Provider
// Detects embedded Shopify admin context, handles OAuth redirect,
// and provides shop/host/isEmbedded context to children.
// ──────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { TOKEN_KEY } from '../services/api';

// ─── Types ────────────────────────────────────

export interface ShopifyContextValue {
  /** Whether the app is running inside the Shopify admin iframe */
  isEmbedded: boolean;
  /** The shop domain (e.g., "mystore.myshopify.com") */
  shop: string | null;
  /** The base64-encoded host param from Shopify */
  host: string | null;
  /** Whether the shop is embedded with the embedded=1 flag */
  isEmbeddedParam: boolean;
  /** Whether this was a fresh OAuth install (show welcome page) */
  isJustInstalled: boolean;
  /** Get a fresh Shopify session token (JWT) for backend auth */
  getSessionToken: () => Promise<string | null>;
  /** Redirect to Shopify OAuth install flow */
  redirectToOAuth: () => void;
  /** Whether we're still determining the embedding state */
  loading: boolean;
}

const ShopifyContext = createContext<ShopifyContextValue | null>(null);

// ─── URL Helpers ──────────────────────────────

/**
 * Parse query params from the current URL and return both the params
 * and a cleanup function that removes Shopify-specific params.
 */
function captureAndCleanupShopifyParams(): {
  shop: string | null;
  host: string | null;
  embedded: boolean;
  token: string | null;
  error: string | null;
  justInstalled: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  const result = {
    shop: params.get('shop'),
    host: params.get('host'),
    embedded: params.get('embedded') === '1',
    token: params.get('token'),
    error: params.get('error'),
    justInstalled: params.get('just_installed') === '1',
  };

  // Only strip params after we've captured them
  const shopifyKeys = ['shop', 'host', 'embedded', 'hmac', 'timestamp', 'state', 'code', 'session', 'token', 'error', 'just_installed'];
  let changed = false;
  for (const key of shopifyKeys) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }

  return result;
}

// ─── Provider ─────────────────────────────────

export function ShopifyAppProvider({ children }: { children: ReactNode }) {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [shop, setShop] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const [isEmbeddedParam, setIsEmbeddedParam] = useState(false);
  const [isJustInstalled, setIsJustInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const oauthRedirected = useRef(false);
  const tokenProcessed = useRef(false);

  useEffect(() => {
    // Capture params BEFORE any other hook runs, then clean up URL
    const captured = captureAndCleanupShopifyParams();

    setShop(captured.shop);
    setHost(captured.host);
    setIsEmbeddedParam(captured.embedded);
    setIsEmbedded(!!(captured.shop && captured.host));
    setIsJustInstalled(captured.justInstalled);

    // ── Handle JWT token from OAuth success redirect ──
    if (captured.token && !tokenProcessed.current) {
      tokenProcessed.current = true;
      localStorage.setItem(TOKEN_KEY, captured.token);

      // If this is a fresh install, navigate to welcome page
      // Use setTimeout so the token is stored before React Router picks it up
      if (captured.justInstalled) {
        const targetShop = captured.shop ? `?shop=${encodeURIComponent(captured.shop)}` : '';
        window.location.href = `/welcome${targetShop}`;
        return; // Let navigation happen
      }
    }

    // ── Redirect to OAuth if embedded with no auth ──
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (captured.shop && captured.host && !existingToken && !captured.token && !oauthRedirected.current) {
      oauthRedirected.current = true;
      // For embedded apps, redirecting to /auth?shop=... triggers OAuth.
      // Shopify intercepts this redirect and shows the OAuth approval page.
      // Include host so the backend can redirect back with embedded params.
      window.location.href = `/auth?shop=${encodeURIComponent(captured.shop)}&host=${encodeURIComponent(captured.host)}`;
      return; // Stop rendering — navigation will happen
    }

    // ── Handle error params from OAuth failures ──
    if (captured.error && !oauthRedirected.current) {
      console.error('Shopify OAuth error:', captured.error);
    }

    setLoading(false);
  }, []);

  /**
   * Get a Shopify session token (JWT) for backend authentication.
   * Only available when running inside the Shopify admin iframe.
   */
  const getSessionToken = async (): Promise<string | null> => {
    try {
      // In App Bridge v4, the shopify global is available as window.shopify
      const shopifyGlobal = (window as any).shopify;
      if (shopifyGlobal?.idToken) {
        return await shopifyGlobal.idToken();
      }
      return null;
    } catch {
      return null;
    }
  };

  /**
   * Redirect to the Shopify OAuth install flow.
   */
  const redirectToOAuth = () => {
    if (shop && !oauthRedirected.current) {
      oauthRedirected.current = true;
      const hostParam = host ? `&host=${encodeURIComponent(host)}` : '';
      window.location.href = `/auth?shop=${encodeURIComponent(shop)}${hostParam}`;
    }
  };

  return (
    <ShopifyContext.Provider
      value={{
        isEmbedded,
        shop,
        host,
        isEmbeddedParam,
        isJustInstalled,
        getSessionToken,
        redirectToOAuth,
        loading,
      }}
    >
      {children}
    </ShopifyContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────

/**
 * Access the Shopify embedded context.
 * Throws if used outside ShopifyAppProvider.
 */
export function useShopify(): ShopifyContextValue {
  const context = useContext(ShopifyContext);
  if (!context) {
    throw new Error('useShopify must be used within a ShopifyAppProvider');
  }
  return context;
}

/**
 * Check if the app is currently running inside the Shopify admin iframe.
 */
export function useIsEmbedded(): boolean {
  return useShopify().isEmbedded;
}

/**
 * Get the current shop domain from the Shopify embedded context.
 */
export function useShop(): string | null {
  return useShopify().shop;
}
