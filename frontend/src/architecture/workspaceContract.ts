import type { User } from '../types';

export type FrontendRole = User['role'];

export type WorkspaceId =
  | 'system-command'
  | 'client-operations'
  | 'content-production'
  | 'geo-intelligence'
  | 'ads-reporting'
  | 'operations-readiness';

export interface WorkspaceRouteContract {
  readonly label: string;
  readonly path: string;
  readonly currentSurface: 'live-route' | 'external-link' | 'planned-surface';
  readonly allowedRoles: readonly FrontendRole[];
  readonly enforcement: 'navigation-contract-only' | 'backend-enforced' | 'public-health-endpoint';
  readonly safetyNotes: readonly string[];
}

export interface WorkspaceContract {
  readonly id: WorkspaceId;
  readonly title: string;
  readonly manager: string;
  readonly purpose: string;
  readonly routes: readonly WorkspaceRouteContract[];
  readonly currentLimits: readonly string[];
}

export interface FrontendWorkspaceArchitectureContract {
  readonly runtimeWiring: 'contract-only';
  readonly roles: readonly FrontendRole[];
  readonly workspaces: readonly WorkspaceContract[];
  readonly invariants: readonly string[];
}

const ADMIN_ROLES = ['super_admin', 'admin'] as const;
const OPERATOR_ROLES = ['super_admin', 'admin', 'editor'] as const;
const ALL_APP_ROLES = ['super_admin', 'admin', 'editor', 'client'] as const;

export const FRONTEND_WORKSPACE_CONTRACT: FrontendWorkspaceArchitectureContract = {
  runtimeWiring: 'contract-only',
  roles: ALL_APP_ROLES,
  workspaces: [
    {
      id: 'system-command',
      title: 'System Command Center',
      manager: 'System Manager',
      purpose: 'Production health, architecture status, activity, auto-fix approval state, and platform-level readiness.',
      routes: [
        {
          label: 'Dashboard',
          path: '/admin',
          currentSurface: 'live-route',
          allowedRoles: ADMIN_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Do not treat the dashboard shell as a security boundary until route guards are centralized.'],
        },
        {
          label: 'Costs',
          path: '/admin/costs',
          currentSurface: 'live-route',
          allowedRoles: ADMIN_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Cost visibility can reveal provider usage patterns and should remain admin-scoped.'],
        },
      ],
      currentLimits: ['Admin dashboard mixes live data with architecture blueprint content.'],
    },
    {
      id: 'client-operations',
      title: 'Client Workspace',
      manager: 'Client Manager',
      purpose: 'Client records, client-specific dashboard, connections, team roles, and client-scoped operating state.',
      routes: [
        {
          label: 'Clients',
          path: '/admin/clients',
          currentSurface: 'live-route',
          allowedRoles: ADMIN_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Client users need scoped client dashboards, not the global client list.'],
        },
        {
          label: 'Client dashboard',
          path: '/admin/clients/:clientId',
          currentSurface: 'live-route',
          allowedRoles: ALL_APP_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Client scoping must come from backend auth and route loaders, not from hiding links.'],
        },
      ],
      currentLimits: ['Client route redirection exists in the app shell; backend authorization remains the tenant-isolation boundary.'],
    },
    {
      id: 'content-production',
      title: 'Content Workspace',
      manager: 'Content Manager',
      purpose: 'Articles, approvals, quality checks, keyword research, and publishing preparation.',
      routes: [
        {
          label: 'Articles',
          path: '/admin/articles',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Manual approval and hidden-draft publishing safeguards must remain backend-owned.'],
        },
        {
          label: 'Article detail',
          path: '/admin/articles/:id',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Direct article URLs still require backend authorization and tenant-scoped data access.'],
        },
        {
          label: 'Quality',
          path: '/admin/quality',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Quality gates are advisory unless tied to backend publish authorization.'],
        },
        {
          label: 'Keywords',
          path: '/admin/keywords',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Keyword operations should preserve client scoping when exposed to editors.'],
        },
      ],
      currentLimits: ['Article routes and publish actions are not yet represented as a single role-aware workflow surface.'],
    },
    {
      id: 'geo-intelligence',
      title: 'GEO Intelligence Workspace',
      manager: 'Intelligence Manager',
      purpose: 'GEO analysis, Search Console, citations, backlinks, and AI-search visibility workflows.',
      routes: [
        {
          label: 'GEO Analysis',
          path: '/admin/geo',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['External integrations must not expose credentials or raw OAuth tokens in UI state.'],
        },
        {
          label: 'Search Console',
          path: '/admin/gsc',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['GSC remains constrained by configured OAuth credentials and client scope.'],
        },
        {
          label: 'Citations',
          path: '/admin/citations',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Citation data should remain client-scoped before exposing client login surfaces.'],
        },
        {
          label: 'Backlinks',
          path: '/admin/backlinks',
          currentSurface: 'live-route',
          allowedRoles: OPERATOR_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['Backlink actions can affect external sites and should stay approval-gated.'],
        },
      ],
      currentLimits: ['GEO surfaces are separate pages rather than one manager workspace.'],
    },
    {
      id: 'ads-reporting',
      title: 'Ads Reporting Workspace',
      manager: 'Ads Manager',
      purpose: 'Internal-only paid ads report generation, dry-runs, artifacts, and approval gates.',
      routes: [
        {
          label: 'Ads Reports',
          path: '/admin/ads-reports',
          currentSurface: 'live-route',
          allowedRoles: ADMIN_ROLES,
          enforcement: 'navigation-contract-only',
          safetyNotes: ['No client email, live publish, or scheduled delivery without explicit approval.'],
        },
      ],
      currentLimits: ['Artifact registry and client delivery approval state are not yet durable frontend surfaces.'],
    },
    {
      id: 'operations-readiness',
      title: 'Operations Readiness Workspace',
      manager: 'Operations Manager',
      purpose: 'Deploy, smoke checks, backups, runbooks, metrics, and production readiness links.',
      routes: [
        {
          label: 'Health',
          path: '/health',
          currentSurface: 'external-link',
          allowedRoles: ADMIN_ROLES,
          enforcement: 'public-health-endpoint',
          safetyNotes: ['Current backend route is unauthenticated; production health output must not leak secrets.'],
        },
        {
          label: 'Metrics',
          path: '/metrics',
          currentSurface: 'external-link',
          allowedRoles: ADMIN_ROLES,
          enforcement: 'public-health-endpoint',
          safetyNotes: ['Current backend route is unauthenticated; metrics exposure must remain aligned with production network policy.'],
        },
      ],
      currentLimits: ['Operations readiness is mostly surfaced through docs and health endpoints, not a dedicated UI yet.'],
    },
  ],
  invariants: [
    'This contract does not grant or deny access by itself.',
    'Navigation filtering is not a security boundary; backend authorization remains authoritative.',
    'Client users must never rely on hidden links for tenant isolation.',
    'Ads reporting remains internal-only until an explicit approval and delivery workflow exists.',
    'Frontend workspaces must not store, print, or render secret credential values.',
  ],
};

export function routesForRole(role: FrontendRole): WorkspaceRouteContract[] {
  return FRONTEND_WORKSPACE_CONTRACT.workspaces.flatMap((workspace) =>
    workspace.routes.filter((route) => route.allowedRoles.includes(role)),
  );
}
