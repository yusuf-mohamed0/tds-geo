# Authentication & User Roles

## Role Hierarchy

```
super_admin  ── full access, bypasses all checks
    admin    ── can access any client, manage users, manage settings
      editor ── scoped to own client, CRUD articles, cannot approve/publish
       client ── read-only within own client
```

## JWT Authentication

| Property | Value |
|---|---|
| Library | jsonwebtoken + bcryptjs |
| Token secret | JWT_SECRET env var |
| Token expiry | JWT_EXPIRES_IN env var (default 24h) |
| Token payload | `{ userId, email, role, clientId, jti, deviceId }` |
| Auth header | `Authorization: Bearer <token>` |
| Alternative | `x-api-key` header (timing-safe comparison) |

## Middleware Functions

| Function | What It Does |
|---|---|
| `authenticate` | Parse Bearer token → attach `req.user` |
| `optionalAuth` | Same but never rejects (no token = no user) |
| `authorize(...roles)` | Check user role against allowed roles |
| `authorizeClientAccess` | Ensure non-admin users only access their own clientId |
| `scopeQueryByClient` | Force query clientId for non-admins |
| `requireResourceOwnership(pool, table)` | Verify DB resource belongs to user's client |

## Auth Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/register` | POST | None | Create user, return JWT |
| `/api/auth/login` | POST | None | Login with email+password, device binding |
| `/api/auth/me` | GET | Required | Current user profile |
| `/api/auth/change-password` | POST | Required | Change password |
| `/api/auth/users` | GET | Admin | List all users |
| `/api/auth/users/:id` | PUT | Admin | Update user |
| `/api/auth/users/:id` | DELETE | Admin | Delete user |
| `/api/auth/users/:id/toggle` | PATCH | Admin | Toggle active status |

## Permission Matrix

Seeded in database via `permission_matrix` table:

| Role | Permissions |
|---|---|
| super_admin | Everything (manage on *) |
| admin | Read * (all resources), manage clients, manage users, but cannot approve/publish articles |
| editor | Create/read/update articles, cannot approve or publish |
| client | Read articles, read keywords (own client only) |

## Device Authentication

Optional device-bound auth for employees:

- Device fingerprint extracted from request headers
- Devices must be registered in `device_registry` table
- RLS (Row-Level Security) enabled on `device_registry` and `employee_sessions`
- Auto-enrollment possible via `DEVICE_AUTO_ENROLL` setting

## API Key Authentication

For server-to-server (WordPress plugin, webhooks):

- `X-TDS-GEO-Key` header for WordPress API keys
- `x-api-key` header for master API key (from env)
- Timing-safe comparison via `crypto.timingSafeEqual`

## Shopify Session Auth

For the embedded app:

- Session tokens from Shopify App Bridge
- OAuth access tokens stored in `shopify_sessions` table
- HMAC verification for webhooks and OAuth callback
