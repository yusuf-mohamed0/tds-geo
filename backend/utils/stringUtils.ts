// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// KOZMO Core — Shared String Utilities
//
// Single source of truth for common string operations
// previously duplicated across services.
// ══════════════════════════════════════════════════════════════════

import limax from 'limax';

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countKeywordOccurrences(content: string, keyword: string): number {
  const escaped = escapeRegExp(keyword);
  const regex = new RegExp(escaped, 'gi');
  return (content.match(regex) || []).length;
}

export function splitSentences(text: string, minLength: number = 0): string[] {
  return text.split(/[.!?]+/).filter(s => s.trim().length > minLength);
}

export function generateSlug(title: string, maxLength: number = 200): string {
  // Strip HTML tags and smart quotes before transliteration
  const cleaned = title
    .toString()
    .replace(/<[^>]*>/g, '')        // Strip HTML tags
    .replace(/['']/g, '');          // Remove smart quotes

  // Use limax for transliteration (handles non-Latin scripts like Arabic, Japanese, etc.)
  let slug = limax(cleaned, { separator: '-' });

  // Collapse multiple hyphens and trim leading/trailing hyphens
  slug = slug
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return slug.substring(0, maxLength);
}

/**
 * Truncate a string to at most `maxLength` characters, appending a single
 * ellipsis character ("…") when the input is longer than the limit.
 *
 * The returned length is always <= maxLength (the ellipsis counts toward the
 * limit). Used for Shopify SEO metafields: title tag (max 70) and meta
 * description tag (max 160).
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
  const value = String(text ?? '').trim();
  // Code-point-aware: splitting on Array.from() keeps surrogate pairs (emoji,
  // CJK extension characters, etc.) intact so truncation never produces a
  // lone surrogate. The result is always <= maxLength *code points*.
  const codePoints = Array.from(value);
  if (codePoints.length <= maxLength) return value;
  if (maxLength <= 1) return '\u2026'.slice(0, maxLength);
  const truncated = codePoints.slice(0, maxLength - 1).join('').trimEnd();
  return truncated + '\u2026';
}

/**
 * Strip HTML tags and decode common entities, collapsing whitespace to a
 * single space. Produces plain text suitable for SEO meta descriptions and
 * article summaries.
 */
export function stripHtmlTags(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a plain-text excerpt of at most `maxLength` characters from an
 * HTML body. Falls back to the meta description or empty string when no
 * HTML is available. Used for Shopify `summary_html` (~200 chars) and the
 * auto-extracted meta description tag (max 160).
 */
export function generateExcerptFromHtml(html: string, maxLength: number = 200, fallback: string = ''): string {
  const clean = stripHtmlTags(html);
  if (clean) return truncateWithEllipsis(clean, maxLength);
  return truncateWithEllipsis(fallback, maxLength);
}
