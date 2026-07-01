import { logger } from '../utils/logger';
import fs from 'node:fs';
import path from 'node:path';

export type EventHandler = (payload: any) => Promise<void>;

export interface EventSubscription {
  event: string;
  handler: EventHandler;
}

class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private history: { event: string; payload: any; timestamp: Date }[] = [];
  private maxHistory = 1000;
  private historyFile = process.env.EVENT_BUS_HISTORY_FILE || path.resolve(process.cwd(), 'outputs', 'event-bus-history.json');

  constructor() {
    this.loadHistory();
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    logger.debug(`EventBus: Handler registered for "${event}"`);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  async emit(event: string, payload: any): Promise<void> {
    this.history.push({ event, payload, timestamp: new Date() });
    if (this.history.length > this.maxHistory) this.history.shift();
    this.persistHistory();

    const handlers = this.handlers.get(event);
    if (!handlers || handlers.length === 0) return;

    logger.debug(`EventBus: Emitting "${event}" to ${handlers.length} handler(s)`);

    await Promise.allSettled(
      handlers.map(h =>
        h(payload).catch(err => {
          logger.error(`EventBus: Handler failed for "${event}"`, {
            error: (err as Error).message,
          });
        })
      )
    );
  }

  subscribe(subscriptions: EventSubscription[]): void {
    for (const sub of subscriptions) {
      this.on(sub.event, sub.handler);
    }
  }

  getHistory(event?: string): { event: string; payload: any; timestamp: Date }[] {
    if (event) return this.history.filter(h => h.event === event);
    return [...this.history];
  }

  clear(clearHistory = true): void {
    this.handlers.clear();
    if (clearHistory) {
      this.history = [];
      this.persistHistory();
    }
  }

  private loadHistory(): void {
    try {
      if (!fs.existsSync(this.historyFile)) return;
      const raw = fs.readFileSync(this.historyFile, 'utf8');
      const parsed = JSON.parse(raw) as { event: string; payload: any; timestamp: string }[];
      this.history = parsed
        .slice(-this.maxHistory)
        .map(item => ({ ...item, timestamp: new Date(item.timestamp) }));
    } catch (error) {
      logger.warn('EventBus: failed to load persisted history', { error: (error as Error).message });
    }
  }

  private persistHistory(): void {
    try {
      fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history), 'utf8');
    } catch (error) {
      logger.warn('EventBus: failed to persist history', { error: (error as Error).message });
    }
  }
}

export const eventBus = new EventBus();
