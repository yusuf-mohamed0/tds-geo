// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * Kivo Geo Next.js Integration - ISR Revalidation Helpers
 *
 * Provides helpers for triggering Next.js Incremental Static Regeneration (ISR)
 * when new content arrives from Kivo Geo. Uses `revalidateTag` and `revalidatePath`
 * from `next/cache`.
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import type { TdsGeoPost } from '../types';

/** Default revalidation tag for all Kivo Geo content */
export const KIVO_TAG = 'kivo';

/**
 * Tags used for Kivo Geo content. Add these to your page/layout fetch calls
 * to enable automatic revalidation when content changes.
 *
 * Example:
 *   // app/blog/page.tsx
 *   export default async function BlogPage() {
 *     const posts = await getPosts();
 *     return <BlogList posts={posts} />;
 *   }
 *
 *   // Enable ISR with Kivo Geo tags:
 *   export const revalidate = 3600; // fallback revalidation
 *   // Or use generateStaticParams + revalidateTag
 */
export function getTdsGeoTags(post?: TdsGeoPost): string[] {
  const tags = [KIVO_TAG, `kivo-content`];
  if (post) {
    tags.push(`kivo-post-${post.localId}`);
    tags.push(`kivo-slug-${post.slug}`);
    for (const tag of post.tags) {
      tags.push(`kivo-tag-${tag}`);
    }
    for (const cat of post.categories || []) {
      tags.push(`kivo-cat-${cat}`);
    }
  }
  return tags;
}

/**
 * Trigger revalidation for a specific Kivo Geo post.
 * Call this after creating, updating, or deleting a post.
 *
 * @param post The post that changed (or partial with localId, slug, tags)
 */
export function revalidateTdsGeoPost(post: {
  localId: string;
  slug: string;
  tags?: string[];
  categories?: string[];
}): void {
  // Revalidate by tag
  revalidateTag(KIVO_TAG);
  revalidateTag(`kivo-post-${post.localId}`);
  revalidateTag(`kivo-slug-${post.slug}`);

  for (const tag of post.tags || []) {
    revalidateTag(`kivo-tag-${tag}`);
  }
  for (const cat of post.categories || []) {
    revalidateTag(`kivo-cat-${cat}`);
  }

  // Revalidate by path
  revalidatePath('/', 'layout');
}

/**
 * Trigger a full revalidation of all Kivo Geo content.
 * Use sparingly — prefer targeted revalidation with revalidateTdsGeoPost.
 */
export function revalidateAllTdsGeoContent(): void {
  revalidateTag(KIVO_TAG);
  revalidateTag('kivo-content');
  revalidatePath('/', 'layout');
}

/**
 * Build a fetch cache config for use with `fetch` calls in Server Components.
 *
 * Example:
 *   const res = await fetch('https://...', {
 *     next: { tags: getTdsGeoFetchTags() }
 *   });
 *
 * Or pass the tags directly to your data-fetching function:
 *   const posts = await storage.listPosts();
 *   // The tags are used by the page/layout's revalidateTag call
 */
export function getTdsGeoFetchTags(post?: TdsGeoPost): string[] {
  return getTdsGeoTags(post);
}

/**
 * Add this to your page/layout to enable ISR with Kivo Geo tags.
 *
 * Usage in page.tsx:
 *   export const dynamic = 'force-static';
 *   export const revalidate = 3600; // fallback every hour
 *
 *   // On your page component:
 *   import { KIVO_TAG } from '@tds/nextjs-integration';
 *   export const fetchCache = 'default-cache';
 *
 * Then when Kivo Geo pushes content, call revalidateTdsGeoPost() and
 * the page will re-render on the next request.
 */
export const KIVO_REVALIDATION_TAGS = [KIVO_TAG, 'kivo-content'] as const;
