import { logger } from '../../utils/logger';
import { eventBus } from '../../event-bus';
import { Events } from '../../event-bus/events';
import globalMemory from '../../services/globalMemory';
import vectorMemoryService from '../../services/vectorMemory';

export interface MemoryEntry {
  key: string;
  value: any;
  tags?: string[];
  ttl?: number;
}

export class MemoryEngine {
  private store = new Map<string, any>();

  async initialize(pool: any): Promise<void> {
    logger.info('MemoryEngine initialized');
  }

  async set(key: string, value: any, tags?: string[]): Promise<void> {
    this.store.set(key, value);
    await eventBus.emit(Events.MEMORY_UPDATED, { key, tags });
  }

  async get(key: string): Promise<any> {
    await eventBus.emit(Events.MEMORY_QUERIED, { key });
    return this.store.get(key) || null;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async search(query: string, tags?: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const [key, value] of this.store) {
      if (key.includes(query) || JSON.stringify(value).includes(query)) {
        results.push({ key, value });
      }
    }
    return results;
  }

  async storeVector(clientId: string, text: string, metadata: any): Promise<void> {
    try {
      await vectorMemoryService.storeArticleChunks(clientId, metadata?.articleId || 'unknown', text);
    } catch (err) {
      logger.warn('MemoryEngine: vector store failed', { error: (err as Error).message });
    }
  }

  async isDuplicate(clientId: string, content: string): Promise<boolean> {
    try {
      return await vectorMemoryService.isDuplicate(clientId, content);
    } catch {
      return false;
    }
  }

  async clearClientMemory(clientId: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(clientId)) this.store.delete(key);
    }
  }

  snapshot(): Record<string, any> {
    return Object.fromEntries(this.store);
  }
}

export const memoryEngine = new MemoryEngine();
