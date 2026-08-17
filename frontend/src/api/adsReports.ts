import { apiFetch } from './client';

export interface AdsReportingClient {
  id: string;
  name: string;
  platforms: string[];
  metaAccounts: string[];
  googleCustomers: string[];
}

export interface AdsReportArtifact {
  clientId: string;
  month: string;
  fileName: string;
  path: string;
  sizeBytes: number;
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
