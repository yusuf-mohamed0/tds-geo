import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { EnterprisePipelineOrchestrator } from '../orchestrators/blogPipeline';

export class SchedulerService {
  private pool: Pool | null = null;
  private pipeline: EnterprisePipelineOrchestrator | null = null;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  initialize(pool: Pool): void {
    this.pool = pool;
    this.pipeline = new EnterprisePipelineOrchestrator(pool);
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('SchedulerService not initialized');
    return this.pool;
  }

  private getPipeline(): EnterprisePipelineOrchestrator {
    if (!this.pipeline) throw new Error('SchedulerService not initialized');
    return this.pipeline;
  }

  start(intervalMs: number = 60000): void {
    if (this.interval) return;
    logger.info('Scheduler started', { checkInterval: `${intervalMs / 1000}s` });
    this.interval = setInterval(() => this.tick(), intervalMs);
    this.tick();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const due = await this.getPool().query(
        `SELECT s.*, c.name as client_name, c.shopify_shop, c.shopify_token, c.keyword_categories
         FROM schedules s
         JOIN clients c ON c.id = s.client_id
         WHERE s.is_active = true
           AND s.next_run_at <= NOW()
           AND (s.locked_until IS NULL OR s.locked_until < NOW())
         ORDER BY s.next_run_at ASC
         LIMIT 5`
      );

      for (const schedule of due.rows) {
        await this.processSchedule(schedule);
      }
    } catch (err: any) {
      logger.error('Scheduler tick failed', { error: err.message });
    } finally {
      this.isRunning = false;
    }
  }

  private async processSchedule(schedule: any): Promise<void> {
    const logId = crypto.randomUUID();
    const startedAt = new Date();

    try {
      await this.getPool().query(
        'UPDATE schedules SET locked_until = $1 WHERE id = $2',
        [new Date(Date.now() + 300000), schedule.id]
      );

      logger.info('Processing schedule', { id: schedule.id, name: schedule.name });

      const config = schedule.config || {};
      const articleCount = config.article_count || 1;

      let successCount = 0;
      for (let i = 0; i < articleCount; i++) {
        try {
          const result = await this.getPipeline().runFullPipeline(
            schedule.client_id,
            config.keyword || '',
            {
              publish: config.auto_publish || false,
            }
          );
          if (result?.articleId) successCount++;
        } catch (err: any) {
          logger.warn('Schedule article generation failed', {
            scheduleId: schedule.id,
            error: err.message,
          });
        }
      }

      const nextRun = this.calculateNextRun(schedule);
      const completedAt = new Date();

      await this.getPool().query(
        `UPDATE schedules SET
           last_run_at = $1,
           next_run_at = $2,
           last_status = $3,
           articles_generated = COALESCE(articles_generated, 0) + $4,
           locked_until = NULL
         WHERE id = $5`,
        [startedAt, nextRun, successCount > 0 ? 'success' : 'failed', successCount, schedule.id]
      );

      await this.getPool().query(
        `INSERT INTO schedule_logs (id, schedule_id, client_id, status, articles_count, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [logId, schedule.id, schedule.client_id, successCount > 0 ? 'success' : 'failed', successCount, startedAt, completedAt]
      );

      logger.info('Schedule completed', {
        id: schedule.id,
        articles: successCount,
        nextRun,
      });
    } catch (err: any) {
      await this.getPool().query(
        `UPDATE schedules SET last_status = $1, locked_until = NULL WHERE id = $2`,
        ['failed', schedule.id]
      );
      await this.getPool().query(
        `INSERT INTO schedule_logs (id, schedule_id, client_id, status, articles_count, error_message, started_at, completed_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
        [logId, schedule.id, schedule.client_id, 'failed', err.message, startedAt, new Date()]
      );
      logger.error('Schedule processing failed', { id: schedule.id, error: err.message });
    }
  }

  private calculateNextRun(schedule: any): Date {
    const now = new Date();
    const intervalMin = schedule.interval_minutes || 1440;

    switch (schedule.frequency) {
      case 'interval':
        return new Date(now.getTime() + intervalMin * 60000);
      case 'once':
        return new Date('2099-12-31');
      case 'cron':
        if (schedule.cron_expression) {
          return this.nextCronTime(schedule.cron_expression, now);
        }
        return new Date(now.getTime() + 86400000);
      default:
        return new Date(now.getTime() + 86400000);
    }
  }

  private nextCronTime(expression: string, from: Date): Date {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return new Date(from.getTime() + 86400000);

    const next = new Date(from);
    next.setSeconds(0);
    next.setMinutes(0);
    next.setHours(0);
    next.setDate(next.getDate() + 1);

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

    if (hour !== '*') {
      next.setHours(parseInt(hour));
    }
    if (minute !== '*') {
      next.setMinutes(parseInt(minute));
    }
    if (dayOfMonth !== '*') {
      next.setDate(parseInt(dayOfMonth));
    }
    if (dayOfWeek !== '*') {
      const targetDay = parseInt(dayOfWeek);
      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
    }

    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;
