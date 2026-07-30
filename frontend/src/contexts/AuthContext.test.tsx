import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../api/client', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

const fetchMeMock = vi.fn();
const loginMock = vi.fn();

vi.mock('../api/auth', () => ({
  fetchMe: (...args: unknown[]) => fetchMeMock(...args),
  login: (...args: unknown[]) => loginMock(...args),
}));

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user">{auth.user ? auth.user.email : 'null'}</span>
      <button data-testid="login-btn" onClick={() => auth.login('a@b.com', 'pwd')}>Login</button>
      <button data-testid="logout-btn" onClick={auth.logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when useAuth is used outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider');
  });

  it('starts in loading state when token exists', async () => {
    const { getToken } = await import('../api/client');
    vi.mocked(getToken).mockReturnValue('fake-token');
    fetchMeMock.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('sets user when token is valid and fetchMe succeeds', async () => {
    const { getToken } = await import('../api/client');
    vi.mocked(getToken).mockReturnValue('fake-token');
    fetchMeMock.mockResolvedValue({ id: '1', email: 'admin@test.com', role: 'admin', name: 'Admin' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent('admin@test.com');
    });
  });

  it('clears token and stays unauthenticated when fetchMe fails', async () => {
    const { getToken } = await import('../api/client');
    vi.mocked(getToken).mockReturnValue('bad-token');
    fetchMeMock.mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    const { clearToken } = await import('../api/client');
    await waitFor(() => {
      expect(clearToken).toHaveBeenCalledOnce();
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
  });

  it('login calls apiLogin and updates user', async () => {
    loginMock.mockResolvedValue({ token: 'new-token', user: { id: '1', email: 'admin@test.com', role: 'admin' } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    screen.getByTestId('login-btn').click();

    const { setToken } = await import('../api/client');
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('a@b.com', 'pwd');
      expect(setToken).toHaveBeenCalledWith('new-token');
      expect(screen.getByTestId('user')).toHaveTextContent('admin@test.com');
    });
  });

  it('logout clears token and user', async () => {
    const { getToken } = await import('../api/client');
    vi.mocked(getToken).mockReturnValue('fake-token');
    fetchMeMock.mockResolvedValue({ id: '1', email: 'admin@test.com', role: 'admin', name: 'Admin' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'));

    screen.getByTestId('logout-btn').click();

    const { clearToken } = await import('../api/client');
    await waitFor(() => {
      expect(clearToken).toHaveBeenCalled();
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
  });
});
