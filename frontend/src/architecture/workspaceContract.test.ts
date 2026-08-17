import { describe, expect, it } from 'vitest';
import { FRONTEND_WORKSPACE_CONTRACT, routesForRole } from './workspaceContract';

describe('FRONTEND_WORKSPACE_CONTRACT', () => {
  it('keeps frontend roles aligned with backend-visible app roles', () => {
    expect(FRONTEND_WORKSPACE_CONTRACT.roles).toEqual(['super_admin', 'admin', 'editor', 'client']);
  });

  it('marks navigation-only surfaces as non-security enforcement', () => {
    const navigationOnlyRoutes = FRONTEND_WORKSPACE_CONTRACT.workspaces.flatMap((workspace) =>
      workspace.routes.filter((route) => route.enforcement === 'navigation-contract-only'),
    );

    expect(navigationOnlyRoutes.length).toBeGreaterThan(0);
    expect(FRONTEND_WORKSPACE_CONTRACT.invariants).toContain(
      'Navigation filtering is not a security boundary; backend authorization remains authoritative.',
    );
  });

  it('does not expose admin-only reporting routes to client role navigation', () => {
    const clientRoutes = routesForRole('client').map((route) => route.path);

    expect(clientRoutes).toContain('/admin/clients/:clientId');
    expect(clientRoutes).not.toContain('/admin/ads-reports');
    expect(clientRoutes).not.toContain('/admin');
  });

  it('does not describe public health endpoints as backend role-enforced', () => {
    const routes = FRONTEND_WORKSPACE_CONTRACT.workspaces.flatMap((workspace) => workspace.routes);

    expect(routes.find((route) => route.path === '/health')?.enforcement).toBe('public-health-endpoint');
    expect(routes.find((route) => route.path === '/metrics')?.enforcement).toBe('public-health-endpoint');
  });
});
