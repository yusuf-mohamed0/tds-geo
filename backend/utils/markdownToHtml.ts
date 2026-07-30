// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Markdown to Shopify-Compatible HTML Converter
// ──────────────────────────────────────────────

import { logger } from './logger';

let marked: any = {};
try {
  const mod = require('marked');
  marked = mod;
  if (marked.use) {
    marked.use({ breaks: false, gfm: true });
  }
} catch {
  logger.warn('marked package not available — markdown features disabled');
}

interface ConvertOptions {
  shiftHeadings?: boolean;
  addTableClass?: boolean;
}

/**
 * Convert Markdown to Shopify-compatible HTML.
 */
function convert(markdown: string, options: ConvertOptions = {}): string {
  const {
    shiftHeadings = true,
    addTableClass = true
  } = options;

  if (!markdown || typeof markdown !== 'string') {
    logger.warn('Invalid markdown input — returning empty string');
    return '';
  }

  try {
    let html = marked.parse(markdown) as string;

    // Shopify renders the article title itself. Remove a leading Markdown H1
    // so it is not duplicated in the body, while leaving section headings intact.
    if (shiftHeadings) {
      html = html.replace(/^<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '');
    }

    // Add responsive table wrappers
    if (addTableClass) {
      html = html.replace(/<table>/gi, '<table class="shopify-table">');
    }

    // Strip dangerous tags
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    html = html.replace(/on\w+="[^"]*"/gi, '');
    html = html.replace(/on\w+='[^']*'/gi, '');

    // Clean excessive whitespace
    html = html.replace(/\n{3,}/g, '\n\n');

    return html.trim();
  } catch (err) {
    logger.error('Markdown-to-HTML conversion failed', { error: (err as Error).message });
    // Fallback: return basic paragraph-wrapped text
    return `<p>${markdown.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  }
}

/**
 * Extract plain text from markdown (for meta descriptions, excerpts).
 */
function extractPlainText(markdown: string, maxLength: number = 160): string {
  if (!markdown) return '';
  try {
    const html = marked.parse(markdown) as string;
    const text = html
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
  } catch {
    return markdown.slice(0, maxLength);
  }
}

export { convert, extractPlainText };
