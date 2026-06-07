/**
 * Vireon Next.js Integration — Main Entry Point
 *
 * Integrate AI-generated content from Vireon into your Next.js
 * App Router site. This package provides:
 *
 * - API route handlers for receiving content from Vireon
 * - ISR revalidation helpers for instant content updates
 * - JSON-file-based content storage (pluggable)
 * - Pre-built React components for blog rendering
 * - TypeScript types matching Vireon's content schema
 *
 * @example Quick start
 *
 *   // 1. Install: npm install @vireon/nextjs-integration
 *   // 2. Set environment variable: VIREON_API_KEY=your-key-here
 *   // 3. Create route files in your App Router:
 *
 *   // app/api/vireon/posts/route.ts
 *   import { createVireonServer } from '@vireon/nextjs-integration/server';
 *   const vireon = createVireonServer({ apiKey: process.env.VIREON_API_KEY! });
 *   export const GET = vireon.handlers.posts.GET;
 *   export const POST = vireon.handlers.posts.POST;
 *
 *   // 4. Render your blog:
 *   import { VireonBlogList } from '@vireon/nextjs-integration/components';
 *   import { FileStorage } from '@vireon/nextjs-integration/lib/storage';
 *
 *   export default async function BlogPage() {
 *     const storage = new FileStorage();
 *     const { posts, totalPages } = await storage.listPosts({ limit: 12 });
 *     return <VireonBlogList posts={posts} totalPages={totalPages} />;
 *   }
 */

// Core types
export type {
  // Domain types
  VireonArticle,
  VireonPost,
  VireonPostList,
  VireonAuthor,
  VireonArticleStatus,

  // Config
  VireonConfig,

  // Storage
  StorageProvider,

  // API payloads
  VireonWebhookPayload,
  VireonApiResponse,
  CreatePostPayload,
  UpdatePostPayload,

  // Component props
  VireonBlogListProps,
  VireonBlogPostProps,
  VireonContentProps,
} from './types';

// Lib modules
export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateVireonPost,
  revalidateAllVireonContent,
  getVireonTags,
  VIREON_TAG,
  VIREON_REVALIDATION_TAGS,
} from './lib/revalidation';
