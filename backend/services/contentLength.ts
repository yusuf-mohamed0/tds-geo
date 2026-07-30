export const MIN_ARTICLE_WORDS = 1200;

export function countArticleWords(content: string | null | undefined): number {
  const plainText = (content || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[`*_~#[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText ? plainText.split(' ').filter(Boolean).length : 0;
}

export function getMinimumArticleWords(client?: { settings?: unknown }, requestedMinimum?: number): number {
  let settings: Record<string, unknown> = {};
  if (typeof client?.settings === 'string') {
    try {
      settings = JSON.parse(client.settings) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  } else if (client?.settings && typeof client.settings === 'object') {
    settings = client.settings as Record<string, unknown>;
  }

  const configuredMinimum = Number(settings.minWords ?? settings.min_words ?? requestedMinimum ?? process.env.CONTENT_MIN_WORDS);
  return Math.max(MIN_ARTICLE_WORDS, Number.isFinite(configuredMinimum) ? Math.floor(configuredMinimum) : MIN_ARTICLE_WORDS);
}

export function assertMinimumArticleLength(
  content: string | null | undefined,
  minimumWords: number,
  context = 'Article'
): number {
  const wordCount = countArticleWords(content);
  if (wordCount < minimumWords) {
    throw new Error(`${context} is too short: ${wordCount} words. Minimum required: ${minimumWords} words.`);
  }
  return wordCount;
}
