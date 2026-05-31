// ──────────────────────────────────────────────
// Auth Routes
// ──────────────────────────────────────────────

import { Router } from 'express';
import { Pool } from 'pg';
import { createAuthRouter } from '../middleware/auth';

/**
 * Auth routes factory.
 * Delegates entirely to middleware/auth.ts (createAuthRouter) which contains
 * all auth endpoints: /register, /login, /me, /change-password,
 * /users, /users/:id, /users/:id/toggle, /users/:id/reset-password.
 * This file exists solely to maintain import compatibility in backend/index.ts.
 */
export function createAuthRoutes(pool: Pool): Router {
  return createAuthRouter(pool);
}
