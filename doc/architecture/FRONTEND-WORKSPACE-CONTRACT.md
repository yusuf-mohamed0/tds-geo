# Frontend Workspace Contract

Phase 5 started the role-aware command center baseline, and Phase 6 adds a narrow client workspace experience guard without changing backend authorization, API authorization, publishing behavior, report delivery, or credential handling.

Source of truth: `frontend/src/architecture/workspaceContract.ts`.

The contract is frontend-only and side-effect-free on direct import. It does not call APIs, read storage, initialize auth, navigate, enqueue work, publish content, send reports, or load credentials.

## Current State

| Area | Current State | Workspace Contract |
| --- | --- | --- |
| App shell | `/admin` uses `Layout`, `Header`, `Sidebar`, and nested routes in `frontend/src/App.tsx`. | The shell is mapped into manager workspaces before route behavior changes. |
| Roles | Backend auth recognizes `super_admin`, `admin`, `editor`, and `client`; frontend user typing previously omitted `super_admin`. | Frontend contract includes `super_admin`, `admin`, `editor`, and `client`. |
| Navigation | `Sidebar.tsx` renders role-aware navigation links from the authenticated user role. | Workspace routes are classified by intended role exposure, but hidden links are not security enforcement. |
| Client workspace | `ClientDashboard.tsx` exists at `/admin/clients/:clientId`. | Client dashboard is the intended client-role surface; global client list remains admin-scoped in the contract. |
| Ads reports | `AdsReportsPage.tsx` is an internal report control room. | Ads reports remain admin-only and internal-only until explicit delivery approval exists. |
| Health links | `/health` and `/metrics` are current operational endpoints. | They are listed as admin-facing links in the UI contract, but current backend routes are unauthenticated and must not be described as role-enforced. |

## Workspace Map

- System Command Center: dashboard and platform-cost readiness for `super_admin` and `admin`.
- Client Workspace: global clients for admins and client-specific dashboards for all app roles, subject to backend tenant scoping.
- Content Workspace: articles, article detail, quality, and keywords for operators.
- GEO Intelligence Workspace: GEO, GSC, citations, and backlinks for operators.
- Ads Reporting Workspace: internal-only report generation and review gates for admins.
- Operations Readiness Workspace: health and metrics links for admins, with current public endpoint behavior documented and subject to production network policy.

## Required Invariants

- This contract does not grant or deny access by itself.
- Navigation filtering is not a security boundary; backend authorization remains authoritative.
- Client users must never rely on hidden links for tenant isolation.
- Ads reporting remains internal-only until an explicit approval and delivery workflow exists.
- Frontend workspaces must not store, print, or render secret credential values.
- Health and metrics links must not be represented as backend role-enforced until backend auth actually gates them.

## Runtime Guard

`frontend/src/architecture/workspaceRouting.ts` redirects authenticated client-role users with a `clientId` from global `/admin` routes to `/admin/clients/{clientId}`. This is an experience guard only: direct data access and tenant isolation must still be enforced by backend authorization.

## Next Runtime Step

The next implementation step should add focused component-level tests around `Layout` and `Sidebar` rendering for `super_admin`, `admin`, `editor`, and `client` users before adding broader workspace dashboards or client-facing actions.
