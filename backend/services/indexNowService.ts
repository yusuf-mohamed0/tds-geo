// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from '../utils/logger';

const INDEXNOW_URL = 'https://api.indexnow.org/indexnow';
const BING_URL = 'https://www.bing.com/indexnow';

export interface IndexNowConfig {
  host: string;
  key: string;
  keyLocation: string;
}

export async function pingIndexNow(urls: string[], config: IndexNowConfig): Promise<{ success: boolean; results: Array<{ engine: string; status: number }> }> {
  if (!urls.length || !config.host || !config.key) {
    logger.warn('IndexNow ping skipped: missing host or key', {
      hasHost: !!config.host,
      hasKey: !!config.key,
      urlCount: urls.length,
    });
    return { success: false, results: [] };
  }

  const payload = {
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation || `https://${config.host}/${config.key}.txt`,
    urlList: urls,
  };

  const engines = [
    { name: 'IndexNow', url: INDEXNOW_URL },
    { name: 'Bing', url: BING_URL },
  ];

  const results: Array<{ engine: string; status: number }> = [];

  for (const engine of engines) {
    try {
      const response = await fetch(engine.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      results.push({ engine: engine.name, status: response.status });
      if (response.ok) {
        logger.info(`IndexNow ping sent to ${engine.name}`, {
          urls: urls.length,
          status: response.status,
        });
      } else {
        logger.warn(`IndexNow ping returned non-OK from ${engine.name}`, {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (err) {
      logger.error(`IndexNow ping failed for ${engine.name}`, {
        error: (err as Error).message,
      });
      results.push({ engine: engine.name, status: 0 });
    }
  }

  return {
    success: results.some(r => r.status >= 200 && r.status < 300),
    results,
  };
}

export function getIndexNowConfig(): IndexNowConfig {
  return {
    host: process.env.INDEXNOW_HOST || '',
    key: process.env.INDEXNOW_KEY || '',
    keyLocation: process.env.INDEXNOW_KEY_LOCATION || '',
  };
}

export async function pingArticlePublished(articleUrl: string): Promise<void> {
  const config = getIndexNowConfig();
  if (!config.host || !config.key) {
    logger.debug('IndexNow not configured — skipping ping');
    return;
  }
  await pingIndexNow([articleUrl], config);
}

export async function pingBatchUrls(urls: string[]): Promise<void> {
  const config = getIndexNowConfig();
  if (!config.host || !config.key) {
    logger.debug('IndexNow not configured — skipping batch ping');
    return;
  }
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += 10000) {
    chunks.push(urls.slice(i, i + 10000));
  }
  for (const chunk of chunks) {
    await pingIndexNow(chunk, config);
  }
}

const indexNowService = {
  pingIndexNow,
  getIndexNowConfig,
  pingArticlePublished,
  pingBatchUrls,
};

export default indexNowService;
