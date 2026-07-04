// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import React from 'react';
import type { TdsGeoContentProps } from '../types';

/**
 * TDS Geo Content — Renders TDS Geo article content with basic styling.
 *
 * Safely renders markdown-or-HTML content into a styled container.
 * Works in both client and server components.
 *
 * @example
 *   import { TdsGeoContent } from '@tds-geo/nextjs-integration/components';
 *
 *   <TdsGeoContent content={post.content} className="prose" />
 */
export function TdsGeoContent({ content, className = '' }: TdsGeoContentProps) {
  if (!content) {
    return null;
  }

  // If content contains HTML, render it directly
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    return (
      <div
        className={`tds-geo-content ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Render markdown as simple HTML
  const rendered = renderMarkdown(content);

  return (
    <div
      className={`tds-geo-content tds-geo-content--markdown ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

/**
 * Simple markdown-to-HTML renderer.
 * For production, use react-markdown for full GFM support.
 */
function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML tags in markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Horizontal rules
    .replace(/^---+/gm, '<hr />')
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // Unordered list items
    .replace(/^[\s]*[-*+][\s]+(.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^[\s]*\d+\.[\s]+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul> or <ol>
  html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, (match) => {
    // If any item starts with a number pattern, it's an ordered list
    const lines = match.split('\n').filter(Boolean);
    const isOrdered = lines.some(l => /^\d+\./.test(l.trim()));
    const tag = isOrdered ? 'ol' : 'ul';
    return `<${tag}>\n${match}\n</${tag}>`;
  });

  // Paragraphs (double newlines that aren't inside other block elements)
  html = html.replace(/\n\n/g, '</p><p>');

  // Single newlines become line breaks
  html = html.replace(/\n/g, '<br />');

  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>';
  }

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  // Clean up nested paragraph issues
  html = html.replace(/<\/p>\s*<p>/g, '</p>\n<p>');

  return html;
}
