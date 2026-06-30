import { logger } from '../utils/logger';
import { addJob, QueueNames, getJobStatus } from '../utils/queue';
import openaiService from './openai';
import costTracker from './costTracker';
import { GeneratedArticle } from '../types';

const REDIS_AVAILABLE = !!process.env.REDIS_URL;

export interface GenerateResult {
  article?: GeneratedArticle;
  jobId?: string;
  queued: boolean;
}

/**
 * Generate content — enqueues to BullMQ if Redis is available,
 * otherwise falls back to direct OpenAI call.
 */
export async function generateContent(
  clientId: string,
  keyword: string,
  options: {
    tone?: string;
    minWords?: number;
    maxWords?: number;
    clientSettings?: Record<string, unknown>;
  } = {}
): Promise<GenerateResult> {
  if (!REDIS_AVAILABLE) {
    logger.info('Pipeline: Redis unavailable, calling OpenAI directly', { clientId, keyword });
    const article = await openaiService.generateBlogPost({
      keyword,
      tone: options.tone || 'educational',
      minWords: options.minWords || 1200,
      maxWords: options.maxWords || 2500,
      clientSettings: options.clientSettings || {},
    });

    trackCost(clientId, article);
    return { article, queued: false };
  }

  logger.info('Pipeline: Enqueuing content generation job', { clientId, keyword });
  const job = await addJob(QueueNames.CONTENT_GENERATION, `generate:${keyword}`, {
    clientId,
    keyword,
    tone: options.tone,
    minWords: options.minWords,
    maxWords: options.maxWords,
    clientSettings: options.clientSettings,
  });

  return { jobId: job.id!, queued: true };
}

function trackCost(clientId: string, article: GeneratedArticle): void {
  if (article.metadata) {
    const { tokensIn = 0, tokensOut = 0, model = 'gpt-4o' } = article.metadata as any;
    const cost = costTracker.calculateOpenAICost(model, tokensIn, tokensOut);
    costTracker.recordCost({
      client_id: clientId,
      provider: 'openai',
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: cost,
    }).catch(() => {});
  }
}

export async function getJobResult(jobId: string): Promise<{
  status: 'pending' | 'completed' | 'failed' | 'not_found';
  result?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const job = await getJobStatus(QueueNames.CONTENT_GENERATION, jobId);
    if (!job) return { status: 'not_found' };

    const state = await job.getState();
    if (state === 'completed') {
      return { status: 'completed', result: job.returnvalue as Record<string, unknown> };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason };
    }
    return { status: 'pending' };
  } catch (err) {
    return { status: 'not_found', error: (err as Error).message };
  }
}
