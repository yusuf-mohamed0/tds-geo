// ──────────────────────────────────────────────
// JWT Authentication & Authorization Middleware
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload, UserRole, DeviceFingerprint } from '../types';
import { logger } from '../utils/logger';
import deviceAuthService from '../services/deviceAuth';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '24', 10);

// ─── Token Utilities ─────────────────────────

export function generateToken(payload: JwtPayload, deviceId?: string, jti?: string): string {
  const tokenPayload: Record<string, unknown> = {
    ...payload,
    jti: jti || uuidv4(),
    deviceId: deviceId || null,
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: SESSION_TTL_HOURS * 3600, // seconds
  });
}

export function verifyToken(token: string): JwtPayload & { jti?: string; deviceId?: string } {
  return jwt.verify(token, JWT_SECRET) as JwtPayload & { jti?: string; deviceId?: string };
}

// ─── Express Middleware ───────────────────────

/**
 * Authenticate request via JWT Bearer token.
 * Attaches decoded user payload to `req.user`.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string | undefined;

  // Allow API key auth for connector integrations (WordPress, etc.)
  if (apiKey) {
    const allowedKey = process.env.TDS_GEO_WORDPRESS_API_KEY || process.env.API_KEY;
    if (allowedKey && apiKey === allowedKey) {
      (req as any).user = {
        id: 'connector',
        clientId: null,
        role: 'connector',
        email: 'connector@tdsgeo.ai',
      };
      next();
      return;
    }
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

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

// ══════════════════════════════════════════════
// DEVICE AUTHENTICATION MIDDLEWARE
// ══════════════════════════════════════════════

/**
 * Extract device fingerprint from request headers.
 * Client must send these headers on every authenticated request.
 */
export function extractDeviceFingerprint(req: Request): DeviceFingerprint | null {
  try {
    return {
      cpuIdentifier: (req.headers['x-device-cpu'] as string) || '',
      macHash: (req.headers['x-device-mac-hash'] as string) || '',
      osSerialHash: (req.headers['x-device-os-serial'] as string) || '',
      certThumbprint: (req.headers['x-device-cert'] as string) || undefined,
      browserFingerprint: (req.headers['x-device-browser-fp'] as string) || '',
      userAgent: req.headers['user-agent'] || '',
      screenResolution: (req.headers['x-device-resolution'] as string) || undefined,
      timezone: (req.headers['x-device-timezone'] as string) || undefined,
      language: (req.headers['x-device-language'] as string) || undefined,
      platform: (req.headers['x-device-platform'] as string) || '',
      ipAddress: req.ip || req.socket.remoteAddress || '',
    };
  } catch {
    return null;
  }
}

/**
 * Require device authorization AFTER authenticate middleware.
 * Validates the device is registered, not revoked, and has sufficient trust.
 * If auto-enrollment is enabled, unregistered devices will be enrolled automatically.
 */
export function requireDeviceAuth(pool: Pool): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user as JwtPayload | undefined;
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // super_admin can bypass device auth unless explicitly required
      const requireForAll = process.env.DEVICE_AUTH_REQUIRED_FOR_ALL === 'true';
      if (user.role === 'super_admin' && !requireForAll) {
        next();
        return;
      }

      const fingerprint = extractDeviceFingerprint(req);
      if (!fingerprint) {
        res.status(401).json({
          error: 'Device fingerprint missing',
          message: 'Re-authenticate from a registered device.',
          code: 'FINGERPRINT_MISSING',
        });
        return;
      }

      const fpHash = deviceAuthService.hashFingerprint(fingerprint);

      // Verify device is registered and not revoked
      const verification = await deviceAuthService.verifyDevice(user.userId, fpHash);

      if (!verification.valid) {
        // Auto-enroll if configured
        if (process.env.DEVICE_AUTO_ENROLL === 'true' && verification.reason === 'Device not registered') {
          await deviceAuthService.enrollDevice(
            user.userId,
            fingerprint,
            `${fingerprint.platform || 'Unknown'} device`,
            user.userId
          );

          // Re-verify after enrollment
          const reVerification = await deviceAuthService.verifyDevice(user.userId, fpHash);
          if (!reVerification.valid) {
            res.status(403).json({
              error: 'Device enrollment failed',
              code: 'ENROLLMENT_FAILED',
            });
            return;
          }

          // Attach device info
          (req as any).deviceId = reVerification.device!.id;
          (req as any).deviceFingerprintHash = fpHash;
          (req as any).deviceTrustScore = reVerification.device!.trustScore;
          next();
          return;
        }

        res.status(403).json({
          error: verification.reason || 'Unregistered device',
          message: 'This device is not authorized. Please contact your administrator.',
          code: verification.device?.isRevoked ? 'DEVICE_REVOKED' : 'UNREGISTERED_DEVICE',
        });
        return;
      }

      if (verification.device!.isRevoked) {
        // Log attempted use of revoked device
        try {
          await pool.query('SELECT log_device_activity($1, $2, $3, $4::jsonb, $5::inet)', [
            user.userId,
            verification.device!.id,
            'revoked_device_attempt',
            JSON.stringify({ path: req.originalUrl, method: req.method }),
            req.ip || '0.0.0.0',
          ]);
        } catch { /* non-critical */ }

        res.status(403).json({
          error: 'Device has been revoked',
          message: 'This device has been revoked. Contact your administrator.',
          code: 'DEVICE_REVOKED',
        });
        return;
      }

      // Attach device context to request
      (req as any).deviceId = verification.device!.id;
      (req as any).deviceFingerprintHash = fpHash;
      (req as any).deviceTrustScore = verification.device!.trustScore;

      // Update last_seen asynchronously (non-blocking)
      pool.query(
        'UPDATE device_registry SET last_seen_at = NOW(), last_ip = $2::inet WHERE id = $1',
        [verification.device!.id, req.ip || '0.0.0.0']
      ).catch(() => {});

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Optional device auth — logs fingerprint but doesn't reject.
 * Useful for endpoints that should track device info but not enforce.
 */
export function optionalDeviceAuth(pool: Pool): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user as JwtPayload | undefined;
    if (!user) {
      next();
      return;
    }

    const fingerprint = extractDeviceFingerprint(req);
    if (!fingerprint) {
      next();
      return;
    }

    try {
      const fpHash = deviceAuthService.hashFingerprint(fingerprint);
      const verification = await deviceAuthService.verifyDevice(user.userId, fpHash);
      if (verification.valid && verification.device && !verification.device.isRevoked) {
        (req as any).deviceId = verification.device.id;
        (req as any).deviceFingerprintHash = fpHash;
        (req as any).deviceTrustScore = verification.device.trustScore;
      }
    } catch {
      // Non-blocking
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

      // ── Device Binding ──
      let deviceId: string | undefined;
      let trustScore = 80;
      let deviceEnrolled = false;

      const fingerprint = extractDeviceFingerprint(req);
      if (fingerprint && process.env.DEVICE_ENABLED !== 'false') {
        const fpHash = deviceAuthService.hashFingerprint(fingerprint);
        const verification = await deviceAuthService.verifyDevice(user.id, fpHash);

        if (verification.valid && verification.device) {
          deviceId = verification.device.id;
          trustScore = verification.device.trustScore;
          deviceEnrolled = true;
        } else if (process.env.DEVICE_AUTO_ENROLL === 'true') {
          // Auto-register on first login from this device
          const registration = await deviceAuthService.enrollDevice(
            user.id,
            fingerprint,
            `${fingerprint.platform || 'Unknown'} device`,
            user.id
          );
          deviceId = registration.id;
          trustScore = registration.trustScore;
          deviceEnrolled = true;
        }
      }

      // Generate JWT with device binding
      const jti = uuidv4();
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id
      }, deviceId, jti);

      // Create session record if device is bound
      if (deviceId) {
        try {
          await deviceAuthService.createSession(
            user.id,
            deviceId,
            jti,
            req.ip || '0.0.0.0',
            req.headers['user-agent'] || '',
            SESSION_TTL_HOURS
          );
        } catch (sessionErr) {
          logger.warn('Session creation failed (non-blocking)', {
            error: (sessionErr as Error).message,
          });
        }
      }

      logger.info('User logged in', { userId: user.id, role: user.role, deviceEnrolled });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          client_id: user.client_id
        },
        device: deviceId ? {
          enrolled: deviceEnrolled,
          trustScore,
          deviceId,
        } : null,
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
