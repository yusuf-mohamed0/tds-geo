// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * TDS Geo Next.js Integration — TypeScript Types
 *
 * Mirrors the TDS Geo backend article/publishing schema for type-safe
 * integration with Next.js App Router sites.
 */

// ══════════════════════════════════════════════════════════════════
// CORE DOMAIN TYPES
// ══════════════════════════════════════════════════════════════════

/** Article status mirroring TDS Geo's backend */
export type TdsGeoArticleStatus =
  | 'draft' | 'generated' | 'reviewed' | 'approved' | 'rejected'
  | 'published' | 'failed' | 'archived';

/** A full article as received from TDS Geo */
export interface TdsGeoArticle {
  id: string;
  title: string;
  slug: string;
  content: string;            // Markdown content
  contentHtml?: string;        // HTML content (rendered from markdown)
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags: string[];
  categories?: string[];
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  author?: TdsGeoAuthor;
  status: TdsGeoArticleStatus;
  wordCount?: number;
  focusKeyword?: string;
  createdAt: string;           // ISO date string
  updatedAt: string;           // ISO date string
  publishedAt?: string;        // ISO date string
  /** Arbitrary custom fields from TDS Geo platform */
  customFields?: Record<string, unknown>;
}

/** Author information */
export interface TdsGeoAuthor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

/** A stored post on the Next.js site (extends TdsGeoArticle with local fields) */
export interface TdsGeoPost extends TdsGeoArticle {
  /** Local database ID (from file storage or your DB) */
  localId: string;
  /** When this post was imported/stored */
  importedAt: string;
  /** Next.js revalidation tags */
  revalidationTags: string[];
  /** SEO metadata stored locally */
  seo?: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl?: string;
    ogImage?: string;
    schemaJson?: Record<string, unknown>;
  };
}

/** Paginated list of posts */
export interface TdsGeoPostList {
  posts: TdsGeoPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════

/** Configuration for the TDS Geo server integration */
export interface TdsGeoConfig {
  /** API key shared between TDS Geo and this site */
  apiKey: string;
  /** Where to store content. Defaults to JSON files in .tds-geo/ */
  storage?: StorageProvider;
  /** ISR revalidation tags to use (default: ['tds-geo']) */
  revalidationTags?: string[];
  /** Base path for the TDS Geo API routes (default: '/api/tds-geo') */
  basePath?: string;
  /** Whether to enable detailed logging */
  debug?: boolean;
}

// ══════════════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════════════

/** Storage provider interface — implement this for custom storage (DB, etc.) */
export interface StorageProvider {
  /** List all posts, with optional pagination */
  listPosts(options?: {
    status?: string;
    limit?: number;
    offset?: number;
    tag?: string;
  }): Promise<TdsGeoPostList>;
  /** Get a single post by its local ID */
  getPost(id: string): Promise<TdsGeoPost | null>;
  /** Get a single post by its slug */
  getPostBySlug(slug: string): Promise<TdsGeoPost | null>;
  /** Get a single post by its TDS Geo article ID */
  getPostByTdsGeoId(tdsGeoId: string): Promise<TdsGeoPost | null>;
  /** Create or update a post (upsert by tdsGeoId) */
  upsertPost(article: TdsGeoArticle): Promise<TdsGeoPost>;
  /** Delete a post */
  deletePost(id: string): Promise<boolean>;
  /** Get total post count */
  getPostCount(status?: string): Promise<number>;
  /** Get all unique tags across posts */
  getAllTags(): Promise<string[]>;
  /** Get all unique categories across posts */
  getAllCategories(): Promise<string[]>;
}

// ══════════════════════════════════════════════════════════════════
// API PAYLOADS
// ══════════════════════════════════════════════════════════════════

/** Webhook event payload from TDS Geo */
export interface TdsGeoWebhookPayload {
  event: 'article.created' | 'article.updated' | 'article.deleted' | 'ping';
  data: TdsGeoArticle | { tdsGeoArticleId: string } | Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

/** Standard API response wrapper */
export interface TdsGeoApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Create post request payload */
export interface CreatePostPayload {
  title: string;
  content: string;
  contentHtml?: string;
  slug?: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  categories?: string[];
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  author?: TdsGeoAuthor;
  status?: TdsGeoArticleStatus;
  focusKeyword?: string;
  customFields?: Record<string, unknown>;
}

/** Update post request payload */
export type UpdatePostPayload = Partial<CreatePostPayload>;

// ══════════════════════════════════════════════════════════════════
// NEXT.JS SPECIFIC
// ══════════════════════════════════════════════════════════════════

/** Props for the TDS Geo blog components */
export interface TdsGeoBlogListProps {
  posts: TdsGeoPost[];
  totalPages?: number;
  currentPage?: number;
  basePath?: string;
  emptyMessage?: string;
}

export interface TdsGeoBlogPostProps {
  post: TdsGeoPost;
  showFeaturedImage?: boolean;
  showAuthor?: boolean;
  showTags?: boolean;
  showShareButtons?: boolean;
}

export interface TdsGeoContentProps {
  content: string;
  className?: string;
}
