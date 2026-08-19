import { apiFetch } from './client';

export interface AdsReportingClient {
  id: string;
  name: string;
  platforms: string[];
  metaAccounts: string[];
}

export interface AdsReportArtifact {
  clientId: string;
  month: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

export type AdsArtifactStatus = 'generated' | 'in_review' | 'approved' | 'rejected' | 'delivered';

export interface AdsRegistryEntry {
  id: string;
  clientId: string;
  month: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  sha256?: string;
  status: AdsArtifactStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  deliveredTo?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdsReportingStatus {
  projectRoot: string;
  projectReady: boolean;
  envReady: boolean;
  clientConfigReady: boolean;
  clients: AdsReportingClient[];
  artifacts: AdsReportArtifact[];
  roles: { role: string; owns: string }[];
  reviewGates: string[];
}

export interface AdsReporterRunResult {
  stdout: string;
  stderr: string;
  artifacts?: AdsReportArtifact[];
  synced?: { inserted: number; updated: number; total: number };
}

export function fetchAdsReportingStatus(): Promise<AdsReportingStatus> {
  return apiFetch<AdsReportingStatus>('/api/ads-reports/status');
}

export function dryRunAdsReport(clientId: string, month: string): Promise<AdsReporterRunResult> {
  return apiFetch<AdsReporterRunResult>(`/api/ads-reports/${clientId}/dry-run`, {
    method: 'POST',
    body: JSON.stringify({ month }),
  });
}

export function generateInternalAdsReport(clientId: string, month: string): Promise<AdsReporterRunResult> {
  return apiFetch<AdsReporterRunResult>(`/api/ads-reports/${clientId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ month }),
  });
}

export function runAllAdsReports(month: string): Promise<AdsReporterRunResult> {
  return apiFetch<AdsReporterRunResult>('/api/ads-reports/run-all', {
    method: 'POST',
    body: JSON.stringify({ month }),
  });
}

export function fetchAdsRegistry(filters: {
  clientId?: string;
  month?: string;
  status?: AdsArtifactStatus;
} = {}): Promise<AdsRegistryEntry[]> {
  const params = new URLSearchParams();
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.month) params.set('month', filters.month);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch<AdsRegistryEntry[]>(`/api/ads-reports/registry${qs ? `?${qs}` : ''}`);
}

export function syncAdsRegistry(): Promise<{ inserted: number; updated: number; total: number }> {
  return apiFetch<{ inserted: number; updated: number; total: number }>('/api/ads-reports/registry/sync', {
    method: 'POST',
  });
}

export function approveRegistryEntry(id: string): Promise<AdsRegistryEntry> {
  return apiFetch<AdsRegistryEntry>(`/api/ads-reports/registry/${id}/approve`, { method: 'POST' });
}

export function rejectRegistryEntry(id: string, reason: string): Promise<AdsRegistryEntry> {
  return apiFetch<AdsRegistryEntry>(`/api/ads-reports/registry/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function deliverRegistryEntry(id: string, deliveredTo: string): Promise<AdsRegistryEntry> {
  return apiFetch<AdsRegistryEntry>(`/api/ads-reports/registry/${id}/deliver`, {
    method: 'POST',
    body: JSON.stringify({ deliveredTo }),
  });
}
