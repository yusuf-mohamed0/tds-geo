/**
 * KozmoAI Next.js Integration — TypeScript Types
 *
 * Mirrors the KozmoAI backend article/publishing schema for type-safe
 * integration with Next.js App Router sites.
 */

// ══════════════════════════════════════════════════════════════════
// CORE DOMAIN TYPES
// ══════════════════════════════════════════════════════════════════

/** Article status mirroring KozmoAI's backend */
export type KozmoAIArticleStatus =
  | 'draft' | 'generated' | 'reviewed' | 'approved' | 'rejected'
  | 'published' | 'failed' | 'archived';

/** A full article as received from KozmoAI */
export interface KozmoAIArticle {
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
  author?: KozmoAIAuthor;
  status: KozmoAIArticleStatus;
  wordCount?: number;
  focusKeyword?: string;
  createdAt: string;           // ISO date string
  updatedAt: string;           // ISO date string
  publishedAt?: string;        // ISO date string
  /** Arbitrary custom fields from KozmoAI platform */
  customFields?: Record<string, unknown>;
}

/** Author information */
export interface KozmoAIAuthor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

/** A stored post on the Next.js site (extends KozmoAIArticle with local fields) */
export interface KozmoAIPost extends KozmoAIArticle {
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
export interface KozmoAIPostList {
  posts: KozmoAIPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════

/** Configuration for the KozmoAI server integration */
export interface KozmoAIConfig {
  /** API key shared between KozmoAI and this site */
  apiKey: string;
  /** Where to store content. Defaults to JSON files in .kozmo-ai/ */
  storage?: StorageProvider;
  /** ISR revalidation tags to use (default: ['kozmo-ai']) */
  revalidationTags?: string[];
  /** Base path for the KozmoAI API routes (default: '/api/kozmo-ai') */
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
  }): Promise<KozmoAIPostList>;
  /** Get a single post by its local ID */
  getPost(id: string): Promise<KozmoAIPost | null>;
  /** Get a single post by its slug */
  getPostBySlug(slug: string): Promise<KozmoAIPost | null>;
  /** Get a single post by its KozmoAI article ID */
  getPostByKozmoAIId(kozmo-aiId: string): Promise<KozmoAIPost | null>;
  /** Create or update a post (upsert by kozmo-aiId) */
  upsertPost(article: KozmoAIArticle): Promise<KozmoAIPost>;
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

/** Webhook event payload from KozmoAI */
export interface KozmoAIWebhookPayload {
  event: 'article.created' | 'article.updated' | 'article.deleted' | 'ping';
  data: KozmoAIArticle | { kozmo-aiArticleId: string } | Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

/** Standard API response wrapper */
export interface KozmoAIAPIResponse<T = unknown> {
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
  author?: KozmoAIAuthor;
  status?: KozmoAIArticleStatus;
  focusKeyword?: string;
  customFields?: Record<string, unknown>;
}

/** Update post request payload */
export type UpdatePostPayload = Partial<CreatePostPayload>;

// ══════════════════════════════════════════════════════════════════
// NEXT.JS SPECIFIC
// ══════════════════════════════════════════════════════════════════

/** Props for the KozmoAI blog components */
export interface KozmoAIBlogListProps {
  posts: KozmoAIPost[];
  totalPages?: number;
  currentPage?: number;
  basePath?: string;
  emptyMessage?: string;
}

export interface KozmoAIBlogPostProps {
  post: KozmoAIPost;
  showFeaturedImage?: boolean;
  showAuthor?: boolean;
  showTags?: boolean;
  showShareButtons?: boolean;
}

export interface KozmoAIContentProps {
  content: string;
  className?: string;
}
