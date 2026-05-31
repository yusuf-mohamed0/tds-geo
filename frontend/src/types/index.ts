export interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'editor' | 'client';
  client_id?: string;
  last_login_at?: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  shopify_shop: string;
  brand_voice?: string;
  service_area?: string;
  timezone?: string;
  publish_frequency?: string;
  approval_mode?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  client_id: string;
  keyword_id?: string;
  keyword?: string;
  title: string;
  slug: string;
  content_md: string;
  content_html?: string;
  meta_title?: string;
  meta_description?: string;
  tags: string[];
  word_count: number;
  status: string;
  seo_score?: number;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  client_id: string;
  keyword: string;
  search_volume: number;
  competition: number;
  relevance_score: number;
  source: string;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
}

export interface Webhook {
  id: string;
  client_id: string;
  name?: string;
  url: string;
  events: string[];
  retry_count: number;
  timeout_ms: number;
  is_active: boolean;
  last_triggered_at?: string;
  created_at: string;
}

export interface PublishHistory {
  id: string;
  article_id: string;
  article_title?: string;
  shopify_article_id: number;
  shopify_blog_id: number;
  published_url: string;
  status: string;
  published_at: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  client_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  level: string;
  message: string;
  metadata?: any;
  created_at: string;
}

export interface DashboardOverview {
  articles: { total: number; published: number; pending: number; approved: number; rejected: number; failed: number; avg_word_count: number; avg_seo_score: number };
  keywords: { total: number; unused: number; used_30d: number };
  publishing: { total: number; last_30d: number };
  recentArticles: Article[];
  costs: { total_cost: number; total_tokens: number; api_calls: number };
}

export interface AdminDashboard {
  clients: { total: number; active: number; new_30d: number };
  articles: { total: number; published: number; pending_review: number; this_week: number };
  keywords: { total: number; avg_relevance: number };
  publishing: { total: number; this_week: number };
  costs: { total_cost_mtd: number; total_tokens_mtd: number };
  users: { total: number; admins: number; editors: number; clients: number };
  activity: { date: string; count: number }[];
}

export interface SeoAnalysis {
  score: number;
  keywordDensity: number;
  readabilityScore: number;
  suggestions: string[];
  headingStructure: { h1: boolean; h2: number; h3: number };
}

// ═══ Platform Expansion Types ═══════════════════

export interface ApiKey {
  id: string;
  client_id: string;
  service: string;
  label: string;
  masked_value: string;
  permissions: string[];
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface Plugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  entry_point: string;
  config_schema: any;
  default_config: any;
  hooks: string[];
  is_active: boolean;
  is_system: boolean;
  installed_at: string;
  // Instance fields (when joined)
  instance_id?: string;
  instance_config?: any;
  is_enabled?: boolean;
  last_run_at?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  system_prompt: string;
  user_template: string;
  variables: string[];
  model: string;
  temperature: number;
  max_tokens: number;
  version: number;
  is_active: boolean;
  is_system: boolean;
  performance: { avgScore: number; totalRuns: number };
  created_at: string;
  updated_at: string;
  versions?: PromptTemplateVersion[];
}

export interface PromptTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  system_prompt: string;
  user_template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  changelog?: string;
  created_by?: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  context: any;
  is_active: boolean;
  message_count?: number;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls: any[];
  tool_results: any[];
  metadata: any;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  description: string;
  category: string;
  is_encrypted: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImprovementSuggestion {
  id: string;
  category: string;
  metric: string;
  value: number;
  context: any;
  suggestion: string;
  implemented: boolean;
  created_at: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
  jobId?: string;
  data?: any;
  requiresApproval: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ═══ Enterprise Upgrade Types ═══════════════════

// ─── Editorial Workflow ───
export type EditorialStatus =
  | 'draft' | 'generated' | 'in_seo_review' | 'seo_reviewed'
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
  due_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

export interface EditorialComment {
  id: string;
  article_id: string;
  parent_id?: string;
  author_id?: string;
  author_name?: string;
  content: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
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
  due_date?: string;
  publish_date?: string;
  notes?: string;
  created_at: string;
}

export interface ContentVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  content_md: string;
  change_summary?: string;
  created_by?: string;
  created_at: string;
}

export interface ContentLock {
  id: string;
  article_id: string;
  locked_by?: string;
  locked_at: string;
  expires_at: string;
}

// ─── Fact Checking ───
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
  extracted_date?: string;
  context?: string;
  reviewed_by_human: boolean;
  created_at: string;
}

export interface Citation {
  id: string;
  article_id: string;
  claim_text: string;
  source_text?: string;
  source_url?: string;
  source_title?: string;
  author?: string;
  publication_date?: string;
  confidence: number;
  is_validated: boolean;
  created_at: string;
}

export interface TrustedSource {
  id: string;
  client_id: string;
  domain: string;
  source_name?: string;
  category: string;
  authority_score: number;
  is_active: boolean;
  created_at: string;
}

export interface HighRiskTopic {
  id: string;
  client_id: string;
  category: string;
  keywords: string[];
  requires_citation: boolean;
  requires_human_review: boolean;
  is_active: boolean;
  created_at: string;
}

// ─── Brand Voice ───
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
  created_at: string;
  updated_at: string;
}

export interface BrandConsistencyResult {
  score: number;
  issues: { type: string; severity: string; message: string; suggestion: string }[];
  tone_match: number;
  vocabulary_match: number;
  format_match: number;
  overall: number;
}

export interface WritingFingerprint {
  avg_sentence_length: number;
  vocabulary_richness: number;
  passive_voice_ratio: number;
  transition_word_ratio: number;
  readability_score: number;
  common_phrases: string[];
  signature_patterns: string[];
}

// ─── Multi-CMS ───
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
  last_sync_at?: string;
  created_at: string;
}

export interface CmsProviderInfo {
  provider: CmsProvider;
  name: string;
  capabilities: string[];
}

export interface PublishResult {
  id: number;
  blogId: number;
  url: string;
  handle: string;
}

// ─── Cost Optimization ───
export interface CostReport {
  total_cost: number;
  total_tokens: number;
  by_provider: { provider: string; cost: number; calls: number }[];
  by_model: { model: string; cost: number; calls: number }[];
  daily_costs: { date: string; cost: number; tokens: number }[];
}

export interface BudgetStatus {
  within_budget: boolean;
  budget?: { token_limit: number; cost_limit: number; tokens_used: number; cost_used: number };
  usage_pct: number;
  recommendations: string[];
}

export interface ModelRoutingConfig {
  id: string;
  client_id: string;
  task_type: string;
  preferred_model: string;
  fallback_model?: string;
  max_cost_per_call?: number;
  priority: number;
  is_active: boolean;
}

export interface ModelRouterResult {
  model: string;
  provider: string;
  estimatedCost: number;
  maxTokens: number;
  reason: string;
}

// ─── Observability ───
export interface TraceSpan {
  id: string;
  trace_id: string;
  parent_span_id?: string;
  span_name: string;
  service_name: string;
  span_kind: string;
  status: 'ok' | 'error' | 'unset';
  status_message?: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  attributes: Record<string, unknown>;
  events: { name: string; timestamp: string; attributes: Record<string, unknown> }[];
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
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
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
  recorded_at: string;
}

export interface DashboardMetrics {
  active_alerts: number;
  critical_alerts: number;
  total_traces_today: number;
  error_rate: number;
  p95_latency: number;
  worker_stats: WorkerPerformance[];
  recent_alerts: SystemAlert[];
}

// ─── Security ───
export interface AuditLogEntry {
  id: string;
  client_id?: string;
  user_id?: string;
  user_name?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  outcome: 'success' | 'failure' | 'denied';
  created_at: string;
}

export interface PermissionEntry {
  id: string;
  role: string;
  resource: string;
  action: string;
  is_granted: boolean;
  created_at: string;
}

export interface RateLimitConfig {
  id: string;
  client_id: string;
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  burst_limit: number;
  is_active: boolean;
}

// ─── Content Intelligence ───
export interface ContentCannibalization {
  id: string;
  article_a_id: string;
  article_b_id: string;
  similarity_score: number;
  overlap_type: string;
  overlap_details: Record<string, unknown>;
  recommendation?: string;
  detected_at: string;
}

export interface TopicSaturation {
  id: string;
  client_id: string;
  topic: string;
  article_count: number;
  saturation_score: number;
  last_article_at?: string;
  recommendation: 'continue' | 'reduce' | 'stop' | 'diversify';
  created_at: string;
}

export interface KnowledgeGraphEntity {
  id: string;
  entity_name: string;
  entity_type: string;
  description?: string;
  confidence: number;
  source: string;
}

export interface LinkingOpportunity {
  article_id: string;
  article_title: string;
  relevance_score: number;
  match_type: string;
}

// ─── AI Evaluation ───
export interface QualityReport {
  overall_score: number;
  readability: { score: number; issues: string[] };
  seo_quality: { score: number; keyword_usage: string; suggestions: string[] };
  factual_accuracy: { score: number; issues: string[] };
  brand_consistency: { score: number; issues: string[] };
  structure: { score: number; issues: string[] };
  recommendations: string[];
}

export interface BenchmarkDataset {
  id: string;
  name: string;
  description?: string;
  category: string;
  version: string;
  test_case_count?: number;
  created_at: string;
}

export interface BenchmarkResult {
  dataset_id: string;
  test_cases: { input: string; expected: string; actual: string; score: number; error?: string }[];
  aggregate_score: number;
  total_tests: number;
  passed: number;
  failed: number;
  errors: number;
}

export interface AbTest {
  id: string;
  client_id: string;
  article_base_id: string;
  article_variant_id: string;
  test_name?: string;
  status: 'running' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  winner?: string;
  metrics: Record<string, unknown>;
  created_at: string;
}

// ─── Pexels ───
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

export interface PexelsImageResult {
  featuredImage: PexelsImage & { pexelsId: number };
  sectionImages: (PexelsImage & { section: string; pexelsId: number })[];
}

// ─── Queue / Jobs ───
export interface Job {
  id: string;
  job_id: string;
  type: string;
  status: 'queued' | 'active' | 'completed' | 'failed' | 'delayed' | 'dead_lettered';
  data: Record<string, unknown>;
  error_message?: string;
  attempts: number;
  max_attempts: number;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
}

// ─── Enterprise Dashboard ───
export interface EnterpriseDashboardData {
  articles: { total: number; published: number; pending: number; approved: number; rejected: number; failed: number; avg_word_count: number; avg_seo_score: number; avg_ai_score: number };
  keywords: { total: number; unused: number; used_30d: number };
  publishing: { total: number; last_30d: number };
  costs: { total_cost: number; total_tokens: number; api_calls: number };
  editorial: { pending_reviews: number; overdue_reviews: number; my_assignments: number };
  factCheck: { total_claims: number; verified: number; uncertain: number; false_claims: number };
  brandVoice: { has_profile: boolean; consistency_score?: number };
  observability: { active_alerts: number; error_rate: number; p95_latency_ms: number };
  contentIntel: { cannibalization_alerts: number; saturated_topics: number };
  recentArticles: any[];
}

// ─── Extended Article with enterprise fields ───
export interface ArticleWithEditorial extends Article {
  editorial_status?: EditorialStatus;
  editorial_status_display?: string;
  ai_evaluation_score?: number;
  editorial_assignments?: EditorialReviewAssignment[];
  editorial_reviews?: EditorialReview[];
  content_versions?: ContentVersion[];
  citations?: Citation[];
  fact_checks?: FactCheck[];
}

// ═══ API Usage Dashboard Types ════════════════

export interface ApiProviderUsage {
  provider: string;
  calls: number;
  total_cost: number;
  tokens_in: number;
  tokens_out: number;
  avg_duration_ms: number;
}

export interface ApiModelUsage {
  provider: string;
  model: string;
  calls: number;
  total_cost: number;
  tokens_in: number;
  tokens_out: number;
}

export interface ApiDailySeries {
  date: string;
  total_cost: number;
  total_calls: number;
  total_tokens: number;
}

export interface ApiDailyProviderCost {
  date: string;
  provider: string;
  cost: number;
}

export interface ApiUsageMtd {
  total_calls: number;
  total_cost: number;
  total_tokens: number;
  avg_duration_ms: number;
  total_tokens_in: number;
  total_tokens_out: number;
}

export interface ApiUsageData {
  days: number;
  mtd: ApiUsageMtd;
  perProvider: ApiProviderUsage[];
  perModel: ApiModelUsage[];
  dailySeries: ApiDailySeries[];
  dailyPerProvider: ApiDailyProviderCost[];
}
