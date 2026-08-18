import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import Sidebar from './Sidebar';
import type { User } from '../types';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

const useAuthMock = vi.mocked(useAuth);

function makeUser(role: User['role'], clientId?: string): User {
  return { id: 'u1', email: 'user@test.com', role, clientId };
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: null, loading: false, login: vi.fn(), setUser: vi.fn(), logout: vi.fn(), isAuthenticated: false });
  });

  it('shows admin links and hides My workspace for admin users', () => {
    useAuthMock.mockReturnValue({ user: makeUser('admin'), loading: false, login: vi.fn(), setUser: vi.fn(), logout: vi.fn(), isAuthenticated: true });

    render(<Sidebar open onClose={() => {}} />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute('href', '/admin/clients');
    expect(screen.getByRole('link', { name: 'Costs' })).toHaveAttribute('href', '/admin/costs');
    expect(screen.getByRole('link', { name: 'Ads Reports' })).toHaveAttribute('href', '/admin/ads-reports');
    expect(screen.queryByRole('link', { name: 'My workspace' })).toBeNull();
  });

  it('shows admin links for super_admin users', () => {
    useAuthMock.mockReturnValue({ user: makeUser('super_admin'), loading: false, login: vi.fn(), setUser: vi.fn(), logout: vi.fn(), isAuthenticated: true });

    render(<Sidebar open onClose={() => {}} />);

    expect(screen.getByRole('link', { name: 'Ads Reports' })).toHaveAttribute('href', '/admin/ads-reports');
    expect(screen.getByRole('link', { name: 'Costs' })).toHaveAttribute('href', '/admin/costs');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
  });

  it('shows editor links and hides admin-only links for editor users', () => {
    useAuthMock.mockReturnValue({ user: makeUser('editor'), loading: false, login: vi.fn(), setUser: vi.fn(), logout: vi.fn(), isAuthenticated: true });

    render(<Sidebar open onClose={() => {}} />);

    expect(screen.getByRole('link', { name: 'Articles' })).toHaveAttribute('href', '/admin/articles');
    expect(screen.getByRole('link', { name: 'GEO Analysis' })).toHaveAttribute('href', '/admin/geo');
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Clients' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Costs' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ads Reports' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'My workspace' })).toBeNull();
  });

  it('shows only My workspace pointing at the client dashboard for client users', () => {
    useAuthMock.mockReturnValue({ user: makeUser('client', 'client-1'), loading: false, login: vi.fn(), setUser: vi.fn(), logout: vi.fn(), isAuthenticated: true });

    render(<Sidebar open onClose={() => {}} />);

    expect(screen.getByRole('link', { name: 'My workspace' })).toHaveAttribute('href', '/admin/clients/client-1');
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Clients' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ads Reports' })).toBeNull();
  });

  it('renders no links for a malformed client without clientId (no /admin fallback)', () => {
    useAuthMock.mockReturnValue({ user: makeUser('client'), loading: false, login: vi.fn(), setUser: vi.fn(), logout: vi.fn(), isAuthenticated: true });

    render(<Sidebar open onClose={() => {}} />);

    expect(screen.queryByRole('link', { name: 'My workspace' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryAllByRole('link').filter((link) => (link.getAttribute('href') || '').startsWith('/admin')).length).toBe(0);
  });
});