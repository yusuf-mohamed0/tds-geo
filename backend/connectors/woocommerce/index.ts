// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import {
  ConnectorConfig,
  ConnectorInterface,
  ContentPayload,
  HealthStatus,
  MediaPayload,
  PublishResult,
  SyncResult,
  Taxonomy,
} from '../../sdk/connector-interface';
import { WordPressConnector } from '../wordpress';

export class WooCommerceConnector implements ConnectorInterface {
  readonly provider = 'woocommerce';
  readonly name = 'Kivo Geo WooCommerce';
  readonly version = '1.0.0';

  private readonly wordpress = new WordPressConnector();

  async connect(config: ConnectorConfig): Promise<boolean> {
    return this.wordpress.connect({ ...config, provider: this.provider });
  }

  async authenticate(): Promise<string> {
    return this.wordpress.authenticate();
  }

  async health(): Promise<HealthStatus> {
    const status = await this.wordpress.health();
    return { ...status, version: this.version };
  }

  async sync(): Promise<SyncResult> {
    return this.wordpress.sync();
  }

  async publish(article: ContentPayload): Promise<PublishResult> {
    const result = await this.wordpress.publish(article);
    return { ...result, provider: this.provider };
  }

  async update(id: string, article: Partial<ContentPayload>): Promise<PublishResult> {
    const result = await this.wordpress.update(id, article);
    return { ...result, provider: this.provider };
  }

  async delete(id: string): Promise<boolean> {
    return this.wordpress.delete(id);
  }

  async getContent(id: string): Promise<ContentPayload | null> {
    return this.wordpress.getContent(id);
  }

  async getMedia(id: string): Promise<MediaPayload | null> {
    return this.wordpress.getMedia(id);
  }

  async getCategories(): Promise<Taxonomy[]> {
    return this.wordpress.getCategories();
  }

  async getTags(): Promise<Taxonomy[]> {
    return this.wordpress.getTags();
  }

  async disconnect(): Promise<void> {
    await this.wordpress.disconnect();
  }
}

export const woocommerceConnector = new WooCommerceConnector();
