import { logger } from '../../utils/logger';
import { eventBus } from '../../event-bus';
import { Events } from '../../event-bus/events';

export interface AnalyticsEvent {
  event: string;
  clientId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export class AnalyticsEngine {
  private events: AnalyticsEvent[] = [];
  private maxEvents = 5000;

  async initialize(pool: any): Promise<void> {
    logger.info('AnalyticsEngine initialized');
    eventBus.on(Events.ARTICLE_PUBLISHED, async (payload) => {
      this.track('article_published', payload.clientId, payload);
    });
    eventBus.on(Events.ARTICLE_GENERATED, async (payload) => {
      this.track('article_generated', payload.clientId, payload);
    });
    eventBus.on(Events.PUBLISH_FAILED, async (payload) => {
      this.track('publish_failed', payload.clientId, payload);
    });
  }

  track(event: string, clientId?: string, metadata: Record<string, any> = {}): void {
    this.events.push({ event, clientId, timestamp: new Date(), metadata });
    if (this.events.length > this.maxEvents) this.events.shift();
  }

  getStats(clientId?: string, event?: string): any {
    let filtered = this.events;
    if (clientId) filtered = filtered.filter(e => e.clientId === clientId);
    if (event) filtered = filtered.filter(e => e.event === event);
    return {
      total: filtered.length,
      byEvent: this.groupBy(filtered, 'event'),
      byDay: this.groupByDay(filtered),
    };
  }

  private groupBy(data: AnalyticsEvent[], key: keyof AnalyticsEvent): Record<string, number> {
    return data.reduce((acc, item) => {
      const val = String(item[key]);
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByDay(data: AnalyticsEvent[]): Record<string, number> {
    return data.reduce((acc, item) => {
      const day = item.timestamp.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  getRecent(limit = 50): AnalyticsEvent[] {
    return this.events.slice(-limit);
  }
}

export const analyticsEngine = new AnalyticsEngine();
