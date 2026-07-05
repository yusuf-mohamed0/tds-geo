import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import clientAuditService from '../services/clientAudit';

export function createAuditRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // Run a full AI SEO audit for a client
  router.post('/run', authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.body;

      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const clientResult = await pool.query(
        'SELECT id, name, shopify_shop, woo_url FROM clients WHERE id = $1 AND is_active = true',
        [clientId]
      );

      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Active client not found' });
        return;
      }

      const client = clientResult.rows[0];
      const domain = client.shopify_shop || new URL(client.woo_url || '').hostname || '';

      const audit = await clientAuditService.runAudit({
        name: client.name,
        domain,
        shopifyShop: client.shopify_shop,
        wooCommerceUrl: client.woo_url,
      });

      // Store audit results
      await pool.query(
        `INSERT INTO client_audits (client_id, audit_date, results, priority_score)
         VALUES ($1, NOW(), $2, $3)`,
        [clientId, JSON.stringify(audit), audit.priorityScore]
      );

      res.json(audit);
    } catch (err) {
      next(err);
    }
  });

  // Get audit history for a client
  router.get('/history/:clientId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, audit_date, results, priority_score, created_at
         FROM client_audits
         WHERE client_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [req.params.clientId]
      );

      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
