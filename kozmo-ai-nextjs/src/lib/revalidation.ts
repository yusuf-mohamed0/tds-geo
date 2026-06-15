/**
 * KozmoAI Next.js Integration — ISR Revalidation Helpers
 *
 * Provides helpers for triggering Next.js Incremental Static Regeneration (ISR)
 * when new content arrives from KozmoAI. Uses `revalidateTag` and `revalidatePath`
 * from `next/cache`.
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import type { KozmoAIPost } from '../types';

/** Default revalidation tag for all KozmoAI content */
export const KOZMO_AI_TAG = 'kozmo-ai';

/**
 * Tags used for KozmoAI content. Add these to your page/layout fetch calls
 * to enable automatic revalidation when content changes.
 *
 * Example:
 *   // app/blog/page.tsx
 *   export default async function BlogPage() {
 *     const posts = await getPosts();
 *     return <BlogList posts={posts} />;
 *   }
 *
 *   // Enable ISR with KozmoAI tags:
 *   export const revalidate = 3600; // fallback revalidation
 *   // Or use generateStaticParams + revalidateTag
 */
export function getKozmoAITags(post?: KozmoAIPost): string[] {
  const tags = [KOZMO_AI_TAG, `kozmo-ai-content`];
  if (post) {
    tags.push(`kozmo-ai-post-${post.localId}`);
    tags.push(`kozmo-ai-slug-${post.slug}`);
    for (const tag of post.tags) {
      tags.push(`kozmo-ai-tag-${tag}`);
    }
    for (const cat of post.categories || []) {
      tags.push(`kozmo-ai-cat-${cat}`);
    }
  }
  return tags;
}

/**
 * Trigger revalidation for a specific KozmoAI post.
 * Call this after creating, updating, or deleting a post.
 *
 * @param post The post that changed (or partial with localId, slug, tags)
 */
export function revalidateKozmoAIPost(post: {
  localId: string;
  slug: string;
  tags?: string[];
  categories?: string[];
}): void {
  // Revalidate by tag
  revalidateTag(KOZMO_AI_TAG);
  revalidateTag(`kozmo-ai-post-${post.localId}`);
  revalidateTag(`kozmo-ai-slug-${post.slug}`);

  for (const tag of post.tags || []) {
    revalidateTag(`kozmo-ai-tag-${tag}`);
  }
  for (const cat of post.categories || []) {
    revalidateTag(`kozmo-ai-cat-${cat}`);
  }

  // Revalidate by path
  revalidatePath('/', 'layout');
}

/**
 * Trigger a full revalidation of all KozmoAI content.
 * Use sparingly — prefer targeted revalidation with revalidateKozmoAIPost.
 */
export function revalidateAllKozmoAIContent(): void {
  revalidateTag(KOZMO_AI_TAG);
  revalidateTag('kozmo-ai-content');
  revalidatePath('/', 'layout');
}

/**
 * Build a fetch cache config for use with `fetch` calls in Server Components.
 *
 * Example:
 *   const res = await fetch('https://...', {
 *     next: { tags: getKozmoAIFetchTags() }
 *   });
 *
 * Or pass the tags directly to your data-fetching function:
 *   const posts = await storage.listPosts();
 *   // The tags are used by the page/layout's revalidateTag call
 */
export function getKozmoAIFetchTags(post?: KozmoAIPost): string[] {
  return getKozmoAITags(post);
}

/**
 * Add this to your page/layout to enable ISR with KozmoAI tags.
 *
 * Usage in page.tsx:
 *   export const dynamic = 'force-static';
 *   export const revalidate = 3600; // fallback every hour
 *
 *   // On your page component:
 *   import { KOZMO_AI_TAG } from '@kozmo-ai/nextjs-integration';
 *   export const fetchCache = 'default-cache';
 *
 * Then when KozmoAI pushes content, call revalidateKozmoAIPost() and
 * the page will re-render on the next request.
 */
export const KOZMO_AI_REVALIDATION_TAGS = [KOZMO_AI_TAG, 'kozmo-ai-content'] as const;
