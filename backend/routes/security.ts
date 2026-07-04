// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Enterprise Security Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import enterpriseSecurity from '../services/enterpriseSecurity';

export function createSecurityRoutes(pool: Pool): Router {
  const router = Router();
  enterpriseSecurity.initialize(pool);

  // Audit log
  router.get('/audit-log', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const result = await enterpriseSecurity.getAuditLog({
        clientId: req.query.clientId as string,
        userId: req.query.userId as string,
        action: req.query.action as string,
        resourceType: req.query.resourceType as string,
        severity: req.query.severity as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      });
      res.json({ success: true, data: result.entries, total: result.total });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Permission management
  router.get('/permissions', authenticate, authorize('super_admin'), async (req: Request, res: Response) => {
    try {
      const permissions = await enterpriseSecurity.getPermissions(req.query.role as any);
      res.json({ success: true, data: permissions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/permissions', authenticate, authorize('super_admin'), async (req: Request, res: Response) => {
    try {
      await enterpriseSecurity.setPermission(req.body);
      res.json({ success: true, message: 'Permission updated' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Rate limiting
  router.get('/rate-limit/:clientId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const config = await enterpriseSecurity.getRateLimitConfig(req.params.clientId);
      res.json({ success: true, data: config });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.put('/rate-limit/:clientId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      await enterpriseSecurity.setRateLimitConfig({ ...req.body, client_id: req.params.clientId });
      res.json({ success: true, message: 'Rate limit config updated' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check permission
  router.post('/check-permission', authenticate, async (req: Request, res: Response) => {
    try {
      const allowed = await enterpriseSecurity.checkPermission(
        (req as any).user.role,
        req.body.resource,
        req.body.action
      );
      res.json({ success: true, data: { allowed } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
