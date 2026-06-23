import { logger } from '../../utils/logger';
import { eventBus } from '../../event-bus';
import { Events } from '../../event-bus/events';
import shopifyService from '../../services/shopify';
import multiCmsPublisher from '../../services/multiCmsPublisher';

export interface PublishTarget {
  provider: 'shopify' | 'wordpress' | 'webflow' | 'ghost' | 'custom';
  config: any;
}

export interface PublishResult {
  success: boolean;
  provider: string;
  externalId?: string;
  url?: string;
  error?: string;
}

export class PublisherEngine {
  private pool: any = null;

  async initialize(pool: any): Promise<void> {
    this.pool = pool;
    logger.info('PublisherEngine initialized');
  }

  async publish(article: any, client: any, blogId?: number | string): Promise<PublishResult> {
    try {
      const result = await shopifyService.publishArticleWithTracking(
        this.pool,
        client,
        blogId || null,
        article.id,
        {
          title: article.title,
          contentHtml: article.content_html || '',
          metaTitle: article.meta_title,
          metaDescription: article.meta_description,
          tags: article.tags || [],
        }
      );

      await eventBus.emit(Events.PUBLISH_SUCCEEDED, {
        articleId: article.id,
        clientId: client.id,
        url: result.url,
      });

      return { success: true, provider: 'shopify', externalId: String(result.id), url: result.url };
    } catch (err) {
      await eventBus.emit(Events.PUBLISH_FAILED, {
        articleId: article.id,
        clientId: client.id,
        error: (err as Error).message,
      });

      return { success: false, provider: 'shopify', error: (err as Error).message };
    }
  }

  async publishMulti(article: any, targets: PublishTarget[]): Promise<PublishResult[]> {
    return Promise.all(targets.map(t => this.publishToTarget(article, t)));
  }

  private async publishToTarget(article: any, target: PublishTarget): Promise<PublishResult> {
    return { success: false, provider: target.provider, error: 'Not implemented for this provider' };
  }

  async sync(provider: string, config: any): Promise<number> {
    await eventBus.emit(Events.SYNC_COMPLETED, { provider });
    return 0;
  }

  async fetchBlogs(config: any): Promise<any[]> {
    return shopifyService.fetchBlogs(config);
  }

  async fetchArticles(config: any): Promise<any[]> {
    return shopifyService.fetchArticles(config);
  }
}

export const publisherEngine = new PublisherEngine();
