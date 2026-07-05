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
}

export interface AdminDashboard {
  clients: { total: number; activeThisMonth: number };
  articles: { total: number; published: number; pending: number; weeklyPublished: number };
  keywords: { total: number; tracked: number };
  publishing: { total: number; thisMonth: number };
  costs: { total: number };
  users: { total: number; active: number };
  activity: { date: string; count: number }[];
  recentArticles: ArticleSummary[];
}

export interface ArticleSummary {
  id: string;
  title: string;
  status: string;
  clientName?: string;
  createdAt: string;
  wordCount?: number;
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
