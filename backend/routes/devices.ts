// ──────────────────────────────────────────────
// Device Authorization Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, extractDeviceFingerprint } from '../middleware/auth';
import deviceAuthService from '../services/deviceAuth';
import { logger } from '../utils/logger';

export function createDeviceRoutes(pool: Pool): Router {
  const router = Router();

  // ─── POST /api/devices/enroll ─────────────
  // Register the current device for the authenticated user
  router.post('/enroll', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const fingerprint = extractDeviceFingerprint(req);

      if (!fingerprint) {
        res.status(400).json({ error: 'Device fingerprint headers required' });
        return;
      }

      const device = await deviceAuthService.enrollDevice(
        user.userId,
        fingerprint,
        req.body.deviceName || undefined,
        user.userId
      );

      logger.info('Device enrolled via API', {
        userId: user.userId,
        deviceId: device.id,
        trustScore: device.trustScore,
      });

      res.json({
        success: true,
        data: {
          id: device.id,
          deviceName: device.deviceName,
          deviceType: device.deviceType,
          trustScore: device.trustScore,
          enrolledAt: device.enrolledAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /api/devices ────────────────────
  // List all registered devices for the authenticated user
  router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const devices = await deviceAuthService.getUserDevices(user.userId);

      res.json({
        success: true,
        data: devices.map(d => ({
          id: d.id,
          deviceName: d.deviceName,
          deviceType: d.deviceType,
          trustScore: d.trustScore,
          isRevoked: d.isRevoked,
          lastSeenAt: d.lastSeenAt,
          enrolledAt: d.enrolledAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── DELETE /api/devices/:id/revoke ──────
  // Revoke a device (admin/super_admin only)
  router.delete('/:id/revoke', authenticate, authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { reason } = req.body;

      await deviceAuthService.revokeDevice(
        req.params.id,
        user.userId,
        reason || 'Revoked by administrator'
      );

      res.json({ success: true, message: 'Device revoked' });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /api/devices/audit ──────────────
  // View device audit log (super_admin only)
  router.get('/audit', authenticate, authorize('super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, deviceId, limit = 50, offset = 0 } = req.query;

      let query = 'SELECT * FROM device_audit_log WHERE 1=1';
      const params: any[] = [];
      let idx = 1;

      if (userId) {
        query += ` AND user_id = $${idx++}`;
        params.push(userId);
      }
      if (deviceId) {
        query += ` AND device_id = $${idx++}`;
        params.push(deviceId);
      }

      query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
