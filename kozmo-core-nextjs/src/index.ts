/**
 * KOZMO Core Next.js Integration — Main Entry Point
 *
 * Integrate AI-generated content from KOZMO Core into your Next.js
 * App Router site. This package provides:
 *
 * - API route handlers for receiving content from KOZMO Core
 * - ISR revalidation helpers for instant content updates
 * - JSON-file-based content storage (pluggable)
 * - Pre-built React components for blog rendering
 * - TypeScript types matching KOZMO Core's content schema
 *
 * @example Quick start
 *
 *   // 1. Install: npm install @kozmo-core/nextjs-integration
 *   // 2. Set environment variable: KOZMO_CORE_API_KEY=your-key-here
 *   // 3. Create route files in your App Router:
 *
 *   // app/api/kozmo-core/posts/route.ts
 *   import { createKozmoCoreServer } from '@kozmo-core/nextjs-integration/server';
 *   const kozmoCore = createKozmoCoreServer({ apiKey: process.env.KOZMO_CORE_API_KEY! });
 *   export const GET = kozmoCore.handlers.posts.GET;
 *   export const POST = kozmoCore.handlers.posts.POST;
 *
 *   // 4. Render your blog:
 *   import { KozmoCoreBlogList } from '@kozmo-core/nextjs-integration/components';
 *   import { FileStorage } from '@kozmo-core/nextjs-integration/lib/storage';
 *
 *   export default async function BlogPage() {
 *     const storage = new FileStorage();
 *     const { posts, totalPages } = await storage.listPosts({ limit: 12 });
 *     return <KozmoCoreBlogList posts={posts} totalPages={totalPages} />;
 *   }
 */

// Core types
export type {
  // Domain types
  KozmoCoreArticle,
  KozmoCorePost,
  KozmoCorePostList,
  KozmoCoreAuthor,
  KozmoCoreArticleStatus,

  // Config
  KozmoCoreConfig,

  // Storage
  StorageProvider,

  // API payloads
  KozmoCoreWebhookPayload,
  KozmoCoreApiResponse,
  CreatePostPayload,
  UpdatePostPayload,

  // Component props
  KozmoCoreBlogListProps,
  KozmoCoreBlogPostProps,
  KozmoCoreContentProps,
} from './types';

// Lib modules
export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateKozmoCorePost,
  revalidateAllKozmoCoreContent,
  getKozmoCoreTags,
  KOZMO_CORE_TAG,
  KOZMO_CORE_REVALIDATION_TAGS,
} from './lib/revalidation';
