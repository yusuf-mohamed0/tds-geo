/**
 * KOZMO Core Next.js Integration — ISR Revalidation Helpers
 *
 * Provides helpers for triggering Next.js Incremental Static Regeneration (ISR)
 * when new content arrives from KOZMO Core. Uses `revalidateTag` and `revalidatePath`
 * from `next/cache`.
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import type { KozmoCorePost } from '../types';

/** Default revalidation tag for all KOZMO Core content */
export const KOZMO_CORE_TAG = 'kozmo-core';

/**
 * Tags used for KOZMO Core content. Add these to your page/layout fetch calls
 * to enable automatic revalidation when content changes.
 *
 * Example:
 *   // app/blog/page.tsx
 *   export default async function BlogPage() {
 *     const posts = await getPosts();
 *     return <BlogList posts={posts} />;
 *   }
 *
 *   // Enable ISR with KOZMO Core tags:
 *   export const revalidate = 3600; // fallback revalidation
 *   // Or use generateStaticParams + revalidateTag
 */
export function getKozmoCoreTags(post?: KozmoCorePost): string[] {
  const tags = [KOZMO_CORE_TAG, `kozmo-core-content`];
  if (post) {
    tags.push(`kozmo-core-post-${post.localId}`);
    tags.push(`kozmo-core-slug-${post.slug}`);
    for (const tag of post.tags) {
      tags.push(`kozmo-core-tag-${tag}`);
    }
    for (const cat of post.categories || []) {
      tags.push(`kozmo-core-cat-${cat}`);
    }
  }
  return tags;
}

/**
 * Trigger revalidation for a specific KOZMO Core post.
 * Call this after creating, updating, or deleting a post.
 *
 * @param post The post that changed (or partial with localId, slug, tags)
 */
export function revalidateKozmoCorePost(post: {
  localId: string;
  slug: string;
  tags?: string[];
  categories?: string[];
}): void {
  // Revalidate by tag
  revalidateTag(KOZMO_CORE_TAG);
  revalidateTag(`kozmo-core-post-${post.localId}`);
  revalidateTag(`kozmo-core-slug-${post.slug}`);

  for (const tag of post.tags || []) {
    revalidateTag(`kozmo-core-tag-${tag}`);
  }
  for (const cat of post.categories || []) {
    revalidateTag(`kozmo-core-cat-${cat}`);
  }

  // Revalidate by path
  revalidatePath('/', 'layout');
}

/**
 * Trigger a full revalidation of all KOZMO Core content.
 * Use sparingly — prefer targeted revalidation with revalidateKozmoCorePost.
 */
export function revalidateAllKozmoCoreContent(): void {
  revalidateTag(KOZMO_CORE_TAG);
  revalidateTag('kozmo-core-content');
  revalidatePath('/', 'layout');
}

/**
 * Build a fetch cache config for use with `fetch` calls in Server Components.
 *
 * Example:
 *   const res = await fetch('https://...', {
 *     next: { tags: getKozmoCoreFetchTags() }
 *   });
 *
 * Or pass the tags directly to your data-fetching function:
 *   const posts = await storage.listPosts();
 *   // The tags are used by the page/layout's revalidateTag call
 */
export function getKozmoCoreFetchTags(post?: KozmoCorePost): string[] {
  return getKozmoCoreTags(post);
}

/**
 * Add this to your page/layout to enable ISR with KOZMO Core tags.
 *
 * Usage in page.tsx:
 *   export const dynamic = 'force-static';
 *   export const revalidate = 3600; // fallback every hour
 *
 *   // On your page component:
 *   import { KOZMO_CORE_TAG } from '@kozmo-core/nextjs-integration';
 *   export const fetchCache = 'default-cache';
 *
 * Then when KOZMO Core pushes content, call revalidateKozmoCorePost() and
 * the page will re-render on the next request.
 */
export const KOZMO_CORE_REVALIDATION_TAGS = [KOZMO_CORE_TAG, 'kozmo-core-content'] as const;
