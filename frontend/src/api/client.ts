import { isEmbedded } from '../lib/embedded';

const TOKEN_KEY = 'kivo_token';

const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function trackApiRequest(payload: {
  route: string;
  method: string;
  statusCode: number;
  success: boolean;
  durationMs: number;
  errorType?: string | null;
  errorMessage?: string | null;
}): void {
  if (import.meta.env.MODE === 'test') return;
  import('../lib/telemetry')
    .then(({ track }) => track('api.request', payload))
    .catch(() => {});
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchCsrfToken(authToken: string): Promise<string> {
  const response = await fetch('/api/csrf/token', {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!response.ok) {
    throw new Error(`Could not prepare secure request (${response.status})`);
  }

  const data = await response.json() as { csrfToken?: string };
  if (!data.csrfToken) throw new Error('Could not prepare secure request.');
  return data.csrfToken;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const startedAt = Date.now();
  const embedded = isEmbedded();
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !embedded) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = (options.method || 'GET').toUpperCase();
  if (token && !embedded && !CSRF_SAFE_METHODS.has(method) && !headers['X-CSRF-Token']) {
    headers['X-CSRF-Token'] = await fetchCsrfToken(token);
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    if (!embedded) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const contentType = response.headers?.get?.('content-type') || '';
  const data = contentType.includes('application/json') || !response.text
    ? await response.json()
    : await response.text();

  const status = response.status;
  trackApiRequest({
    route: url,
    method,
    statusCode: status,
    success: status < 400,
    durationMs: Date.now() - startedAt,
    errorType: status >= 500 ? `http_${status}` : null,
    errorMessage: status >= 400 ? (typeof data === 'string' ? data : data?.error || data?.message || `HTTP ${status}`) : null,
  });

  if (!response.ok) {
    if (typeof data === 'string') throw new Error(data || `Request failed (${response.status})`);
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }

  return data as T;
}
