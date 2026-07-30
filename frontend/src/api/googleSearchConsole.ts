import { apiFetch } from './client';

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

export function fetchGscOverview(clientId: string, days = 30): Promise<GscOverview> {
  return apiFetch<GscOverview>(`/api/gsc/overview?clientId=${clientId}&days=${days}`);
}

export function fetchGscStatus(clientId: string): Promise<{ connected: boolean; email?: string }> {
  return apiFetch<{ connected: boolean; email?: string }>(`/api/gsc/status?clientId=${clientId}`);
}
