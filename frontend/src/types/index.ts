export interface User {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'client';
  name?: string;
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
  created_at?: string;
  createdAt: string;
  word_count?: number;
  wordCount?: number;
  seo_score?: string | number;
  seoScore?: number;
}

export interface ClientAnalyticsOverview {
  articleStats: { total: number; draft: number; generated: number; approved: number; published: number };
  keywordStats: { total: number };
  publishStats: { thisMonth: number };
  costs: { total: number; openai: number; serp: number };
  seoScore?: { average: number; trend: 'up' | 'down' | 'stable' };
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
