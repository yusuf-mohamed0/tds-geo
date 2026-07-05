import { apiFetch } from './client';
import type { AdminDashboard, HealthStatus } from '../types';

export function fetchDashboard(): Promise<AdminDashboard> {
  return apiFetch<AdminDashboard>('/api/admin/dashboard');
}

export function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}
