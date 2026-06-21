// ──────────────────────────────────────────────
// AI SEO Automation System - TypeScript Types
// ──────────────────────────────────────────────

// ─── Client ──────────────────────────────────
export interface Client {
  id: string;
  name: string;
  slug: string;
  shopify_shop: string;
  shopify_token: string;
  shopify_api_version: string;
  brand_voice?: string;
  service_area?: string;
  timezone?: string;
  publish_frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
  preferred_publish_hour?: number;
  approval_mode?: 'auto' | 'manual';
  monthly_token_limit?: number;
  monthly_cost_limit?: number;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─── User / Auth ─────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'editor' | 'client';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  client_id?: string;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  clientId?: string;
}

export interface AuthenticatedRequest {
  user: JwtPayload;
}

// ─── Keyword ─────────────────────────────────
export interface Keyword {
  id: string;
  client_id: string;
  keyword: string;
  search_volume: number;
  competition: number;
  relevance_score: number;
  cpc?: number;
  trend_score?: number;
  source: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SerpApiResult {
  keyword: string;
  search_volume: number;
  competition: number;
  cpc: number;
  trend_score: number;
  related_keywords: string[];
}

// ─── Article ─────────────────────────────────
export type ArticleStatus = 'draft' | 'generated' | 'reviewed' | 'approved' | 'rejected' | 'published' | 'failed' | 'archived';

export interface Article {
  id: string;
  client_id: string;
  keyword_id?: string;
  title: string;
  slug: string;
  content_md: string;
  content_html?: string;
  meta_title?: string;
  meta_description?: string;
  tags: string[];
  word_count: number;
  status: ArticleStatus;
  editorial_status?: EditorialStatus;
  seo_score?: number;
  ai_evaluation_score?: number;
  source: string;
  pipeline_stage?: string;
  created_at: Date;
  updated_at: Date;
}

export interface GeneratedArticle {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  faqSection?: string;
  metadata?: {
    model: string;
    temperature: number;
    wordCount: number;
  };
}

// ─── Image ───────────────────────────────────
export interface ArticleImage {
  id: string;
  article_id: string;
  client_id: string;
  prompt: string;
  image_url?: string;
  shopify_image_id?: number;
  alt_text?: string;
  width?: number;
  height?: number;
  position: number;
  created_at: Date;
}

// ─── Publishing ──────────────────────────────
export interface PublishResult {
  id: number;
  blogId: number;
  url: string;
  handle: string;
}

// ─── Schedule ────────────────────────────────
export type ScheduleFrequency = 'cron' | 'interval' | 'once';

export interface Schedule {
  id: string;
  client_id: string;
  name: string;
  frequency: ScheduleFrequency;
  cron_expression?: string;
  interval_minutes?: number;
  next_run_at?: Date;
  last_run_at?: Date;
  config: Record<string, unknown>;
  is_active: boolean;
}

// ─── Webhook ─────────────────────────────────
export interface Webhook {
  id: string;
  client_id: string;
  name?: string;
  url: string;
  events: string[];
  secret?: string;
  retry_count: number;
  timeout_ms: number;
  is_active: boolean;
  last_triggered_at?: Date;
}

// ─── Embedding (Vector Memory) ───────────────
export interface ContentEmbedding {
  id: string;
  client_id: string;
  article_id: string;
  chunk_index: number;
  content_chunk: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface SimilarityResult {
  articleId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

// ─── Cost Tracking ───────────────────────────
export interface CostEntry {
  id: string;
  client_id: string;
  article_id?: string;
  provider: 'openai' | 'ollama' | 'serpapi' | 'shopify' | 'other';
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd: number;
  duration_ms?: number;
  created_at: Date;
}

// ─── SEO Analytics ───────────────────────────
export interface SeoAnalytics {
  id: string;
  client_id: string;
  article_id: string;
  tracked_date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_position: number;
  indexed: boolean;
  keyword_rankings: Record<string, unknown>;
}

// ─── SEO Analysis ────────────────────────────
export interface SeoAnalysis {
  score: number;
  keywordDensity: number;
  readabilityScore: number;
  suggestions: string[];
  headingStructure: {
    h1: boolean;
    h2: number;
    h3: number;
  };
}

// ─── Queue / Jobs ────────────────────────────
export type JobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'delayed' | 'dead_lettered';

export interface Job {
  id: string;
  job_id: string;
  client_id?: string;
  type: string;
  status: JobStatus;
  data: Record<string, unknown>;
  result: Record<string, unknown>;
  error_message?: string;
  attempts: number;
  max_attempts: number;
  queued_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

// ─── Pipeline Result ─────────────────────────
export interface PipelineResult {
  success: boolean;
  articleId?: string;
  title?: string;
  keyword?: string;
  wordCount?: number;
  seoScore?: number;
  published?: boolean;
  publishResult?: PublishResult;
  duration?: string;
  error?: string;
}

// ─── API Responses ───────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

// ─── Shopify Config ──────────────────────────
export interface ShopifyConfig {
  shop: string;
  accessToken: string;
  apiVersion?: string;
}

// ─── Content Generation Params ───────────────
export interface GenerateBlogParams {
  keyword: string;
  promptTemplate?: string;
  tone?: string;
  minWords?: number;
  maxWords?: number;
  clientSettings?: Record<string, unknown>;
}

// ─── Device Authorization ───────────────────────
export interface DeviceFingerprint {
  cpuIdentifier: string;
  macHash: string;
  osSerialHash: string;
  certThumbprint?: string;
  browserFingerprint?: string;
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  ipAddress?: string;
}

export interface DeviceRegistration {
  id: string;
  employeeId: string;
  deviceFingerprintHash: string;
  deviceName?: string;
  deviceType: string;
  trustScore: number;
  isRevoked: boolean;
  enrolledAt: Date;
  lastSeenAt?: Date;
}

export interface EmployeeSession {
  id: string;
  userId: string;
  deviceId: string;
  tokenJti: string;
  ipAddress: string;
  riskScore: number;
  isActive: boolean;
  expiresAt: Date;
}

export interface DeviceAuthConfig {
  requireDeviceAuth: boolean;
  minTrustScore: number;
  sessionTtlHours: number;
  enrollmentRequired: boolean;
  automaticEnrollment: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  actionId: string;
  icon: string;
}

// ══════════════════════════════════════════════════════════════════
// 16. ODOO ERP INTEGRATION
// ══════════════════════════════════════════════════════════════════

// ─── Odoo Connection ───────────────────────────
export interface OdooConnection {
  id: string;
  label: string;
  base_url: string;
  database: string;
  username: string;
  /** Encrypted at rest */
  api_key_encrypted?: string;
  /** Odoo user ID from authentication */
  odoo_uid?: number;
  is_active: boolean;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// ─── Odoo Model Mappings ───────────────────────
export type OdooModel =
  | 'crm.lead'
  | 'crm.team'
  | 'project.project'
  | 'project.task'
  | 'res.partner'
  | 'account.move'
  | 'account.move.line'
  | 'sale.order'
  | 'sale.order.line'
  | 'product.product'
  | 'product.template'
  | 'stock.picking'
  | 'stock.move'
  | 'hr.employee'
  | 'helpdesk.ticket'
  | 'helpdesk.ticket.category'
  | 'website.blog'
  | 'website.blog.post'
  | 'mail.message'
  | 'mail.channel'
  | 'account.analytic.line'
  | 'account.analytic.account'
  | 'res.users'
  | 'res.company';

export type SyncDirection = 'bidirectional' | 'odoo_to_tds_geo' | 'tds_geo_to_odoo';
export type ConflictStrategy = 'tds_geo_wins' | 'odoo_wins' | 'manual' | 'latest_wins';
export type SyncOperation = 'create' | 'update' | 'delete' | 'read' | 'sync';
export type SyncStatus = 'success' | 'failed' | 'pending' | 'conflict' | 'skipped';

export interface OdooModelMapping {
  id: string;
  connection_id: string;
  odoo_model: OdooModel;
  tds_geo_entity: string;
  /** JSON object: { "odoo_field": "tds_geo_field" } */
  field_mappings: Record<string, string>;
  sync_direction: SyncDirection;
  conflict_strategy: ConflictStrategy;
  is_active: boolean;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// ─── Odoo Sync Log ─────────────────────────────
export interface OdooSyncLog {
  id: string;
  connection_id: string;
  model: OdooModel;
  operation: SyncOperation;
  odoo_record_id?: number;
  tds_geo_record_id?: string;
  status: SyncStatus;
  /** Human-readable description of what changed */
  change_summary?: string;
  error_message?: string;
  conflict_details?: Record<string, unknown>;
  created_at: Date;
}

// ─── Odoo Sync Configuration (scheduling) ─────
export interface OdooSyncConfig {
  id: string;
  connection_id: string;
  model: OdooModel;
  sync_interval_minutes: number;
  last_sync_at?: Date;
  next_sync_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─── Odoo Webhook Registrations ───────────────
export interface OdooWebhookRegistration {
  id: string;
  connection_id: string;
  model: OdooModel;
  webhook_url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─── Odoo Auth Response (JSON-RPC) ────────────
export interface OdooAuthResponse {
  uid: number;
  name: string;
  session_id: string;
  is_admin: boolean;
  company_id: number;
  partner_id: number;
  user_context: Record<string, unknown>;
}

// ─── Odoo API Error ────────────────────────────
export interface OdooApiError {
  code: number;
  message: string;
  data?: {
    name: string;
    debug: string;
    message: string;
    arguments: string[];
  };
}

// ─── Odoo Field Definition ─────────────────────
export interface OdooField {
  name: string;
  type: string;
  relation?: string;
  required: boolean;
  readonly: boolean;
  string: string;
  help?: string;
  selection?: Array<[string, string]>;
  size?: number;
  depends?: string[];
  domain?: unknown[];
  context?: Record<string, unknown>;
}

// ─── Odoo Record (generic) ─────────────────────
export interface OdooRecord {
  id: number;
  [key: string]: unknown;
}

// ─── Odoo Search Read Result ───────────────────
export interface OdooSearchReadResult {
  records: OdooRecord[];
  total: number;
  page: number;
  limit: number;
}

// ─── Odoo Sync Job Payload ─────────────────────
export interface OdooSyncPayload {
  connectionId: string;
  model: OdooModel;
  operation: SyncOperation;
  odooRecordId?: number;
  tdsGeoRecordId?: string;
  data?: Record<string, unknown>;
  fieldMappingId?: string;
}

export interface OdooBatchSyncPayload {
  connectionId: string;
  model: OdooModel;
  syncConfigId: string;
  fullSync: boolean;
}

export interface OdooWebhookEventPayload {
  connectionId: string;
  model: OdooModel;
  operation: SyncOperation;
  recordId: number;
  data: Record<string, unknown>;
}

// ─── Odoo Dashboard Stats ──────────────────────
export interface OdooDashboardStats {
  connectionId: string;
  model: OdooModel;
  totalRecords: number;
  syncedRecords: number;
  pendingSync: number;
  failedSync: number;
  lastSyncAt?: Date;
  syncLagMinutes?: number;
}

// ─── Odoo CRM Lead (typed convenience) ─────────
export interface OdooCrmLead {
  id: number;
  name: string;
  partner_id?: [number, string];
  user_id?: [number, string];
  team_id?: [number, string];
  stage_id?: [number, string];
  expected_revenue?: number;
  probability?: number;
  priority?: string;
  description?: string;
  contact_name?: string;
  email_from?: string;
  phone?: string;
  mobile?: string;
  country_id?: [number, string];
  company_id?: [number, string];
  create_date?: string;
  write_date?: string;
}

// ─── Odoo Project / Task (typed convenience) ───
export interface OdooProject {
  id: number;
  name: string;
  partner_id?: [number, string];
  user_id?: [number, string];
  label_tasks?: string;
  analytic_account_id?: [number, string];
  allow_timesheets?: boolean;
  allow_billable?: boolean;
  privacy_visibility?: string;
  create_date?: string;
  write_date?: string;
}

export interface OdooTask {
  id: number;
  name: string;
  project_id?: [number, string];
  user_ids?: Array<[number, string]>;
  stage_id?: [number, string];
  priority?: string;
  planned_hours?: number;
  remaining_hours?: number;
  effective_hours?: number;
  deadline?: string;
  description?: string;
  create_date?: string;
  write_date?: string;
}

// ─── Odoo Partner / Contact (typed convenience) ─
export interface OdooPartner {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  city?: string;
  state_id?: [number, string];
  country_id?: [number, string];
  zip?: string;
  company_id?: [number, string];
  category_id?: Array<[number, string]>;
  is_company?: boolean;
  parent_id?: [number, string];
  lang?: string;
  create_date?: string;
  write_date?: string;
}

// ─── Odoo Invoice (account.move) ───────────────
export interface OdooInvoice {
  id: number;
  name: string;
  partner_id?: [number, string];
  invoice_date?: string;
  invoice_date_due?: string;
  amount_untaxed?: number;
  amount_tax?: number;
  amount_total?: number;
  state?: string;
  invoice_line_ids?: number[];
  user_id?: [number, string];
  create_date?: string;
  write_date?: string;
}

// ══════════════════════════════════════════════════════════════════
// ENTERPRISE UPGRADE — TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════

// ─── 1. HUMAN-IN-THE-LOOP EDITORIAL WORKFLOW ───

export type EditorialStatus =
  | 'draft' | 'generated' | 'in_review' | 'in_seo_review' | 'seo_reviewed'
  | 'in_editor_review' | 'editor_reviewed' | 'approved'
  | 'scheduled' | 'published' | 'rejected' | 'failed' | 'archived';

export type ReviewType = 'seo_review' | 'editor_review' | 'fact_check' | 'final_approval';
export type ReviewDecision = 'approved' | 'rejected' | 'revision_requested' | 'needs_fact_check';
export type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'revision_requested';

export interface EditorialReviewAssignment {
  id: string;
  article_id: string;
  client_id: string;
  reviewer_id?: string;
  assigned_by?: string;
  review_type: ReviewType;
  status: ReviewStatus;
  priority: number;
  due_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface EditorialReview {
  id: string;
  article_id: string;
  reviewer_id?: string;
  review_type: string;
  decision: ReviewDecision;
  score?: number;
  comments?: string;
  suggestions: string[];
  revision_notes?: string;
  created_at: Date;
}

export interface EditorialComment {
  id: string;
  article_id: string;
  parent_id?: string;
  author_id?: string;
  content: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ContentVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  content_md: string;
  content_html?: string;
  meta_title?: string;
  meta_description?: string;
  tags: string[];
  word_count: number;
  change_summary?: string;
  created_by?: string;
  created_at: Date;
}

export interface ContentLock {
  id: string;
  article_id: string;
  locked_by?: string;
  locked_at: Date;
  expires_at: Date;
}

export interface EditorialCalendarEntry {
  id: string;
  client_id: string;
  article_id?: string;
  title: string;
  keyword?: string;
  assignee_id?: string;
  status: 'planned' | 'in_progress' | 'review' | 'approved' | 'published' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: Date;
  publish_date?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// ─── 2. FACT CHECKING + SOURCE GROUNDING ───

export type VerificationStatus = 'verified' | 'likely_true' | 'uncertain' | 'likely_false' | 'false' | 'unverifiable';

export interface FactCheck {
  id: string;
  article_id: string;
  client_id: string;
  claim: string;
  verification: VerificationStatus;
  confidence: number;
  source_url?: string;
  source_domain?: string;
  extracted_date?: Date;
  context?: string;
  reviewed_by_human: boolean;
  created_at: Date;
}

export interface Citation {
  id: string;
  article_id: string;
  client_id: string;
  claim_text: string;
  source_text?: string;
  source_url?: string;
  source_title?: string;
  author?: string;
  publication_date?: Date;
  access_date: Date;
  citation_style: string;
  confidence: number;
  is_validated: boolean;
  position_in_article?: number;
  created_at: Date;
}

export interface TrustedSource {
  id: string;
  client_id: string;
  domain: string;
  source_name?: string;
  category: string;
  authority_score: number;
  is_active: boolean;
  created_at: Date;
}

export interface HighRiskTopic {
  id: string;
  client_id: string;
  category: string;
  keywords: string[];
  requires_citation: boolean;
  requires_human_review: boolean;
  is_active: boolean;
  created_at: Date;
}

// ─── 3. BRAND VOICE MEMORY SYSTEM ───

export interface BrandVoiceProfile {
  id: string;
  client_id: string;
  tone_profile: {
    primary: string;
    secondary: string;
    formality: number;
    enthusiasm: number;
    empathy: number;
  };
  vocabulary_profile: {
    preferred_terms: Record<string, string>;
    avoided_terms: string[];
    industry_jargon: string[];
    power_words: string[];
  };
  audience_profile: {
    demographics: Record<string, unknown>;
    pain_points: string[];
    desires: string[];
    reading_level: string;
  };
  formatting_preferences: {
    heading_style: string;
    paragraph_length: string;
    use_bullets: boolean;
    use_emphasis: boolean;
    image_style: string;
  };
  cta_style: string;
  forbidden_phrases: string[];
  preferred_terminology: Record<string, string>;
  sample_content: string[];
  sample_articles: string[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface BrandVoiceEmbedding {
  id: string;
  client_id: string;
  content_snippet: string;
  embedding: number[];
  source_type: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ─── 4. MULTI-CMS PUBLISHING ARCHITECTURE ───

export type CmsProvider = 'shopify' | 'wordpress' | 'webflow' | 'ghost' | 'medium' | 'headless_cms' | 'notion' | 'custom_rest';

export interface CmsConnection {
  id: string;
  client_id: string;
  provider: CmsProvider;
  label?: string;
  endpoint_url?: string;
  config: Record<string, unknown>;
  capabilities: string[];
  is_primary: boolean;
  is_active: boolean;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PublishingRoutingRule {
  id: string;
  client_id: string;
  cms_connection_id: string;
  priority: number;
  condition_type: 'always' | 'tag_match' | 'keyword_match' | 'topic_match' | 'random';
  condition_value?: string;
  is_active: boolean;
  created_at: Date;
}

export interface PublisherCapabilities {
  supportsMedia: boolean;
  supportsTags: boolean;
  supportsCustomFields: boolean;
  supportsScheduling: boolean;
  supportsMultipleAuthors: boolean;
  maxTitleLength: number;
  contentFormat: 'html' | 'markdown' | 'rich_text';
}

export interface PublisherAdapter {
  provider: CmsProvider;
  name: string;
  capabilities: PublisherCapabilities;
  testConnection(): Promise<boolean>;
  publish(article: Article, config: Record<string, unknown>): Promise<PublishResult>;
  update(articleId: string, article: Partial<Article>): Promise<PublishResult>;
  delete(articleId: string): Promise<boolean>;
  getBlogs(): Promise<Array<{ id: number | string; title: string; handle: string }>>;
}

// ─── 5. PEXELS IMAGE MANAGEMENT ───

export interface PexelsImage {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt_text?: string;
  width: number;
  height: number;
  orientation: string;
  avg_color?: string;
}

export interface PexelsCacheEntry {
  id: string;
  client_id: string;
  search_query: string;
  pexels_id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt_text?: string;
  width: number;
  height: number;
  orientation: string;
  avg_color?: string;
  is_used: boolean;
  article_id?: string;
  created_at: Date;
}

// ─── 6. COST OPTIMIZATION SYSTEM ───

export interface ModelRoutingConfig {
  id: string;
  client_id: string;
  task_type: string;
  preferred_model: string;
  fallback_model?: string;
  max_cost_per_call?: number;
  max_tokens_per_call?: number;
  priority: number;
  is_active: boolean;
  created_at: Date;
}

export interface TokenBudget {
  id: string;
  client_id: string;
  budget_period: 'daily' | 'weekly' | 'monthly';
  token_limit: number;
  cost_limit?: number;
  tokens_used: number;
  cost_used: number;
  period_start: Date;
  period_end: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CostEstimate {
  id: string;
  task_signature: string;
  estimated_tokens: number;
  estimated_cost: number;
  actual_tokens?: number;
  actual_cost?: number;
  confidence: number;
  sample_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ModelRouterResult {
  model: string;
  provider: string;
  estimatedCost: number;
  maxTokens: number;
  reason: string;
}

// ─── AI Service Interface ─────────────────────
// Shared public interface for OpenAIService and OllamaService.
// Enables the AI_PROVIDER router in openai.ts without losing type safety.

export interface AIService {
  initialize(): void;
  isMockMode: boolean;
  provider: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  generateBlogPost(params: GenerateBlogParams): Promise<GeneratedArticle>;
  analyzeSEO(content: string, keyword: string): Promise<Record<string, unknown>>;
  generateKeywordVariations(seedKeyword: string, count?: number): Promise<string[]>;
  generateArticleImage(articleTitle: string, keyword: string, tone?: string): Promise<{ imageUrl: string; altText: string; prompt: string }>;
  generateTitle(keyword: string, brandVoice?: string): Promise<string>;
  generateOutline(keyword: string, title: string, blacklistKeywords?: string[]): Promise<string[]>;
  enhanceSEO(content: string, keyword: string): Promise<string>;
  generateFAQ(keyword: string, count?: number): Promise<string>;
  generateMetadata(title: string, content: string, keyword: string): Promise<{ metaTitle: string; metaDescription: string }>;
  moderateContent(content: string): Promise<{ safe: boolean; flags: Array<{ category: string; severity: string; text: string }>; summary: string }>;
  chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, options?: { temperature?: number; maxTokens?: number }): Promise<string | null>;
}

// ─── 7. OBSERVABILITY + MONITORING ───

export interface TraceSpan {
  id: string;
  trace_id: string;
  parent_span_id?: string;
  span_name: string;
  service_name: string;
  span_kind: string;
  status: 'ok' | 'error' | 'unset';
  status_message?: string;
  start_time: Date;
  end_time?: Date;
  duration_ms?: number;
  attributes: Record<string, unknown>;
  resource_attrs: Record<string, unknown>;
  events: Array<{ name: string; timestamp: Date; attributes: Record<string, unknown> }>;
  created_at: Date;
}

export interface MetricsSnapshot {
  id: string;
  metric_name: string;
  metric_type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels: Record<string, string>;
  unit?: string;
  recorded_at: Date;
  created_at: Date;
}

export interface AiLatencyRecord {
  id: string;
  client_id: string;
  provider: string;
  model?: string;
  operation: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  cost_usd: number;
  success: boolean;
  error_type?: string;
  queue_wait_ms?: number;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface SystemAlert {
  id: string;
  alert_name: string;
  severity: 'critical' | 'warning' | 'info' | 'debug';
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  message: string;
  details: Record<string, unknown>;
  metric_value?: number;
  threshold_value?: number;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  created_at: Date;
}

export interface WorkerPerformance {
  id: string;
  worker_name: string;
  job_type: string;
  jobs_processed: number;
  jobs_failed: number;
  avg_processing_ms: number;
  p95_processing_ms: number;
  p99_processing_ms: number;
  throughput_per_min: number;
  recorded_at: Date;
}

// ─── 8. ENTERPRISE SECURITY ───

export interface AuditLogEntry {
  id: string;
  client_id?: string;
  user_id?: string;
  session_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  outcome: 'success' | 'failure' | 'denied';
  created_at: Date;
}

export interface PermissionEntry {
  id: string;
  role: string;
  resource: string;
  action: string;
  is_granted: boolean;
  created_at: Date;
}

export interface RateLimitConfig {
  id: string;
  client_id: string;
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  burst_limit: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SecretRotationRecord {
  id: string;
  client_id: string;
  secret_type: string;
  previous_value_hash?: string;
  current_value_hash: string;
  rotated_by?: string;
  rotation_reason?: string;
  expires_at?: Date;
  rotated_at: Date;
}

// ─── 9. ADVANCED CONTENT INTELLIGENCE ───

export interface KnowledgeGraphEntity {
  id: string;
  client_id: string;
  entity_name: string;
  entity_type: string;
  description?: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  source: string;
  confidence: number;
  created_at: Date;
}

export interface KnowledgeGraphRelationship {
  id: string;
  client_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  strength: number;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface ContentCannibalization {
  id: string;
  client_id: string;
  article_a_id: string;
  article_b_id: string;
  similarity_score: number;
  overlap_type: 'keyword' | 'topic' | 'entity' | 'semantic';
  overlap_details: Record<string, unknown>;
  recommendation?: string;
  detected_at: Date;
  resolved_at?: Date;
}

export interface TopicSaturation {
  id: string;
  client_id: string;
  topic: string;
  article_count: number;
  saturation_score: number;
  last_article_at?: Date;
  recommendation: 'continue' | 'reduce' | 'stop' | 'diversify';
  created_at: Date;
}

// ─── 10. CLOSED FEEDBACK LOOP ───

export interface ContentPerformanceFeedback {
  id: string;
  article_id: string;
  client_id: string;
  metric_name: string;
  metric_value: number;
  change_vs_baseline?: number;
  improvement_suggestion?: string;
  auto_improved: boolean;
  regression_id?: string;
  collected_at: Date;
  created_at: Date;
}

// ─── 11. AI EVALUATION FRAMEWORK ───

export interface BenchmarkDataset {
  id: string;
  name: string;
  description?: string;
  category: string;
  version: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface BenchmarkTestCase {
  id: string;
  dataset_id: string;
  input: string;
  expected_output?: string;
  evaluation_criteria: Record<string, unknown>;
  difficulty: string;
  created_at: Date;
}

export interface EvaluationResult {
  id: string;
  evaluator_type: 'llm_judge' | 'human' | 'automated';
  target_type: 'article' | 'prompt' | 'keyword' | 'seo';
  target_id: string;
  criteria: string;
  score: number;
  confidence?: number;
  feedback?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface AbTest {
  id: string;
  client_id: string;
  article_base_id: string;
  article_variant_id: string;
  test_name?: string;
  status: 'running' | 'completed' | 'cancelled';
  start_date?: Date;
  end_date?: Date;
  winner?: string;
  metrics: Record<string, unknown>;
  created_at: Date;
}

// ─── 12. PLUGIN ECOSYSTEM ENHANCEMENTS ───

export interface PluginPermission {
  id: string;
  plugin_id: string;
  permission: string;
  is_granted: boolean;
  created_at: Date;
}

export interface PluginExecutionLog {
  id: string;
  plugin_instance_id: string;
  hook: string;
  status: 'running' | 'completed' | 'failed' | 'timed_out';
  duration_ms?: number;
  error_message?: string;
  output_size_bytes?: number;
  created_at: Date;
}

// ─── 14. WORKER PERFORMANCE SCORING ───

export type WorkerTier = 'elite' | 'senior' | 'standard' | 'junior' | 'probation';
export type ScoreTrend = 'rising' | 'stable' | 'declining';
export type PromotionEventType = 'promotion' | 'demotion' | 'flag_review';

// Composite performance score for a worker over a time period
export interface WorkerScore {
  id: string;
  worker_name: string;
  job_type: string;

  // Raw metrics
  total_jobs: number;
  failed_jobs: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  throughput_per_min: number;

  // Dimension scores (0-100)
  reliability_score: number;
  throughput_score: number;
  latency_score: number;
  cost_efficiency_score: number;
  quality_score: number;

  // Composite
  composite_score: number;
  current_tier: WorkerTier;
  tier_confidence: number;

  period_start: Date;
  period_end: Date;
  recorded_at: Date;
  created_at: Date;
}

// Current rank/title for a worker in the hierarchy
export interface WorkerRank {
  id: string;
  worker_name: string;
  job_type: string;
  current_tier: WorkerTier;
  title: string;
  current_score: number;
  highest_score: number;
  lowest_score: number;
  score_trend: ScoreTrend;
  periods_at_tier: number;
  total_promotions: number;
  total_demotions: number;
  is_active: boolean;
  last_score_at?: Date;
  last_promotion_at?: Date;
  last_demotion_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// A promotion or demotion event
export interface PromotionEvent {
  id: string;
  worker_name: string;
  job_type: string;
  event_type: PromotionEventType;
  from_tier: WorkerTier;
  to_tier: WorkerTier;
  from_score: number;
  to_score: number;
  reason: string;
  trigger_metric?: string;
  auto_applied: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// Configurable thresholds for the scoring engine
export interface PerformanceThreshold {
  id: string;
  tier_name: WorkerTier;
  min_score: number;
  max_score: number;
  promotion_threshold: number;
  demotion_threshold: number;
  periods_for_promotion: number;
  periods_for_demotion: number;
  requires_approval: boolean;
  default_title: string;
  weight_reliability: number;
  weight_throughput: number;
  weight_latency: number;
  weight_cost: number;
  weight_quality: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─── 15. CIRCUIT BREAKERS ───

export interface CircuitBreakerState {
  id: string;
  circuit_name: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  success_count: number;
  last_failure_at?: Date;
  last_success_at?: Date;
  opened_at?: Date;
  threshold: number;
  recovery_timeout_seconds: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DeadLetterJob {
  id: string;
  job_type: string;
  job_data: Record<string, unknown>;
  error_message?: string;
  failed_attempts: number;
  failed_at: Date;
  retry_later_at?: Date;
  is_resolved: boolean;
}

// ══════════════════════════════════════════════════════════════════
// 14. WEBSITE INTELLIGENCE / CLIENT SCRAPER
// ══════════════════════════════════════════════════════════════════

export interface WebsiteIntelligence {
  id: string;
  client_id: string;

  // Core site data
  url: string;
  domain?: string;
  pages_scanned: number;
  pages_found: string[];
  site_name?: string;
  description?: string;

  // Meta & SEO
  meta_keywords: string[];

  // Business intelligence
  services: Array<{ name: string; description?: string; page?: string }>;
  industries: string[];
  target_audience: string[];
  unique_selling_points: string[];

  // Tone analysis
  tone_analysis: {
    primary_tone: string;
    secondary_tone: string;
    tone_scores: Record<string, number>;
    formality_estimate: number;
  };

  // Vocabulary
  common_terms: string[];

  // CTA & structure
  cta_patterns: Array<{ text: string; url?: string; page?: string }>;
  page_structure: {
    h1: Array<{ text: string; page?: string }>;
    h2: Array<{ text: string; page?: string }>;
    h3: Array<{ text: string; page?: string }>;
  };

  // Contact & social
  contact_info: {
    email: string[];
    phone: string[];
    address: string[];
  };
  social_links: Array<{ platform: string; url: string }>;

  // Tech stack
  tech_stack_hints: string[];

  // Content gap analysis
  content_gaps: string[];

  // Full raw data
  raw_data: Record<string, unknown>;

  // Metadata
  is_stale?: boolean;
  scraped_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Intelligence formatted for AI prompt consumption
// This is the condensed version passed to OpenAI for article generation
export interface ClientIntelligencePrompt {
  company_name: string;
  description: string;
  industry: string;
  services: string;
  target_audience: string;
  tone: string;
  unique_selling_points: string;
  common_terms: string;
  cta_style: string;
}

// ─── Extended Article (with enterprise fields) ───

export interface ArticleWithEditorial extends Article {
  editorial_status?: EditorialStatus;
  editorial_assignments?: EditorialReviewAssignment[];
  editorial_reviews?: EditorialReview[];
  content_versions?: ContentVersion[];
  citations?: Citation[];
  fact_checks?: FactCheck[];
}
