// ──────────────────────────────────────────────
// BullMQ Queue System (replaces Bottleneck)
// Production-grade distributed job queues
// ──────────────────────────────────────────────

import { Queue, Worker, Job, JobsOptions } from 'bullmq';
import Redis, { Redis as RedisInterface } from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ─── Redis Connection ─────────────────────────

let connection: Redis | null = null;

function getConnection(): Redis {
  if (!connection) {
    connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times: number) {
        if (times > 10) return null; // Give up after 10 retries
        return Math.min(times * 200, 5000); // Backoff up to 5s
      }
    });

    connection.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });

    connection.on('ready', () => {
      logger.info('Redis connection established');
    });
  }
  return connection;
}

// ─── Queue Definitions ────────────────────────

export enum QueueNames {
  CONTENT_GENERATION = 'content-generation',
  KEYWORD_RESEARCH = 'keyword-research',
  SHOPIFY_PUBLISH = 'shopify-publish',
  IMAGE_GENERATION = 'image-generation',
  SEO_ANALYSIS = 'seo-analysis',
  INTERNAL_LINKING = 'internal-linking',
  WEBHOOK_DELIVERY = 'webhook-delivery',
  DEFAULT = 'default',
  // ── Enterprise Queues ──
  FACT_CHECK = 'fact-check',
  BRAND_VOICE = 'brand-voice',
  SEO_INTELLIGENCE = 'seo-intelligence',
  MULTI_CMS_PUBLISH = 'multi-cms-publish',
  PEXELS_IMAGE = 'pexels-image',
  COST_OPTIMIZATION = 'cost-optimization',
  EDITORIAL_WORKFLOW = 'editorial-workflow',
  CONTENT_INTELLIGENCE = 'content-intelligence',
  AI_EVALUATION = 'ai-evaluation',
  OBSERVABILITY = 'observability',
  // ── Client Scraper Queues ──
  CLIENT_SCAN = 'client-scan',
  BATCH_CLIENT_SCAN = 'batch-client-scan',
  // ── Odoo ERP Integration Queues ──
  ODOO_SYNC = 'odoo-sync',
  ODOO_BATCH_SYNC = 'odoo-batch-sync',
  ODOO_WEBHOOK = 'odoo-webhook'
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: {
    age: 7 * 24 * 3600, // Keep for 7 days
    count: 1000
  },
  removeOnFail: {
    age: 30 * 24 * 3600 // Keep failed for 30 days
  }
};

/**
 * Create or get a BullMQ queue.
 */
function createQueue(name: QueueNames): Queue {
  return new Queue(name, {
    connection: getConnection() as any,
    defaultJobOptions: { ...defaultJobOptions }
  });
}

// Singleton queues
const queues = new Map<QueueNames, Queue>();

function getQueue(name: QueueNames): Queue {
  if (!queues.has(name)) {
    queues.set(name, createQueue(name));
    logger.info(`Queue created: ${name}`);
  }
  return queues.get(name)!;
}

// ─── Job Producers ────────────────────────────

interface QueueJobPayload {
  [key: string]: unknown;
  clientId?: string;
  articleId?: string;
  keywordId?: string;
}

async function addJob(
  queueName: QueueNames,
  jobName: string,
  payload: QueueJobPayload,
  options?: JobsOptions
): Promise<Job> {
  const queue = getQueue(queueName);
  const job = await queue.add(jobName, payload, {
    ...defaultJobOptions,
    ...options
  });

  logger.debug(`Job added to ${queueName}`, {
    jobId: job.id,
    jobName,
    clientId: payload.clientId
  });

  return job;
}

async function getJobStatus(queueName: QueueNames, jobId: string): Promise<Job | undefined> {
  const queue = getQueue(queueName);
  return queue.getJob(jobId);
}

// ─── Worker Factory ───────────────────────────

type JobHandler = (job: Job) => Promise<unknown>;

/**
 * Create a worker for a queue with standardized error handling.
 */
function createWorker(
  queueName: QueueNames,
  handler: JobHandler,
  options?: { concurrency?: number }
): Worker {
  const worker = new Worker(queueName, async (job: Job) => {
    const startTime = Date.now();
    logger.info(`Processing job: ${queueName}/${job.name}`, {
      jobId: job.id,
      attempt: job.attemptsMade + 1
    });

    try {
      const result = await handler(job);
      const duration = Date.now() - startTime;

      logger.info(`Job completed: ${queueName}/${job.name}`, {
        jobId: job.id,
        duration: `${duration}ms`
      });

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error(`Job failed: ${queueName}/${job.name}`, {
        jobId: job.id,
        error: (err as Error).message,
        attempt: job.attemptsMade + 1,
        duration: `${duration}ms`
      });

      // Move to dead-letter queue after max retries
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        const dlq = getQueue(QueueNames.DEFAULT);
        await dlq.add(`${queueName}:dead-letter`, {
          originalJobId: job.id,
          originalQueue: queueName,
          payload: job.data,
          error: (err as Error).message
        });
        logger.warn(`Job moved to dead-letter queue`, {
          jobId: job.id,
          queueName
        });
      }

      throw err;
    }
  }, {
    connection: getConnection() as any,
    concurrency: options?.concurrency || 3,
    lockDuration: 60000, // 1 minute lock
    stalledInterval: 30000
  });

  worker.on('completed', (job) => {
    logger.debug(`Worker completed: ${queueName}/${job.name}`, { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Worker failed: ${queueName}/${job?.name || 'unknown'}`, {
      jobId: job?.id,
      error: err.message
    });
  });

  worker.on('error', (err) => {
    logger.error(`Worker error: ${queueName}`, { error: err.message });
  });

  logger.info(`Worker created: ${queueName}`);
  return worker;
}

// ─── Graceful Shutdown ────────────────────────

async function closeAll(): Promise<void> {
  logger.info('Closing all queue connections...');

  for (const [name, queue] of queues) {
    await queue.close();
    logger.debug(`Queue closed: ${name}`);
  }

  if (connection) {
    await connection.quit();
    connection = null;
  }

  logger.info('All queue connections closed');
}

export {
  getConnection,
  getQueue,
  createQueue,
  addJob,
  getJobStatus,
  createWorker,
  closeAll
};
