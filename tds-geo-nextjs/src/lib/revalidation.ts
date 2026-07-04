// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * TDS Geo Next.js Integration — ISR Revalidation Helpers
 *
 * Provides helpers for triggering Next.js Incremental Static Regeneration (ISR)
 * when new content arrives from TDS Geo. Uses `revalidateTag` and `revalidatePath`
 * from `next/cache`.
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import type { TdsGeoPost } from '../types';

/** Default revalidation tag for all TDS Geo content */
export const TDS_GEO_TAG = 'tds-geo';

/**
 * Tags used for TDS Geo content. Add these to your page/layout fetch calls
 * to enable automatic revalidation when content changes.
 *
 * Example:
 *   // app/blog/page.tsx
 *   export default async function BlogPage() {
 *     const posts = await getPosts();
 *     return <BlogList posts={posts} />;
 *   }
 *
 *   // Enable ISR with TDS Geo tags:
 *   export const revalidate = 3600; // fallback revalidation
 *   // Or use generateStaticParams + revalidateTag
 */
export function getTdsGeoTags(post?: TdsGeoPost): string[] {
  const tags = [TDS_GEO_TAG, `tds-geo-content`];
  if (post) {
    tags.push(`tds-geo-post-${post.localId}`);
    tags.push(`tds-geo-slug-${post.slug}`);
    for (const tag of post.tags) {
      tags.push(`tds-geo-tag-${tag}`);
    }
    for (const cat of post.categories || []) {
      tags.push(`tds-geo-cat-${cat}`);
    }
  }
  return tags;
}

/**
 * Trigger revalidation for a specific TDS Geo post.
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
  revalidateTag(TDS_GEO_TAG);
  revalidateTag(`tds-geo-post-${post.localId}`);
  revalidateTag(`tds-geo-slug-${post.slug}`);

  for (const tag of post.tags || []) {
    revalidateTag(`tds-geo-tag-${tag}`);
  }
  for (const cat of post.categories || []) {
    revalidateTag(`tds-geo-cat-${cat}`);
  }

  // Revalidate by path
  revalidatePath('/', 'layout');
}

/**
 * Trigger a full revalidation of all TDS Geo content.
 * Use sparingly — prefer targeted revalidation with revalidateTdsGeoPost.
 */
export function revalidateAllTdsGeoContent(): void {
  revalidateTag(TDS_GEO_TAG);
  revalidateTag('tds-geo-content');
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
 * Add this to your page/layout to enable ISR with TDS Geo tags.
 *
 * Usage in page.tsx:
 *   export const dynamic = 'force-static';
 *   export const revalidate = 3600; // fallback every hour
 *
 *   // On your page component:
 *   import { TDS_GEO_TAG } from '@tds-geo/nextjs-integration';
 *   export const fetchCache = 'default-cache';
 *
 * Then when TDS Geo pushes content, call revalidateTdsGeoPost() and
 * the page will re-render on the next request.
 */
export const TDS_GEO_REVALIDATION_TAGS = [TDS_GEO_TAG, 'tds-geo-content'] as const;
