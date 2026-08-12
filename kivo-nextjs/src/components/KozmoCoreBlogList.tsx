// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

'use client';

import React, { useState } from 'react';
import type { TdsGeoBlogListProps, TdsGeoPost } from '../types';

/**
 * Kivo Geo Blog List - Reusable blog listing component.
 *
 * Renders a responsive grid of blog post cards with pagination.
 * Designed to be used in any Next.js page — just pass in the posts.
 *
 * @example
 *   import { TdsGeoBlogList } from '@tds/nextjs-integration/components';
 *
 *   export default async function BlogPage() {
 *     const { posts, totalPages } = await storage.listPosts({ limit: 12 });
 *     return <TdsGeoBlogList posts={posts} totalPages={totalPages} />;
 *   }
 */
export function TdsGeoBlogList({
  posts,
  totalPages = 1,
  currentPage = 1,
  basePath = '/blog',
  emptyMessage = 'No articles published yet.',
}: TdsGeoBlogListProps) {
  const [page, setPage] = useState(currentPage);

  if (!posts || posts.length === 0) {
    return (
      <div className="kivo-blog-list kivo-blog-list--empty">
        <div className="kivo-empty-state">
          <svg
            className="kivo-empty-icon"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="kivo-empty-text">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kivo-blog-list">
      <div className="kivo-blog-grid">
        {posts.map((post) => (
          <TdsGeoBlogCard key={post.localId} post={post} basePath={basePath} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="kivo-pagination" aria-label="Blog pagination">
          <button
            className="kivo-pagination-btn"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ← Previous
          </button>

          <span className="kivo-pagination-info">
            Page {page} of {totalPages}
          </span>

          <button
            className="kivo-pagination-btn"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}

/**
 * Individual blog post card used inside TdsGeoBlogList.
 */
function TdsGeoBlogCard({
  post,
  basePath,
}: {
  post: TdsGeoPost;
  basePath: string;
}) {
  const [imgError, setImgError] = useState(false);
  const href = `${basePath}/${post.slug}`;

  const formattedDate = formatDate(post.publishedAt || post.createdAt);

  return (
    <article className="kivo-blog-card">
      <a href={href} className="kivo-blog-card-link">
        {post.featuredImageUrl && !imgError && (
          <div className="kivo-blog-card-image-wrapper">
            <img
              src={post.featuredImageUrl}
              alt={post.featuredImageAlt || post.title}
              className="kivo-blog-card-image"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <div className="kivo-blog-card-body">
          <h2 className="kivo-blog-card-title">{post.title}</h2>

          <p className="kivo-blog-card-excerpt">
            {post.excerpt ||
              stripHtml(post.metaDescription || post.content).slice(0, 160) + '…'}
          </p>

          <div className="kivo-blog-card-meta">
            <time dateTime={post.publishedAt || post.createdAt} className="kivo-blog-card-date">
              {formattedDate}
            </time>
            {post.tags && post.tags.length > 0 && (
              <div className="kivo-blog-card-tags">
                {post.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="kivo-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}

// ══════════════════════════════════════════════════════════════════
// UTILITIES — imported from shared utils
// ══════════════════════════════════════════════════════════════════

import { formatDate, stripHtml } from '../lib/utils';
