/**
 * KozmoAI Next.js Integration — Main Entry Point
 *
 * Integrate AI-generated content from KozmoAI into your Next.js
 * App Router site. This package provides:
 *
 * - API route handlers for receiving content from KozmoAI
 * - ISR revalidation helpers for instant content updates
 * - JSON-file-based content storage (pluggable)
 * - Pre-built React components for blog rendering
 * - TypeScript types matching KozmoAI's content schema
 *
 * @example Quick start
 *
 *   // 1. Install: npm install @kozmo-ai/nextjs-integration
 *   // 2. Set environment variable: KOZMO_AI_API_KEY=your-key-here
 *   // 3. Create route files in your App Router:
 *
 *   // app/api/kozmo-ai/posts/route.ts
 *   import { createKozmoAIServer } from '@kozmo-ai/nextjs-integration/server';
 *   const kozmo-ai = createKozmoAIServer({ apiKey: process.env.KOZMO_AI_API_KEY! });
 *   export const GET = kozmo-ai.handlers.posts.GET;
 *   export const POST = kozmo-ai.handlers.posts.POST;
 *
 *   // 4. Render your blog:
 *   import KozmoAIBlogList } from '@kozmo-ai/nextjs-integration/components';
 *   import { FileStorage } from '@kozmo-ai/nextjs-integration/lib/storage';
 *
 *   export default async function BlogPage() {
 *     const storage = new FileStorage();
 *     const { posts, totalPages } = await storage.listPosts({ limit: 12 });
 *     return <KozmoAIBlogList posts={posts} totalPages={totalPages} />;
 *   }
 */

// Core types
export type {
  // Domain types
  KozmoAIArticle,
  KozmoAIPost,
  KozmoAIPostList,
  KozmoAIAuthor,
  KozmoAIArticleStatus,

  // Config
  KozmoAIConfig,

  // Storage
  StorageProvider,

  // API payloads
  KozmoAIWebhookPayload,
  KozmoAIAPIResponse,
  CreatePostPayload,
  UpdatePostPayload,

  // Component props
  KozmoAIBlogListProps,
  KozmoAIBlogPostProps,
  KozmoAIContentProps,
} from './types';

// Lib modules
export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateKozmoAIPost,
  revalidateAllKozmoAIContent,
  getKozmoAITags,
  KOZMO_AI_TAG,
  KOZMO_AI_REVALIDATION_TAGS,
} from './lib/revalidation';
