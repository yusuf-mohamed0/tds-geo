/**
 * TDS Geo Next.js Integration — Shared Utilities
 */

/**
 * Convert a string to a URL-friendly slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')    // Remove non-word chars
    .replace(/[\s_]+/g, '-')      // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .slice(0, 200);
}

/**
 * Safely format a date string into a human-readable format.
 */
export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Strip HTML tags from a string.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
