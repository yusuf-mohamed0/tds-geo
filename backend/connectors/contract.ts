// ══════════════════════════════════════════════════════════════════
// KOZMO Core — Universal Connector Contract
//
// Every connector (WordPress, Shopify, Webflow, etc.) implements
// this contract so the orchestrator can publish/update/delete
// content to any CMS without knowing the specifics.
//
// Connectors are stateless — the caller (MultiCmsPublisherService)
// manages per-article connection configs and passes them on every call.
// ══════════════════════════════════════════════════════════════════

import {
  CmsProvider,
  CmsConnection,
  Article,
  PublishResult,
  PublisherAdapter,
  PublisherCapabilities,
} from '../types';

export type {
  CmsProvider,
  CmsConnection,
  Article,
  PublishResult,
  PublisherAdapter,
  PublisherCapabilities,
};

/**
 * Create a connector adapter for a CMS provider.
 *
 * Each connector receives the full CmsConnection config at
 * construction time so it can pre-configure auth, base URL, etc.
 *
 * The returned PublisherAdapter is registered with
 * MultiCmsPublisherService and called for every publish/update/delete.
 */
export type ConnectorFactory = (connection: CmsConnection) => PublisherAdapter;
