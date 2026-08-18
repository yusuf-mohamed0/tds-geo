import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import Layout from './Layout';
import type { User } from '../types';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

const useAuthMock = vi.mocked(useAuth);

function makeUser(role: User['role'], clientId?: string): User {
  return { id: 'u1', email: 'user@test.com', role, clientId };
}

function renderLayout(user: User | null, loading = false, path = '/admin') {
  useAuthMock.mockReturnValue({ user, loading, login: vi.fn(), setUser: vi.fn(), logout: vi.fn(), isAuthenticated: !!user });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<Layout />}>
          <Route index element={<div>Admin Home</div>} />
          <Route path="clients/:clientId" element={<div>Client Dashboard</div>} />
        </Route>
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

function LoginStub() {
  const [params] = useSearchParams();
  return <div>Login Page redirect={params.get('redirect') ?? 'none'}</div>;
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to login with redirect param', () => {
    renderLayout(null, false);

    expect(screen.getByText('Login Page redirect=/admin')).toBeInTheDocument();
  });

  it('shows loading spinner while loading', () => {
    renderLayout(null, true);

    expect(document.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders the admin shell for super_admin users', () => {
    renderLayout(makeUser('super_admin'));

    expect(screen.getByText('Admin Home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ads Reports' })).toBeInTheDocument();
  });

  it('renders the admin shell for admin users', () => {
    renderLayout(makeUser('admin'));

    expect(screen.getByText('Admin Home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders the admin shell for editor users', () => {
    renderLayout(makeUser('editor'));

    expect(screen.getByText('Admin Home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Articles' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ads Reports' })).toBeNull();
  });

  it('redirects scoped client users from global /admin to their dashboard', () => {
    renderLayout(makeUser('client', 'client-1'), false, '/admin');

    expect(screen.getByText('Client Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My workspace' })).toHaveAttribute('href', '/admin/clients/client-1');
  });

  it('keeps client users on their own dashboard path', () => {
    renderLayout(makeUser('client', 'client-1'), false, '/admin/clients/client-1');

    expect(screen.getByText('Client Dashboard')).toBeInTheDocument();
  });

  it('does not redirect a malformed client without clientId to a bad /admin fallback', () => {
    renderLayout(makeUser('client'), false, '/admin');

    expect(screen.getByText('Admin Home')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My workspace' })).toBeNull();
  });
});