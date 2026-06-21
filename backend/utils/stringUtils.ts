// ══════════════════════════════════════════════════════════════════
// TDS Geo — Shared String Utilities
//
// Single source of truth for common string operations
// previously duplicated across services.
// ══════════════════════════════════════════════════════════════════

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
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}
