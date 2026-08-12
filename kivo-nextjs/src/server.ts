// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * Kivo Geo Next.js Integration
 *
 * Unified server-side entry point. Creates a configured Kivo Geo server
 * instance with route handlers for posts, single post, and webhooks.
 *
 * Usage in your Next.js App Router:
 *
 *   // app/api/kivo/posts/route.ts
 *   import { createTdsGeoServer } from '@tds/nextjs-integration/server';
 *
 *   const tdsGeo = createTdsGeoServer({
 *     apiKey: process.env.KIVO_API_KEY!,
 *     debug: process.env.NODE_ENV === 'development',
 *   });
 *
 *   export const GET = tdsGeo.handlers.posts.GET;
 *   export const POST = tdsGeo.handlers.posts.POST;
 *
 *   // app/api/kivo/posts/[id]/route.ts
 *   export const { GET, PUT, DELETE } = tdsGeo.handlers.post;
 *
 *   // app/api/kivo/webhook/route.ts
 *   export const POST = tdsGeo.handlers.webhook.POST;
 */

import { TdsGeoConfig, StorageProvider } from './types';
import { FileStorage } from './lib/storage';
import { createPostsHandler } from './api/createPostsHandler';
import { createPostHandler } from './api/createPostHandler';
import { createWebhookHandler } from './api/createWebhookHandler';

export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateTdsGeoPost,
  revalidateAllTdsGeoContent,
  getTdsGeoTags,
  KIVO_TAG,
  KIVO_REVALIDATION_TAGS,
} from './lib/revalidation';
export type { StorageProvider } from './types';

/**
 * Create a configured Kivo Geo server instance.
 *
 * @param config - Configuration options
 * @param config.apiKey - API key shared between Kivo Geo and this site (required)
 * @param config.storage - Custom storage provider (defaults to FileStorage in .kivo/)
 * @param config.revalidationTags - ISR revalidation tags (defaults to ['kivo'])
 * @param config.debug - Enable verbose logging
 */
export function createTdsGeoServer(config: TdsGeoConfig) {
  // Validate config
  if (!config.apiKey) {
    throw new Error(
      'TdsGeoServer: apiKey is required. Set it via TdsGeoConfig.apiKey or ' +
      'the KIVO_API_KEY environment variable.'
    );
  }

  // Resolve storage
  const storage: StorageProvider = config.storage || new FileStorage();

  // Merge config with defaults
  const resolvedConfig: TdsGeoConfig = {
    ...config,
    storage,
    revalidationTags: config.revalidationTags || ['kivo'],
    basePath: config.basePath || '/api/kivo',
  };

  // Create route handlers
  const postsHandler = createPostsHandler(resolvedConfig);
  const postHandler = createPostHandler(resolvedConfig);
  const webhookHandler = createWebhookHandler(resolvedConfig);

  return {
    /** Configuration used by this instance */
    config: resolvedConfig,

    /** The storage provider (useful for direct DB access from server components) */
    storage,

    /** Route handler groups — assign these to your App Router route files */
    handlers: {
      /** Handlers for /api/kivo/posts — GET (list), POST (create) */
      posts: {
        GET: postsHandler.GET,
        POST: postsHandler.POST,
      },
      /** Handlers for /api/kivo/posts/[id] — GET (single), PUT (update), DELETE (delete) */
      post: {
        GET: postHandler.GET,
        PUT: postHandler.PUT,
        DELETE: postHandler.DELETE,
      },
      /** Handlers for /api/kivo/webhook — POST (receive events) */
      webhook: {
        POST: webhookHandler.POST,
      },
    },

    /**
     * Initialize the storage layer.
     * Call this during app startup if you need to ensure the storage
     * directory exists (e.g., in a layout or the root page).
     */
    async init(): Promise<void> {
      if (storage instanceof FileStorage) {
        await storage.init();
      }
    },
  };
}

export type TdsGeoServer = ReturnType<typeof createTdsGeoServer>;
