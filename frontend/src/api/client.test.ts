import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('client API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, href: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('token management', () => {
    it('getToken returns null when no token stored', async () => {
      const { getToken } = await import('./client');
      expect(getToken()).toBeNull();
    });

    it('setToken stores token in localStorage', async () => {
      const { setToken, getToken } = await import('./client');
      setToken('my-token');
      expect(getToken()).toBe('my-token');
    });

    it('clearToken removes token from localStorage', async () => {
      const { setToken, getToken, clearToken } = await import('./client');
      setToken('my-token');
      clearToken();
      expect(getToken()).toBeNull();
    });
  });

  describe('apiFetch', () => {
    it('sends GET request and returns JSON', async () => {
      const mockData = { id: 1, name: 'Test' };
      fetchMock(mockData, { ok: true, status: 200 });

      const { apiFetch } = await import('./client');
      const result = await apiFetch('/api/test');
      expect(result).toEqual(mockData);
    });

    it('includes Authorization header when token exists', async () => {
      const { setToken } = await import('./client');
      setToken('bearer-token');

      fetchMock({}, { ok: true, status: 200 });

      const { apiFetch } = await import('./client');
      await apiFetch('/api/test');

      const calls = vi.mocked(fetch).mock.calls;
      const headers = calls[0][1]?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer bearer-token');
    });

    it('clears token and redirects on 401', async () => {
      fetchMock({ error: 'Unauthorized' }, { ok: false, status: 401 });

      const { apiFetch } = await import('./client');
      await expect(apiFetch('/api/protected')).rejects.toThrow('Unauthorized');
      expect(localStorage.getItem('kivo_token')).toBeNull();
    });

    it('throws on non-ok response with error message', async () => {
      fetchMock({ error: 'Not Found' }, { ok: false, status: 404 });

      const { apiFetch } = await import('./client');
      await expect(apiFetch('/api/notfound')).rejects.toThrow('Not Found');
    });

    it('falls back to status text when no error message', async () => {
      fetchMock({}, { ok: false, status: 500 });

      const { apiFetch } = await import('./client');
      await expect(apiFetch('/api/error')).rejects.toThrow('Request failed (500)');
    });

    it('merges custom headers', async () => {
      fetchMock({}, { ok: true, status: 200 });

      const { apiFetch } = await import('./client');
      await apiFetch('/api/test', {
        headers: { 'X-Custom': 'value' },
      });

      const calls = vi.mocked(fetch).mock.calls;
      const headers = calls[0][1]?.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Custom']).toBe('value');
    });
  });
});

function fetchMock(data: unknown, init: { ok: boolean; status: number }) {
  vi.mocked(fetch).mockReset();
  vi.mocked(fetch).mockResolvedValue({
    ok: init.ok,
    status: init.status,
    json: () => Promise.resolve(data),
  } as Response);
}

vi.stubGlobal('fetch', vi.fn());
