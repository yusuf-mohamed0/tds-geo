/**
 * Vireon Next.js Integration — ISR Revalidation Helpers
 *
 * Provides helpers for triggering Next.js Incremental Static Regeneration (ISR)
 * when new content arrives from Vireon. Uses `revalidateTag` and `revalidatePath`
 * from `next/cache`.
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import type { VireonPost } from '../types';

/** Default revalidation tag for all Vireon content */
export const VIREON_TAG = 'vireon';

/**
 * Tags used for Vireon content. Add these to your page/layout fetch calls
 * to enable automatic revalidation when content changes.
 *
 * Example:
 *   // app/blog/page.tsx
 *   export default async function BlogPage() {
 *     const posts = await getPosts();
 *     return <BlogList posts={posts} />;
 *   }
 *
 *   // Enable ISR with Vireon tags:
 *   export const revalidate = 3600; // fallback revalidation
 *   // Or use generateStaticParams + revalidateTag
 */
export function getVireonTags(post?: VireonPost): string[] {
  const tags = [VIREON_TAG, `vireon-content`];
  if (post) {
    tags.push(`vireon-post-${post.localId}`);
    tags.push(`vireon-slug-${post.slug}`);
    for (const tag of post.tags) {
      tags.push(`vireon-tag-${tag}`);
    }
    for (const cat of post.categories || []) {
      tags.push(`vireon-cat-${cat}`);
    }
  }
  return tags;
}

/**
 * Trigger revalidation for a specific Vireon post.
 * Call this after creating, updating, or deleting a post.
 *
 * @param post The post that changed (or partial with localId, slug, tags)
 */
export function revalidateVireonPost(post: {
  localId: string;
  slug: string;
  tags?: string[];
  categories?: string[];
}): void {
  // Revalidate by tag
  revalidateTag(VIREON_TAG);
  revalidateTag(`vireon-post-${post.localId}`);
  revalidateTag(`vireon-slug-${post.slug}`);

  for (const tag of post.tags || []) {
    revalidateTag(`vireon-tag-${tag}`);
  }
  for (const cat of post.categories || []) {
    revalidateTag(`vireon-cat-${cat}`);
  }

  // Revalidate by path
  revalidatePath('/', 'layout');
}

/**
 * Trigger a full revalidation of all Vireon content.
 * Use sparingly — prefer targeted revalidation with revalidateVireonPost.
 */
export function revalidateAllVireonContent(): void {
  revalidateTag(VIREON_TAG);
  revalidateTag('vireon-content');
  revalidatePath('/', 'layout');
}

/**
 * Build a fetch cache config for use with `fetch` calls in Server Components.
 *
 * Example:
 *   const res = await fetch('https://...', {
 *     next: { tags: getVireonFetchTags() }
 *   });
 *
 * Or pass the tags directly to your data-fetching function:
 *   const posts = await storage.listPosts();
 *   // The tags are used by the page/layout's revalidateTag call
 */
export function getVireonFetchTags(post?: VireonPost): string[] {
  return getVireonTags(post);
}

/**
 * Add this to your page/layout to enable ISR with Vireon tags.
 *
 * Usage in page.tsx:
 *   export const dynamic = 'force-static';
 *   export const revalidate = 3600; // fallback every hour
 *
 *   // On your page component:
 *   import { VIREON_TAG } from '@vireon/nextjs-integration';
 *   export const fetchCache = 'default-cache';
 *
 * Then when Vireon pushes content, call revalidateVireonPost() and
 * the page will re-render on the next request.
 */
export const VIREON_REVALIDATION_TAGS = [VIREON_TAG, 'vireon-content'] as const;
