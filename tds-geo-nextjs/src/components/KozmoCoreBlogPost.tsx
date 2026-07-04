// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

'use client';

import React, { useState } from 'react';
import type { TdsGeoBlogPostProps } from '../types';
import { formatDate } from '../lib/utils';

/**
 * TDS Geo Blog Post — Renders a full blog post from TDS Geo.
 *
 * Handles featured images, author info, tags, share buttons,
 * and SEO metadata rendering.
 *
 * @example
 *   import { TdsGeoBlogPost } from '@tds-geo/nextjs-integration/components';
 *
 *   export default async function PostPage({ params }) {
 *     const post = await storage.getPostBySlug(params.slug);
 *     return <TdsGeoBlogPost post={post} showShareButtons />;
 *   }
 */
export function TdsGeoBlogPost({
  post,
  showFeaturedImage = true,
  showAuthor = true,
  showTags = true,
  showShareButtons = false,
}: TdsGeoBlogPostProps) {
  const [imgError, setImgError] = useState(false);

  const formattedDate = formatDate(post.publishedAt || post.createdAt);

  // Generate share URLs
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = encodeURIComponent(post.title);

  return (
    <article className="tds-geo-blog-post" itemScope itemType="https://schema.org/Article">
      {/* Header */}
      <header className="tds-geo-blog-post-header">
        <h1 className="tds-geo-blog-post-title" itemProp="headline">
          {post.title}
        </h1>

        <div className="tds-geo-blog-post-meta">
          <time
            dateTime={post.publishedAt || post.createdAt}
            className="tds-geo-blog-post-date"
            itemProp="datePublished"
          >
            {formattedDate}
          </time>

          {post.author && showAuthor && (
            <div className="tds-geo-blog-post-author" itemProp="author" itemScope itemType="https://schema.org/Person">
              {post.author.avatarUrl && (
                <img
                  src={post.author.avatarUrl}
                  alt={post.author.name}
                  className="tds-geo-author-avatar"
                  width={32}
                  height={32}
                />
              )}
              <span itemProp="name">{post.author.name}</span>
            </div>
          )}

          {post.wordCount && (
            <span className="tds-geo-reading-time">
              {Math.ceil(post.wordCount / 200)} min read
            </span>
          )}
        </div>
      </header>

      {/* Featured Image */}
      {showFeaturedImage && post.featuredImageUrl && !imgError && (
        <div className="tds-geo-blog-post-image-wrapper">
          <img
            src={post.featuredImageUrl}
            alt={post.featuredImageAlt || post.title}
            className="tds-geo-blog-post-image"
            itemProp="image"
            onError={() => setImgError(true)}
          />
          {post.featuredImageAlt && (
            <span className="tds-geo-image-caption">{post.featuredImageAlt}</span>
          )}
        </div>
      )}

      {/* Content */}
      <div
        className="tds-geo-blog-post-content"
        itemProp="articleBody"
        dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
      />

      {/* Tags */}
      {showTags && post.tags && post.tags.length > 0 && (
        <div className="tds-geo-blog-post-tags">
          <h3 className="tds-geo-tags-heading">Tags:</h3>
          <div className="tds-geo-tags-list">
            {post.tags.map((tag) => (
              <span key={tag} className="tds-geo-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Share Buttons */}
      {showShareButtons && (
        <div className="tds-geo-share-buttons">
          <h3 className="tds-geo-share-heading">Share this article:</h3>
          <div className="tds-geo-share-links">
            {/* Twitter/X */}
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tds-geo-share-btn tds-geo-share-twitter"
              aria-label="Share on Twitter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tds-geo-share-btn tds-geo-share-linkedin"
              aria-label="Share on LinkedIn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>

            {/* Copy link */}
            <button
              className="tds-geo-share-btn tds-geo-share-copy"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl)
                  .catch(() => {});
              }}
              aria-label="Copy link"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Schema.org metadata (invisible) */}
      <meta itemProp="description" content={post.metaDescription || post.excerpt || ''} />
      <meta itemProp="dateModified" content={post.updatedAt} />
    </article>
  );
}

/**
 * Render markdown or HTML content.
 * Since TDS Geo provides markdown, we do a simple conversion to HTML.
 * For production, use a proper markdown library like `react-markdown`.
 */
function renderContent(content: string): string {
  if (!content) return '';

  // If it already contains HTML tags, render as-is
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }

  // Simple markdown-to-HTML conversion
  return content
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Line breaks within paragraphs
    .replace(/\n/g, '<br />')
    // Wrap in paragraph
    .replace(/^(.+)$/s, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
}


