import { apiFetch } from './client';

export interface DemoStatus {
  is_demo: boolean;
  trial_ends_at: string | null;
  days_remaining: number;
  articles_used: number;
  articles_limit: number;
  tokens_used: number;
  tokens_limit: number;
  expired: boolean;
}

export function signupDemo(data: { email: string; name: string; password: string; company?: string }): Promise<{ success: boolean; message: string; clientId: string }> {
  return apiFetch('/api/demo/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getDemoStatus(clientId: string): Promise<DemoStatus> {
  return apiFetch(`/api/demo/status?clientId=${clientId}`);
}

export function upgradeDemo(clientId: string, shopifyShop: string, shopifyToken: string): Promise<{ success: boolean }> {
  return apiFetch('/api/demo/upgrade', {
    method: 'POST',
    body: JSON.stringify({ clientId, shopifyShop, shopifyToken }),
  });
}
