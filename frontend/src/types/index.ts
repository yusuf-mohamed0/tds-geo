export interface User {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'client';
  name?: string;
  clientId?: string;
}

export interface HealthStatus {
  database: { status: string; latency: number };
  redis: { status: string; latency: number };
  openai: { status: string };
  ollama: { status: string };
  sidecars: { status: string; count: number };
  checks?: Record<string, Record<string, string>>;
}

export interface AdminDashboard {
  clients: { total: number; active: number; new_30d: number };
  articles: { total: number; published: number; pending_review: number; this_week: number };
  keywords: { total: number; avg_relevance: string };
  publishing: { total: number; this_week: number };
  costs: { total_cost_mtd: string; total_tokens_mtd: number };
  users: { total: number; admins: number; editors: number; clients: number };
  activity: { date: string; count: number }[];
  recentArticles: ArticleSummary[];
}

export interface ArticleSummary {
  id: string;
  title: string;
  status: string;
  client_id?: string;
  keyword?: string;
  locale?: string;
  scheduled_at?: string | null;
  created_at?: string;
  createdAt: string;
  word_count?: number;
  wordCount?: number;
  seo_score?: string | number;
  seoScore?: number;
}

export interface ClientAnalyticsOverview {
  articles: { total: number; draft?: number; generated?: number; pending: number; approved: number; published: number; rejected?: number; failed?: number };
  keywords: { total: number };
  publishing: { total: number; last_30d: number };
  costs: { total_cost: number | string; openai: number | string; serpapi: number | string };
  seoScore?: { average: number; trend: 'up' | 'down' | 'stable' };
  client: {
    id: string; name: string; slug: string; shopify_shop?: string | null; brand_voice?: string | null;
    service_area?: string | null; timezone: string; publish_frequency: string; preferred_publish_hour?: number | null;
    approval_mode: string; is_active: boolean; locale?: string | null; settings: Record<string, unknown>; updated_at: string;
  };
  profile: {
    industry: string; summary: string; contentFocus: string[];
    presentation: { id: string; accent: string; accentSoft: string; text: string; border: string; headingFont: string; bodyFont: string; radius: string; headingRule: string };
  };
  team: { role: string; count: number; members: string[] }[];
  connections: { provider: string; is_primary: boolean; is_active: boolean; default_blog_id?: string | null }[];
  contentRules: { minimumWords: number; requiresManualApproval: boolean; sourceFormat: string; safeguards: string[] };
}

export interface SystemError {
  id: string;
  level: string;
  message: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface GscOverview {
  connected: boolean;
  email?: string;
  stats: {
    totalImpressions: number;
    totalClicks: number;
    avgCtr: number;
    avgPosition: number;
  };
  sites: Array<{
    id: string;
    site_url: string;
    permission_level: string;
    last_sync_at: string | null;
  }>;
  dailyData: Array<{ date: string; impressions: number; clicks: number }>;
  topQueries: Array<{ query: string; impressions: number; clicks: number; ctr: number; avgPosition: number }>;
}
