/**
 * Vireon Next.js Integration — VireonServer
 *
 * Unified server-side entry point. Creates a configured Vireon server
 * instance with route handlers for posts, single post, and webhooks.
 *
 * Usage in your Next.js App Router:
 *
 *   // app/api/vireon/posts/route.ts
 *   import { createVireonServer } from '@vireon/nextjs-integration/server';
 *
 *   const vireon = createVireonServer({
 *     apiKey: process.env.VIREON_API_KEY!,
 *     debug: process.env.NODE_ENV === 'development',
 *   });
 *
 *   export const GET = vireon.handlers.posts.GET;
 *   export const POST = vireon.handlers.posts.POST;
 *
 *   // app/api/vireon/posts/[id]/route.ts
 *   export const { GET, PUT, DELETE } = vireon.handlers.post;
 *
 *   // app/api/vireon/webhook/route.ts
 *   export const POST = vireon.handlers.webhook.POST;
 */

import { VireonConfig, StorageProvider } from './types';
import { FileStorage } from './lib/storage';
import { createPostsHandler } from './api/createPostsHandler';
import { createPostHandler } from './api/createPostHandler';
import { createWebhookHandler } from './api/createWebhookHandler';

export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateVireonPost,
  revalidateAllVireonContent,
  getVireonTags,
  VIREON_TAG,
  VIREON_REVALIDATION_TAGS,
} from './lib/revalidation';
export type { StorageProvider } from './types';

/**
 * Create a configured Vireon server instance.
 *
 * @param config - Configuration options
 * @param config.apiKey - API key shared between Vireon and this site (required)
 * @param config.storage - Custom storage provider (defaults to FileStorage in .vireon/)
 * @param config.revalidationTags - ISR revalidation tags (defaults to ['vireon'])
 * @param config.debug - Enable verbose logging
 */
export function createVireonServer(config: VireonConfig) {
  // Validate config
  if (!config.apiKey) {
    throw new Error(
      'VireonServer: apiKey is required. Set it via VireonConfig.apiKey or ' +
      'the VIREON_API_KEY environment variable.'
    );
  }

  // Resolve storage
  const storage: StorageProvider = config.storage || new FileStorage();

  // Merge config with defaults
  const resolvedConfig: VireonConfig = {
    ...config,
    storage,
    revalidationTags: config.revalidationTags || ['vireon'],
    basePath: config.basePath || '/api/vireon',
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
      /** Handlers for /api/vireon/posts — GET (list), POST (create) */
      posts: {
        GET: postsHandler.GET,
        POST: postsHandler.POST,
      },
      /** Handlers for /api/vireon/posts/[id] — GET (single), PUT (update), DELETE (delete) */
      post: {
        GET: postHandler.GET,
        PUT: postHandler.PUT,
        DELETE: postHandler.DELETE,
      },
      /** Handlers for /api/vireon/webhook — POST (receive events) */
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

export type VireonServer = ReturnType<typeof createVireonServer>;
