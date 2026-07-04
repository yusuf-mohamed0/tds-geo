// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Structured Logger with Database Activity Logging
// Non-blocking async batch writer for DB operations
// ──────────────────────────────────────────────

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

const logDir = path.dirname(
  path.resolve(process.env.LOG_FILE_PATH || 'logs/automation.log')
);

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, action, clientId, entityType, entityId, ...meta }) => {
    let base = `${timestamp} ${level}: ${message}`;
    if (clientId) base += ` [client=${clientId}]`;
    if (action) base += ` [action=${action}]`;
    if (entityType && entityId) base += ` [${entityType}=${entityId}]`;
    const rest = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return rest ? `${base} ${rest}` : base;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'ai-seo-automation' },
  transports: [
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH || 'logs/automation.log',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test'
    })
  ]
});

/**
 * Create a child logger scoped to a specific client.
 */
function forClient(clientId: string): winston.Logger {
  return logger.child({ clientId });
}

// ══════════════════════════════════════════════
// LogBuffer — async batch DB writer
// ══════════════════════════════════════════════

interface LogBufferEntry {
  client_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  level: string;
  message: string;
  metadata: string;
}

class LogBuffer {
  private pool: Pool | null = null;
  private buffer: LogBufferEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushIntervalMs = parseInt(process.env.LOG_FLUSH_INTERVAL_MS || '2000', 10);
  private readonly batchSize = parseInt(process.env.LOG_BATCH_SIZE || '50', 10);
  private flushing = false;

  /**
   * Initialize with a database pool. Starts the periodic flush timer.
   */
  initialize(pool: Pool): void {
    this.pool = pool;
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    this.flushTimer.unref();
  }

  /**
   * Enqueue a log entry for batch insertion.
   */
  enqueue(entry: LogBufferEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush all buffered entries to the database in a single INSERT.
   * Uses multi-row INSERT for maximum performance.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0 || !this.pool) return;
    this.flushing = true;

    const batch = this.buffer.splice(0, this.batchSize);
    try {
      const values: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const entry of batch) {
        values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        params.push(entry.client_id, entry.action, entry.entity_type, entry.entity_id, entry.level, entry.message, entry.metadata);
      }

      await this.pool.query(
        `INSERT INTO activity_logs (client_id, action, entity_type, entity_id, level, message, metadata) VALUES ${values.join(', ')}`,
        params
      );
    } catch (err) {
      logger.error('LogBuffer flush failed', { error: (err as Error).message, droppedCount: batch.length });
      // Re-enqueue dropped entries up to the buffer limit
      if (this.buffer.length < this.batchSize * 2) {
        this.buffer.push(...batch);
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Close the flush timer and flush remaining entries.
   */
  async close(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    await this.flush();
  }
}

const logBuffer = new LogBuffer();

// ══════════════════════════════════════════════

interface LogActivityOptions {
  clientId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  level?: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an activity that will also be recorded in the database.
 * Uses LogBuffer for non-blocking async batch writes.
 */
async function logActivity(db: Pool | null, opts: LogActivityOptions): Promise<void> {
  const {
    clientId,
    action,
    entityType = null,
    entityId = null,
    level = 'info' as const,
    message,
    metadata = {}
  } = opts;

  logger.log(level, message, { clientId, action, entityType, entityId, ...metadata });

  if (db) {
    // Enqueue to the LogBuffer for batch DB insertion
    logBuffer.enqueue({
      client_id: clientId || '',
      action,
      entity_type: entityType,
      entity_id: entityId,
      level,
      message,
      metadata: JSON.stringify(metadata)
    });
  }
}

/**
 * Initialize the LogBuffer with a database pool. Call once at startup.
 */
function initLogBuffer(pool: Pool): void {
  logBuffer.initialize(pool);
}

/**
 * Gracefully flush and close the LogBuffer.
 */
async function closeLogBuffer(): Promise<void> {
  await logBuffer.close();
}

export { logger, forClient, logActivity, LogActivityOptions, logBuffer, initLogBuffer, closeLogBuffer };
