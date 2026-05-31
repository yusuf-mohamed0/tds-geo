// ──────────────────────────────────────────────
// JWT Authentication & Authorization Middleware
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { JwtPayload, UserRole } from '../types';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-secret-key';
const JWT_EXPIRES_IN = '24h';

// ─── Token Utilities ─────────────────────────

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ─── Express Middleware ───────────────────────

/**
 * Authenticate request via JWT Bearer token.
 * Attaches decoded user payload to `req.user`.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}

/**
 * Optional authentication — attaches user if token present, but doesn't reject.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      (req as any).user = decoded;
    } catch {
      // Token invalid — proceed without auth
    }
  }

  next();
}

/**
 * Authorize by role(s). Must be used after `authenticate`.
 */
export function authorize(...roles: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as JwtPayload | undefined;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // super_admin bypasses all role checks
    if (user.role === 'super_admin') {
      next();
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        yourRole: user.role
      });
      return;
    }

    next();
  };
}

/**
 * Restrict to the same client or admin role.
 * Use on routes like /api/clients/:clientId/...
 */
export const authorizeClientAccess: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user as JwtPayload | undefined;

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // super_admin and admin can access any client
  if (user.role === 'super_admin' || user.role === 'admin') {
    next();
    return;
  }

  // Editors and clients can only access their own client
  const requestedClientId = req.params.clientId;
  if (user.clientId && user.clientId === requestedClientId) {
    next();
    return;
  }

  res.status(403).json({ error: 'You do not have access to this client\'s data' });
};

/**
 * Middleware: Forces non-admin users to use their own clientId from JWT.
 * Overrides req.query.clientId for list queries so client-role users
 * can only query their own store's data. Admins/super_admins pass through.
 */
export function scopeQueryByClient(req: Request, _res: Response, next: NextFunction): void {
  const user = (req as any).user as JwtPayload | undefined;

  if (user && user.clientId && user.role !== 'super_admin' && user.role !== 'admin') {
    // Override any clientId in query params with the user's own
    req.query.clientId = user.clientId;
  }

  next();
}

// Whitelist of valid table names for resource ownership checks (prevents SQL injection)
const VALID_RESOURCE_TABLES = new Set([
  'articles', 'keywords', 'webhooks', 'schedules', 'jobs',
  'api_keys', 'plugin_instances', 'seo_analytics',
]);

/**
 * Middleware factory: Verifies a DB resource belongs to the authenticated user's client.
 * Uses a whitelist of valid table names to prevent SQL injection.
 * Admin/super_admin roles bypass the check.
 *
 * Usage:
 *   router.get('/:id', requireResourceOwnership(pool, 'articles'), handler)
 */
export function requireResourceOwnership(pool: Pool, table: string) {
  if (!VALID_RESOURCE_TABLES.has(table)) {
    throw new Error(`Invalid table for resource ownership check: ${table}`);
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user as JwtPayload | undefined;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Admins and super_admins bypass ownership checks
    if (user.role === 'super_admin' || user.role === 'admin') {
      next();
      return;
    }

    if (!user.clientId) {
      res.status(403).json({ error: 'No client access configured' });
      return;
    }

    const resourceId = req.params.id;
    if (!resourceId) {
      res.status(400).json({ error: 'Resource ID required' });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT client_id FROM ${table} WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }

      if (result.rows[0].client_id !== user.clientId) {
        res.status(403).json({ error: 'You do not have access to this resource' });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Auth Routes ─────────────────────────────

export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, role = 'editor', clientId } = req.body;

      if (!email || !password || !name) {
        res.status(400).json({ error: 'Email, password, and name are required' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      // Validate password strength
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      // Check for existing user
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, client_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role, client_id, created_at`,
        [email, passwordHash, name, role, clientId || null]
      );

      const user = result.rows[0];
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id
      });

      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Update last login
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id
      });

      logger.info('User logged in', { userId: user.id, role: user.role });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          client_id: user.client_id
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/me
  router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokenUser = (req as any).user as JwtPayload;

      // Handle shop-based JWTs (from Shopify embedded auth)
      if (tokenUser.userId && tokenUser.userId.startsWith('shop:')) {
        const shop = tokenUser.userId.replace('shop:', '');
        // Return a synthetic user for the shop
        res.json({
          id: tokenUser.userId,
          email: tokenUser.email,
          name: `Shopify Store: ${shop}`,
          role: tokenUser.role || 'admin',
          client_id: null,
          shop,
          is_shopify_auth: true,
          last_login_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        return;
      }

      const result = await pool.query(
        'SELECT id, email, name, role, client_id, last_login_at, created_at FROM users WHERE id = $1',
        [tokenUser.userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── User Management Routes (admin only) ──────────────────

  // POST /api/auth/change-password
  router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = (req as any).user;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password are required' });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters' });
        return;
      }

      const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.userId]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!validPassword) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, user.userId]);

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/users (admin only)
  router.get('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const result = await pool.query(
        `SELECT id, email, name, role, client_id, is_active, last_login_at, created_at
         FROM users ORDER BY created_at DESC`
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/auth/users/:id (admin only - update user)
  router.put('/users/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { email, name, role, client_id, is_active } = req.body;
      const userId = req.params.id;

      const existing = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (email) {
        const emailCheck = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, userId]
        );
        if (emailCheck.rows.length > 0) {
          res.status(409).json({ error: 'Email already in use' });
          return;
        }
      }

      const result = await pool.query(
        `UPDATE users SET
           email = COALESCE($1, email),
           name = COALESCE($2, name),
           role = COALESCE($3, role),
           client_id = $4,
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
         WHERE id = $6
         RETURNING id, email, name, role, client_id, is_active, last_login_at, created_at`,
        [email || null, name || null, role || null, client_id !== undefined ? client_id : null, is_active !== undefined ? is_active : null, userId]
      );

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/auth/users/:id (admin only - hard delete)
  router.delete('/users/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const userId = req.params.id;

      if (userId === user.userId) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }

      const targetUser = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (targetUser.rows.length > 0 && targetUser.rows[0].role === 'super_admin' && user.role !== 'super_admin') {
        res.status(403).json({ error: 'Only the super admin can delete another super admin' });
        return;
      }

      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email, name', [userId]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: 'User deleted', user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/auth/users/:id/toggle (admin only - toggle active status)
  router.patch('/users/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const userId = req.params.id;

      if (userId === user.userId) {
        res.status(400).json({ error: 'Cannot toggle your own account status' });
        return;
      }

      const targetUser = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (targetUser.rows.length > 0 && targetUser.rows[0].role === 'super_admin' && user.role !== 'super_admin') {
        res.status(403).json({ error: 'Only the super admin can modify another super admin' });
        return;
      }

      const result = await pool.query(
        `UPDATE users SET is_active = NOT is_active, updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, name, role, is_active`,
        [userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/users/:id/reset-password (admin only)
  router.post('/users/:id/reset-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters' });
        return;
      }

      const userId = req.params.id;

      const targetUser = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (targetUser.rows.length > 0 && targetUser.rows[0].role === 'super_admin' && user.role !== 'super_admin') {
        res.status(403).json({ error: 'Only the super admin can reset another super admin\'s password' });
        return;
      }
      const existing = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, userId]
      );

      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default { authenticate, optionalAuth, authorize, authorizeClientAccess, generateToken, createAuthRouter };
