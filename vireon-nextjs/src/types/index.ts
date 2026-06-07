/**
 * Vireon Next.js Integration — TypeScript Types
 *
 * Mirrors the Vireon backend article/publishing schema for type-safe
 * integration with Next.js App Router sites.
 */

// ══════════════════════════════════════════════════════════════════
// CORE DOMAIN TYPES
// ══════════════════════════════════════════════════════════════════

/** Article status mirroring Vireon's backend */
export type VireonArticleStatus =
  | 'draft' | 'generated' | 'reviewed' | 'approved' | 'rejected'
  | 'published' | 'failed' | 'archived';

/** A full article as received from Vireon */
export interface VireonArticle {
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
  author?: VireonAuthor;
  status: VireonArticleStatus;
  wordCount?: number;
  focusKeyword?: string;
  createdAt: string;           // ISO date string
  updatedAt: string;           // ISO date string
  publishedAt?: string;        // ISO date string
  /** Arbitrary custom fields from Vireon platform */
  customFields?: Record<string, unknown>;
}

/** Author information */
export interface VireonAuthor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

/** A stored post on the Next.js site (extends VireonArticle with local fields) */
export interface VireonPost extends VireonArticle {
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
export interface VireonPostList {
  posts: VireonPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════

/** Configuration for the Vireon server integration */
export interface VireonConfig {
  /** API key shared between Vireon and this site */
  apiKey: string;
  /** Where to store content. Defaults to JSON files in .vireon/ */
  storage?: StorageProvider;
  /** ISR revalidation tags to use (default: ['vireon']) */
  revalidationTags?: string[];
  /** Base path for the Vireon API routes (default: '/api/vireon') */
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
  }): Promise<VireonPostList>;
  /** Get a single post by its local ID */
  getPost(id: string): Promise<VireonPost | null>;
  /** Get a single post by its slug */
  getPostBySlug(slug: string): Promise<VireonPost | null>;
  /** Get a single post by its Vireon article ID */
  getPostByVireonId(vireonId: string): Promise<VireonPost | null>;
  /** Create or update a post (upsert by vireonId) */
  upsertPost(article: VireonArticle): Promise<VireonPost>;
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

/** Webhook event payload from Vireon */
export interface VireonWebhookPayload {
  event: 'article.created' | 'article.updated' | 'article.deleted' | 'ping';
  data: VireonArticle | { vireonArticleId: string } | Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

/** Standard API response wrapper */
export interface VireonApiResponse<T = unknown> {
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
  author?: VireonAuthor;
  status?: VireonArticleStatus;
  focusKeyword?: string;
  customFields?: Record<string, unknown>;
}

/** Update post request payload */
export type UpdatePostPayload = Partial<CreatePostPayload>;

// ══════════════════════════════════════════════════════════════════
// NEXT.JS SPECIFIC
// ══════════════════════════════════════════════════════════════════

/** Props for the Vireon blog components */
export interface VireonBlogListProps {
  posts: VireonPost[];
  totalPages?: number;
  currentPage?: number;
  basePath?: string;
  emptyMessage?: string;
}

export interface VireonBlogPostProps {
  post: VireonPost;
  showFeaturedImage?: boolean;
  showAuthor?: boolean;
  showTags?: boolean;
  showShareButtons?: boolean;
}

export interface VireonContentProps {
  content: string;
  className?: string;
}
