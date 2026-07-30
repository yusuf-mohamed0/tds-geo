import { describe, it, expect, vi } from 'vitest';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

describe('auth API', () => {
  it('login calls apiFetch with POST and credentials', async () => {
    const { apiFetch } = await import('./client');
    vi.mocked(apiFetch).mockResolvedValue({
      token: 'abc',
      user: { id: '1', email: 'a@b.com', role: 'admin' },
    });

    const { login } = await import('./auth');
    const result = await login('a@b.com', 'password123');

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'password123' }),
    });
    expect(result.token).toBe('abc');
    expect(result.user.email).toBe('a@b.com');
  });

  it('fetchMe calls apiFetch with GET', async () => {
    const { apiFetch } = await import('./client');
    vi.mocked(apiFetch).mockResolvedValue({ id: '1', email: 'a@b.com', role: 'admin' });

    const { fetchMe } = await import('./auth');
    const user = await fetchMe();

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/me');
    expect(user.email).toBe('a@b.com');
  });
});
