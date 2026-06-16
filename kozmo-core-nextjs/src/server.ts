/**
 * KOZMO Core Next.js Integration
 *
 * Unified server-side entry point. Creates a configured KOZMO Core server
 * instance with route handlers for posts, single post, and webhooks.
 *
 * Usage in your Next.js App Router:
 *
 *   // app/api/kozmo-core/posts/route.ts
 *   import { createKozmoCoreServer } from '@kozmo-core/nextjs-integration/server';
 *
 *   const kozmoCore = createKozmoCoreServer({
 *     apiKey: process.env.KOZMO_CORE_API_KEY!,
 *     debug: process.env.NODE_ENV === 'development',
 *   });
 *
 *   export const GET = kozmoCore.handlers.posts.GET;
 *   export const POST = kozmoCore.handlers.posts.POST;
 *
 *   // app/api/kozmo-core/posts/[id]/route.ts
 *   export const { GET, PUT, DELETE } = kozmoCore.handlers.post;
 *
 *   // app/api/kozmo-core/webhook/route.ts
 *   export const POST = kozmoCore.handlers.webhook.POST;
 */

import { KozmoCoreConfig, StorageProvider } from './types';
import { FileStorage } from './lib/storage';
import { createPostsHandler } from './api/createPostsHandler';
import { createPostHandler } from './api/createPostHandler';
import { createWebhookHandler } from './api/createWebhookHandler';

export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateKozmoCorePost,
  revalidateAllKozmoCoreContent,
  getKozmoCoreTags,
  KOZMO_CORE_TAG,
  KOZMO_CORE_REVALIDATION_TAGS,
} from './lib/revalidation';
export type { StorageProvider } from './types';

/**
 * Create a configured KOZMO Core server instance.
 *
 * @param config - Configuration options
 * @param config.apiKey - API key shared between KOZMO Core and this site (required)
 * @param config.storage - Custom storage provider (defaults to FileStorage in .kozmo-core/)
 * @param config.revalidationTags - ISR revalidation tags (defaults to ['kozmo-core'])
 * @param config.debug - Enable verbose logging
 */
export function createKozmoCoreServer(config: KozmoCoreConfig) {
  // Validate config
  if (!config.apiKey) {
    throw new Error(
      'KozmoCoreServer: apiKey is required. Set it via KozmoCoreConfig.apiKey or ' +
      'the KOZMO_CORE_API_KEY environment variable.'
    );
  }

  // Resolve storage
  const storage: StorageProvider = config.storage || new FileStorage();

  // Merge config with defaults
  const resolvedConfig: KozmoCoreConfig = {
    ...config,
    storage,
    revalidationTags: config.revalidationTags || ['kozmo-core'],
    basePath: config.basePath || '/api/kozmo-core',
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
      /** Handlers for /api/kozmo-core/posts — GET (list), POST (create) */
      posts: {
        GET: postsHandler.GET,
        POST: postsHandler.POST,
      },
      /** Handlers for /api/kozmo-core/posts/[id] — GET (single), PUT (update), DELETE (delete) */
      post: {
        GET: postHandler.GET,
        PUT: postHandler.PUT,
        DELETE: postHandler.DELETE,
      },
      /** Handlers for /api/kozmo-core/webhook — POST (receive events) */
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

export type KozmoCoreServer = ReturnType<typeof createKozmoCoreServer>;
