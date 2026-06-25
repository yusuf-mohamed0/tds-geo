import { AxiosInstance } from 'axios';
import { ConnectorInterface, ConnectorConfig, HealthStatus, SyncResult, ContentPayload, MediaPayload, PublishResult, Taxonomy } from '../../sdk/connector-interface';
import { logger } from '../../utils/logger';
import { createWordPressClient } from './client';

export class WordPressConnector implements ConnectorInterface {
  readonly provider = 'wordpress';
  readonly name = 'TDS Geo WordPress';
  readonly version = '1.0.0';

  private client: AxiosInstance | null = null;
  private config: ConnectorConfig | null = null;
  private connectedAt: Date | null = null;

  async connect(config: ConnectorConfig): Promise<boolean> {
    if (!config.endpointUrl || !config.apiKey) {
      logger.error('WordPressConnector: endpointUrl and apiKey required');
      return false;
    }

    this.config = config;
    this.client = createWordPressClient(config.endpointUrl, config.apiKey);

    const health = await this.health();
    const connected = health.status === 'healthy';

    if (connected) {
      this.connectedAt = new Date();
      logger.info('WordPressConnector: connected', {
        endpoint: config.endpointUrl,
        version: health.version,
      });
    } else {
      logger.error('WordPressConnector: connection failed', { endpoint: config.endpointUrl });
    }

    return connected;
  }

  async authenticate(): Promise<string> {
    return this.config?.apiKey || '';
  }

  async health(): Promise<HealthStatus> {
    if (!this.client) {
      return { status: 'down', version: this.version, lastSync: null, uptime: 0, errors: ['Not connected'] };
    }

    try {
      const response = await this.client.get('/status');
      const data = response.data;

      return {
        status: data.status === 'active' ? 'healthy' : 'degraded',
        version: data.version || this.version,
        lastSync: data.last_sync || null,
        uptime: data.uptime || 0,
        errors: [],
      };
    } catch (err) {
      return {
        status: 'down',
        version: this.version,
        lastSync: null,
        uptime: 0,
        errors: [(err as Error).message],
      };
    }
  }

  async publish(article: ContentPayload): Promise<PublishResult> {
    if (!this.client) {
      return { success: false, error: 'WordPress connector not connected', provider: 'wordpress' };
    }

    try {
      const payload: Record<string, any> = {
        title: article.title,
        content_html: article.content,
        status: article.status || 'draft',
      };

      if (article.slug) payload.slug = article.slug;
      if (article.tags && article.tags.length > 0) payload.tags = article.tags;
      if (article.categories && article.categories.length > 0) payload.categories = article.categories;
      if (article.metaTitle) payload.meta_title = article.metaTitle;
      if (article.metaDescription) payload.meta_description = article.metaDescription;
      if (article.imageUrl) payload.featured_image_url = article.imageUrl;
      if (article.author) payload.author_email = article.author;
      if (article.publishedAt) payload.publish_date = article.publishedAt;
      if (article.excerpt) payload.excerpt = article.excerpt;
      if (article.id) payload.agent_article_id = article.id;

      const response = await this.client.post('/posts', payload);
      const result = response.data;

      logger.info('WordPressConnector: article published', {
        id: result.id,
        title: article.title,
        status: result.status,
      });

      return {
        success: true,
        externalId: String(result.id),
        url: result.link || result.url || null,
        provider: 'wordpress',
      };
    } catch (err: any) {
      const errorDetail = err.response?.data?.message || err.message;
      logger.error('WordPressConnector: publish failed', { title: article.title, error: errorDetail });
      return { success: false, error: String(errorDetail), provider: 'wordpress' };
    }
  }

  async update(id: string, article: Partial<ContentPayload>): Promise<PublishResult> {
    if (!this.client) {
      return { success: false, error: 'WordPress connector not connected', provider: 'wordpress' };
    }

    try {
      const payload: Record<string, any> = {};

      if (article.title) payload.title = article.title;
      if (article.content) payload.content_html = article.content;
      if (article.status) payload.status = article.status;
      if (article.slug) payload.slug = article.slug;
      if (article.tags) payload.tags = article.tags;
      if (article.categories) payload.categories = article.categories;
      if (article.metaTitle) payload.meta_title = article.metaTitle;
      if (article.metaDescription) payload.meta_description = article.metaDescription;
      if (article.imageUrl) payload.featured_image_url = article.imageUrl;
      if (article.excerpt) payload.excerpt = article.excerpt;

      const response = await this.client.put(`/posts/${id}`, payload);
      const result = response.data;

      return {
        success: true,
        externalId: String(result.id),
        url: result.link || result.url || null,
        provider: 'wordpress',
      };
    } catch (err: any) {
      const errorDetail = err.response?.data?.message || err.message;
      logger.error('WordPressConnector: update failed', { id, error: errorDetail });
      return { success: false, error: String(errorDetail), provider: 'wordpress' };
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.delete(`/posts/${id}`);
      logger.info('WordPressConnector: article deleted', { id });
      return true;
    } catch (err) {
      logger.error('WordPressConnector: delete failed', { id, error: (err as Error).message });
      return false;
    }
  }

  async sync(): Promise<SyncResult> {
    if (!this.client) {
      return { synced: 0, updated: 0, deleted: 0, failed: 0, errors: ['Not connected'] };
    }

    try {
      const response = await this.client.get('/posts', { params: { limit: 250 } });
      const posts = response.data.posts || response.data || [];

      return {
        synced: Array.isArray(posts) ? posts.length : 0,
        updated: 0,
        deleted: 0,
        failed: 0,
        errors: [],
      };
    } catch (err: any) {
      const errorDetail = err.response?.data?.message || err.message;
      logger.error('WordPressConnector: sync failed', { error: errorDetail });
      return { synced: 0, updated: 0, deleted: 0, failed: 0, errors: [String(errorDetail)] };
    }
  }

  async getContent(id: string): Promise<ContentPayload | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.get(`/posts/${id}`);
      const post = response.data;

      return {
        id: String(post.id),
        title: post.title || '',
        content: post.content || post.content_html || '',
        excerpt: post.excerpt || '',
        slug: post.slug || '',
        status: post.status || 'draft',
        categories: post.categories || [],
        tags: post.tags || [],
        metaTitle: post.meta_title || '',
        metaDescription: post.meta_description || '',
        imageUrl: post.featured_image_url || null,
        author: post.author_email || post.author || '',
        publishedAt: post.publish_date || post.date || null,
      };
    } catch (err) {
      logger.error('WordPressConnector: getContent failed', { id, error: (err as Error).message });
      return null;
    }
  }

  async getMedia(id: string): Promise<MediaPayload | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.get(`/media?id=${id}`);
      const media = response.data;

      return {
        id: String(media.id),
        url: media.url || '',
        filename: media.filename || '',
        mimeType: media.mime_type || media.mimeType || '',
        alt: media.alt || '',
        caption: media.caption || '',
      };
    } catch (err) {
      return null;
    }
  }

  async getCategories(): Promise<Taxonomy[]> {
    if (!this.client) return [];

    try {
      const response = await this.client.get('/categories');
      const items = response.data.categories || response.data || [];
      return items.map((item: any) => ({
        id: item.id || item.term_id,
        name: item.name || '',
        slug: item.slug || '',
        parent: item.parent || null,
        count: item.count || 0,
      }));
    } catch (err) {
      logger.error('WordPressConnector: getCategories failed', { error: (err as Error).message });
      return [];
    }
  }

  async getTags(): Promise<Taxonomy[]> {
    if (!this.client) return [];

    try {
      const response = await this.client.get('/tags');
      const items = response.data.tags || response.data || [];
      return items.map((item: any) => ({
        id: item.id || item.term_id,
        name: item.name || '',
        slug: item.slug || '',
        parent: item.parent || null,
        count: item.count || 0,
      }));
    } catch (err) {
      logger.error('WordPressConnector: getTags failed', { error: (err as Error).message });
      return [];
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.config = null;
    this.connectedAt = null;
    logger.info('WordPressConnector: disconnected');
  }
}

export const wordpressConnector = new WordPressConnector();
