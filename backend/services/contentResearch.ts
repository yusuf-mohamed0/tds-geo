import { logger } from '../utils/logger';

const CRAWL4AI_URL = process.env.CRAWL4AI_URL || '';

export interface CompetitorContent {
  url: string;
  title: string;
  markdown: string;
  metadata: Record<string, any>;
}

async function callCrawl4AI(url: string): Promise<CompetitorContent | null> {
  if (!CRAWL4AI_URL) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${CRAWL4AI_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [url],
        crawler_config: { word_count_threshold: 10, cache_mode: 'bypass' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data: any = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

    const rawMd = typeof result.markdown === 'string'
      ? result.markdown
      : result.markdown?.raw_markdown || '';

    return {
      url: result.url || url,
      title: result.metadata?.title || '',
      markdown: rawMd.slice(0, 5000),
      metadata: result.metadata || {},
    };
  } catch {
    return null;
  }
}

export async function crawlCompetitors(keyword: string): Promise<CompetitorContent[]> {
  if (!CRAWL4AI_URL) return [];

  try {
    const query = encodeURIComponent(keyword);
    const searchUrl = `https://www.google.com/search?q=${query}`;
    const result = await callCrawl4AI(searchUrl);
    if (!result) return [];

    const urls = extractUrls(result.markdown).slice(0, 3);
    const results = await Promise.all(urls.map(u => callCrawl4AI(u)));
    return results.filter((r): r is CompetitorContent => r !== null);
  } catch {
    return [];
  }
}

export async function extractWebsiteIntelligence(url: string): Promise<string> {
  if (!CRAWL4AI_URL) return '';

  const result = await callCrawl4AI(url);
  if (!result) return '';

  return [
    `URL: ${result.url}`,
    `Title: ${result.title}`,
    ``,
    result.markdown,
  ].join('\n');
}

function extractUrls(markdown: string): string[] {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const matches = markdown.match(urlRegex) || [];
  return [...new Set(matches)]
    .filter(u => {
      try {
        const parsed = new URL(u);
        return ['http:', 'https:'].includes(parsed.protocol)
          && !parsed.hostname.includes('google')
          && !parsed.hostname.includes('youtube');
      } catch {
        return false;
      }
    });
}
