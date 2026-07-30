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
