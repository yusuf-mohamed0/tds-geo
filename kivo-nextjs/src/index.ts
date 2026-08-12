// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * Kivo Geo Next.js Integration - Main Entry Point
 *
 * Integrate AI-generated content from Kivo Geo into your Next.js
 * App Router site. This package provides:
 *
 * - API route handlers for receiving content from Kivo Geo
 * - ISR revalidation helpers for instant content updates
 * - JSON-file-based content storage (pluggable)
 * - Pre-built React components for blog rendering
 * - TypeScript types matching Kivo Geo's content schema
 *
 * @example Quick start
 *
 *   // 1. Install: npm install @tds/nextjs-integration
 *   // 2. Set environment variable: KIVO_API_KEY=your-key-here
 *   // 3. Create route files in your App Router:
 *
 *   // app/api/kivo/posts/route.ts
 *   import { createTdsGeoServer } from '@tds/nextjs-integration/server';
 *   const tdsGeo = createTdsGeoServer({ apiKey: process.env.KIVO_API_KEY! });
 *   export const GET = tdsGeo.handlers.posts.GET;
 *   export const POST = tdsGeo.handlers.posts.POST;
 *
 *   // 4. Render your blog:
 *   import { TdsGeoBlogList } from '@tds/nextjs-integration/components';
 *   import { FileStorage } from '@tds/nextjs-integration/lib/storage';
 *
 *   export default async function BlogPage() {
 *     const storage = new FileStorage();
 *     const { posts, totalPages } = await storage.listPosts({ limit: 12 });
 *     return <TdsGeoBlogList posts={posts} totalPages={totalPages} />;
 *   }
 */

// Core types
export type {
  // Domain types
  TdsGeoArticle,
  TdsGeoPost,
  TdsGeoPostList,
  TdsGeoAuthor,
  TdsGeoArticleStatus,

  // Config
  TdsGeoConfig,

  // Storage
  StorageProvider,

  // API payloads
  TdsGeoWebhookPayload,
  TdsGeoApiResponse,
  CreatePostPayload,
  UpdatePostPayload,

  // Component props
  TdsGeoBlogListProps,
  TdsGeoBlogPostProps,
  TdsGeoContentProps,
} from './types';

// Lib modules
export { verifyRequest, verifyWebhookSignature } from './lib/auth';
export { FileStorage } from './lib/storage';
export {
  revalidateTdsGeoPost,
  revalidateAllTdsGeoContent,
  getTdsGeoTags,
  KIVO_TAG,
  KIVO_REVALIDATION_TAGS,
} from './lib/revalidation';
