import { apiFetch } from './client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface ActivityEvent {
  surface: string;
  actorType: string;
  actorId?: string | null;
  clientId?: string | null;
  action: string;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  success: boolean;
  durationMs?: number | null;
  shop?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  occurredAt?: string;
}

export interface ActivitySummary {
  total: number;
  errors: number;
  web: number;
  shopify: number;
  api: number;
  worker: number;
  connector: number;
  system: number;
  unique_actors: number;
  unique_clients: number;
  avg_duration_ms: number | null;
}

export interface AutoFixSummary {
  total: number;
  fixed: number;
  pending: number;
  failed: number;
}

export interface AutoFixRun {
  id: number;
  runAt: string;
  surface?: string | null;
  action?: string | null;
  severity: string;
  category: string;
  fixApplied?: string | null;
  requiresApproval: boolean;
  outcome?: string | null;
  errorMessage?: string | null;
}

export async function fetchActivitySummary(): Promise<ActivitySummary> {
  const res = await apiFetch<ApiResponse<ActivitySummary>>('/api/activity/summary?since=24%20hours');
  return res.data;
}

export async function fetchActivityFeed(limit = 8): Promise<ActivityEvent[]> {
  const res = await apiFetch<ApiResponse<ActivityEvent[]>>(`/api/activity?limit=${limit}&since=24%20hours`);
  return res.data || [];
}

export async function fetchAutoFixSummary(): Promise<AutoFixSummary> {
  const res = await apiFetch<ApiResponse<AutoFixSummary>>('/api/autofix/summary');
  return res.data;
}

export async function fetchPendingAutoFixes(): Promise<AutoFixRun[]> {
  const res = await apiFetch<ApiResponse<AutoFixRun[]>>('/api/autofix/pending');
  return res.data || [];
}
