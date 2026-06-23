export interface ConnectorConfig {
  provider: string;
  siteId?: string;
  apiKey?: string;
  endpointUrl?: string;
  version?: string;
  capabilities?: ConnectorCapability[];
}

export interface ConnectorCapability {
  name: string;
  supported: boolean;
  version?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  lastSync: string | null;
  uptime: number;
  errors: string[];
}

export interface SyncResult {
  synced: number;
  updated: number;
  deleted: number;
  failed: number;
  errors: string[];
}

export interface ContentPayload {
  id?: string;
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  status?: 'draft' | 'published';
  categories?: string[];
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: string;
}

export interface MediaPayload {
  id?: string;
  url: string;
  filename: string;
  mimeType: string;
  alt?: string;
  caption?: string;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  url?: string;
  error?: string;
  provider: string;
}

export interface Taxonomy {
  id: string | number;
  name: string;
  slug: string;
  parent?: string | number;
  count?: number;
}

export interface ConnectorRegistration {
  siteId: string;
  provider: string;
  endpointUrl: string;
  publicKey: string;
  capabilities: ConnectorCapability[];
}

export interface ConnectorInterface {
  readonly provider: string;
  readonly name: string;
  readonly version: string;

  connect(config: ConnectorConfig): Promise<boolean>;
  authenticate(): Promise<string>;
  health(): Promise<HealthStatus>;
  sync(): Promise<SyncResult>;
  publish(article: ContentPayload): Promise<PublishResult>;
  update(id: string, article: Partial<ContentPayload>): Promise<PublishResult>;
  delete(id: string): Promise<boolean>;
  getContent(id: string): Promise<ContentPayload | null>;
  getMedia(id: string): Promise<MediaPayload | null>;
  getCategories(): Promise<Taxonomy[]>;
  getTags(): Promise<Taxonomy[]>;
  disconnect(): Promise<void>;
}
