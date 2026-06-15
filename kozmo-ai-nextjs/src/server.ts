/**
 * KozmoAI Next.js Integration — KozmoAIServer
 *
 * Unified server-side entry point. Creates a configured KozmoAI server
 * instance with route handlers for posts, single post, and webhooks.
 *
 * Usage in your Next.js App Router:
 *
 *   // app/api/kozmo-ai/posts/route.ts
 *   import { createKozmoAIServer } from '@kozmo-ai/nextjs-integration/server';
 *
 *   const kozmo-ai = createKozmoAIServer({
 *     apiKey: process.env.KOZMO_AI_API_KEY!,
 *     debug: process.env.NODE_ENV === 'development',
 *   });
 *
 *   export const GET = kozmo-ai.handlers.posts.GET;
 *   export const POST = kozmo-ai.handlers.posts.POST;
 *
 *   // app/api/kozmo-ai/posts/[id]/route.ts
 *   export const { GET, PUT, DELETE } = kozmo-ai.handlers.post;
 *
 *   // app/api/kozmo-ai/webhook/route.ts
 *   export const POST = kozmo-ai.handlers.webhook.POST;
 */

import { KozmoAIConfig, StorageProvider } from './types';
import { FileStorage } from './lib/storage';
import { createPostsHandler } from './api/createPostsHandler';
import { createPostHandler } from './api/createPostHandler';
import { createWebhookHandler } from './api/createWebhookHandler';

export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateKozmoAIPost,
  revalidateAllKozmoAIContent,
  getKozmoAITags,
  KOZMO_AI_TAG,
  KOZMO_AI_REVALIDATION_TAGS,
} from './lib/revalidation';
export type { StorageProvider } from './types';

/**
 * Create a configured KozmoAI server instance.
 *
 * @param config - Configuration options
 * @param config.apiKey - API key shared between KozmoAI and this site (required)
 * @param config.storage - Custom storage provider (defaults to FileStorage in .kozmo-ai/)
 * @param config.revalidationTags - ISR revalidation tags (defaults to ['kozmo-ai'])
 * @param config.debug - Enable verbose logging
 */
export function createKozmoAIServer(config: KozmoAIConfig) {
  // Validate config
  if (!config.apiKey) {
    throw new Error(
      'KozmoAIServer: apiKey is required. Set it via KozmoAIConfig.apiKey or ' +
      'the KOZMO_AI_API_KEY environment variable.'
    );
  }

  // Resolve storage
  const storage: StorageProvider = config.storage || new FileStorage();

  // Merge config with defaults
  const resolvedConfig: KozmoAIConfig = {
    ...config,
    storage,
    revalidationTags: config.revalidationTags || ['kozmo-ai'],
    basePath: config.basePath || '/api/kozmo-ai',
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
      /** Handlers for /api/kozmo-ai/posts — GET (list), POST (create) */
      posts: {
        GET: postsHandler.GET,
        POST: postsHandler.POST,
      },
      /** Handlers for /api/kozmo-ai/posts/[id] — GET (single), PUT (update), DELETE (delete) */
      post: {
        GET: postHandler.GET,
        PUT: postHandler.PUT,
        DELETE: postHandler.DELETE,
      },
      /** Handlers for /api/kozmo-ai/webhook — POST (receive events) */
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

export type KozmoAIServer = ReturnType<typeof createKozmoAIServer>;
