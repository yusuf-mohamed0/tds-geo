import { describe, expect, it } from 'vitest';
import { clientWorkspacePath, redirectPathForWorkspace } from './workspaceRouting';

describe('workspaceRouting', () => {
  it('builds a client dashboard path only for scoped client users', () => {
    expect(clientWorkspacePath({ id: 'u1', email: 'client@test.com', role: 'client', clientId: 'client-1' })).toBe('/admin/clients/client-1');
    expect(clientWorkspacePath({ id: 'u2', email: 'admin@test.com', role: 'admin' })).toBeNull();
    expect(clientWorkspacePath({ id: 'u3', email: 'client@test.com', role: 'client' })).toBeNull();
  });

  it('redirects scoped client users away from global admin routes', () => {
    const user = { id: 'u1', email: 'client@test.com', role: 'client' as const, clientId: 'client-1' };

    expect(redirectPathForWorkspace(user, '/admin')).toBe('/admin/clients/client-1');
    expect(redirectPathForWorkspace(user, '/admin/ads-reports')).toBe('/admin/clients/client-1');
  });

  it('allows scoped client users to remain on their own dashboard path', () => {
    const user = { id: 'u1', email: 'client@test.com', role: 'client' as const, clientId: 'client-1' };

    expect(redirectPathForWorkspace(user, '/admin/clients/client-1')).toBeNull();
    expect(redirectPathForWorkspace(user, '/admin/clients/client-1/activity')).toBe('/admin/clients/client-1');
  });

  it('does not redirect operator roles from admin routes', () => {
    expect(redirectPathForWorkspace({ id: 'u1', email: 'admin@test.com', role: 'super_admin' }, '/admin')).toBeNull();
    expect(redirectPathForWorkspace({ id: 'u2', email: 'editor@test.com', role: 'editor' }, '/admin/articles')).toBeNull();
  });
});
