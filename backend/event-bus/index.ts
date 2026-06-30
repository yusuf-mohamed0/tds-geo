import { logger } from '../utils/logger';

export type EventHandler = (payload: any) => Promise<void>;

export interface EventSubscription {
  event: string;
  handler: EventHandler;
}

class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private history: { event: string; payload: any; timestamp: Date }[] = [];
  private maxHistory = 1000;

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

  clear(): void {
    this.handlers.clear();
    this.history = [];
  }
}

export const eventBus = new EventBus();
