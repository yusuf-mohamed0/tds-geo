import { ConnectorInterface, ConnectorConfig, HealthStatus, SyncResult, ContentPayload, MediaPayload, PublishResult, Taxonomy } from '../../sdk/connector-interface';
import { logger } from '../../utils/logger';

export class WordPressConnector implements ConnectorInterface {
  readonly provider = 'wordpress';
  readonly name = 'WordPress';
  readonly version = '1.0.0';

  private config: ConnectorConfig | null = null;
  private connected = false;

  async connect(config: ConnectorConfig): Promise<boolean> {
    this.config = config;
    this.connected = true;
    logger.info('WordPressConnector: connected', { endpoint: config.endpointUrl });
    return true;
  }

  async authenticate(): Promise<string> { return this.config?.apiKey || ''; }

  async health(): Promise<HealthStatus> {
    return { status: this.connected ? 'healthy' : 'down', version: this.version, lastSync: null, uptime: 0, errors: [] };
  }

  async sync(): Promise<SyncResult> {
    return { synced: 0, updated: 0, deleted: 0, failed: 0, errors: [] };
  }

  async publish(article: ContentPayload): Promise<PublishResult> {
    return { success: false, error: 'WordPress connector: publish via REST API not yet wired', provider: 'wordpress' };
  }

  async update(id: string, article: Partial<ContentPayload>): Promise<PublishResult> {
    return { success: false, error: 'Not implemented', provider: 'wordpress' };
  }

  async delete(id: string): Promise<boolean> { return false; }
  async getContent(id: string): Promise<ContentPayload | null> { return null; }
  async getMedia(id: string): Promise<MediaPayload | null> { return null; }
  async getCategories(): Promise<Taxonomy[]> { return []; }
  async getTags(): Promise<Taxonomy[]> { return []; }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = null;
  }
}

export const wordpressConnector = new WordPressConnector();
