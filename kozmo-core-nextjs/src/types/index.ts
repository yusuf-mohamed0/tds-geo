/**
 * KOZMO Core Next.js Integration — TypeScript Types
 *
 * Mirrors the KOZMO Core backend article/publishing schema for type-safe
 * integration with Next.js App Router sites.
 */

// ══════════════════════════════════════════════════════════════════
// CORE DOMAIN TYPES
// ══════════════════════════════════════════════════════════════════

/** Article status mirroring KOZMO Core's backend */
export type KozmoCoreArticleStatus =
  | 'draft' | 'generated' | 'reviewed' | 'approved' | 'rejected'
  | 'published' | 'failed' | 'archived';

/** A full article as received from KOZMO Core */
export interface KozmoCoreArticle {
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
  author?: KozmoCoreAuthor;
  status: KozmoCoreArticleStatus;
  wordCount?: number;
  focusKeyword?: string;
  createdAt: string;           // ISO date string
  updatedAt: string;           // ISO date string
  publishedAt?: string;        // ISO date string
  /** Arbitrary custom fields from KOZMO Core platform */
  customFields?: Record<string, unknown>;
}

/** Author information */
export interface KozmoCoreAuthor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

/** A stored post on the Next.js site (extends KozmoCoreArticle with local fields) */
export interface KozmoCorePost extends KozmoCoreArticle {
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
export interface KozmoCorePostList {
  posts: KozmoCorePost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════

/** Configuration for the KOZMO Core server integration */
export interface KozmoCoreConfig {
  /** API key shared between KOZMO Core and this site */
  apiKey: string;
  /** Where to store content. Defaults to JSON files in .kozmo-core/ */
  storage?: StorageProvider;
  /** ISR revalidation tags to use (default: ['kozmo-core']) */
  revalidationTags?: string[];
  /** Base path for the KOZMO Core API routes (default: '/api/kozmo-core') */
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
  }): Promise<KozmoCorePostList>;
  /** Get a single post by its local ID */
  getPost(id: string): Promise<KozmoCorePost | null>;
  /** Get a single post by its slug */
  getPostBySlug(slug: string): Promise<KozmoCorePost | null>;
  /** Get a single post by its KOZMO Core article ID */
  getPostByKozmoCoreId(kozmoCoreId: string): Promise<KozmoCorePost | null>;
  /** Create or update a post (upsert by kozmoCoreId) */
  upsertPost(article: KozmoCoreArticle): Promise<KozmoCorePost>;
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

/** Webhook event payload from KOZMO Core */
export interface KozmoCoreWebhookPayload {
  event: 'article.created' | 'article.updated' | 'article.deleted' | 'ping';
  data: KozmoCoreArticle | { kozmoCoreArticleId: string } | Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

/** Standard API response wrapper */
export interface KozmoCoreApiResponse<T = unknown> {
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
  author?: KozmoCoreAuthor;
  status?: KozmoCoreArticleStatus;
  focusKeyword?: string;
  customFields?: Record<string, unknown>;
}

/** Update post request payload */
export type UpdatePostPayload = Partial<CreatePostPayload>;

// ══════════════════════════════════════════════════════════════════
// NEXT.JS SPECIFIC
// ══════════════════════════════════════════════════════════════════

/** Props for the KOZMO Core blog components */
export interface KozmoCoreBlogListProps {
  posts: KozmoCorePost[];
  totalPages?: number;
  currentPage?: number;
  basePath?: string;
  emptyMessage?: string;
}

export interface KozmoCoreBlogPostProps {
  post: KozmoCorePost;
  showFeaturedImage?: boolean;
  showAuthor?: boolean;
  showTags?: boolean;
  showShareButtons?: boolean;
}

export interface KozmoCoreContentProps {
  content: string;
  className?: string;
}
