'use client';

import React, { useState } from 'react';
import KozmoAIBlogListProps, KozmoAIPost } from '../types';

/**
 * KozmoAI Blog List — Reusable blog listing component.
 *
 * Renders a responsive grid of blog post cards with pagination.
 * Designed to be used in any Next.js page — just pass in the posts.
 *
 * @example
 *   import KozmoAIBlogList } from '@kozmo-ai/nextjs-integration/components';
 *
 *   export default async function BlogPage() {
 *     const { posts, totalPages } = await storage.listPosts({ limit: 12 });
 *     return <KozmoAIBlogList posts={posts} totalPages={totalPages} />;
 *   }
 */
export function KozmoAIBlogList({
  posts,
  totalPages = 1,
  currentPage = 1,
  basePath = '/blog',
  emptyMessage = 'No articles published yet.',
}: KozmoAIBlogListProps) {
  const [page, setPage] = useState(currentPage);

  if (!posts || posts.length === 0) {
    return (
      <div className="kozmo-ai-blog-list kozmo-ai-blog-list--empty">
        <div className="kozmo-ai-empty-state">
          <svg
            className="kozmo-ai-empty-icon"
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
          <p className="kozmo-ai-empty-text">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kozmo-ai-blog-list">
      <div className="kozmo-ai-blog-grid">
        {posts.map((post) => (
          <KozmoAIBlogCard key={post.localId} post={post} basePath={basePath} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="kozmo-ai-pagination" aria-label="Blog pagination">
          <button
            className="kozmo-ai-pagination-btn"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ← Previous
          </button>

          <span className="kozmo-ai-pagination-info">
            Page {page} of {totalPages}
          </span>

          <button
            className="kozmo-ai-pagination-btn"
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
 * Individual blog post card used inside KozmoAIBlogList.
 */
function KozmoAIBlogCard({
  post,
  basePath,
}: {
  post: KozmoAIPost;
  basePath: string;
}) {
  const [imgError, setImgError] = useState(false);
  const href = `${basePath}/${post.slug}`;

  const formattedDate = formatDate(post.publishedAt || post.createdAt);

  return (
    <article className="kozmo-ai-blog-card">
      <a href={href} className="kozmo-ai-blog-card-link">
        {post.featuredImageUrl && !imgError && (
          <div className="kozmo-ai-blog-card-image-wrapper">
            <img
              src={post.featuredImageUrl}
              alt={post.featuredImageAlt || post.title}
              className="kozmo-ai-blog-card-image"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <div className="kozmo-ai-blog-card-body">
          <h2 className="kozmo-ai-blog-card-title">{post.title}</h2>

          <p className="kozmo-ai-blog-card-excerpt">
            {post.excerpt ||
              stripHtml(post.metaDescription || post.content).slice(0, 160) + '…'}
          </p>

          <div className="kozmo-ai-blog-card-meta">
            <time dateTime={post.publishedAt || post.createdAt} className="kozmo-ai-blog-card-date">
              {formattedDate}
            </time>
            {post.tags && post.tags.length > 0 && (
              <div className="kozmo-ai-blog-card-tags">
                {post.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="kozmo-ai-tag">
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
