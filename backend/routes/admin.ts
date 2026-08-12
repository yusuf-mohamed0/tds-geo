// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Admin Dashboard & System Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { checkRedisHealth } from '../utils/redisHealth';
import { validate, adminNotifySchema } from '../validators/index';
import { sitesService } from '../services/sitesService';
import { encrypt, mask } from '../services/credentialEncryption';

export function createAdminRoutes(pool: Pool): Router {
  const router = Router();

  // Authentication required for all admin routes
  router.use(authenticate);

  // ─── System Overview (accessible to admins + editors) ───
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [clientStats, articleStats, keywordStats, publishStats, costStats, userStats, recentArticles] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE is_active)::int as active,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int as new_30d
           FROM clients`
        ),
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE status = 'published')::int as published,
                  COUNT(*) FILTER (WHERE status = 'generated')::int as pending_review,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as this_week
           FROM articles`
        ),
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COALESCE(AVG(relevance_score)::decimal(4,1), 0) as avg_relevance
           FROM keywords WHERE is_active = true`
        ),
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as this_week
           FROM publishing_history`
        ),
        pool.query(
          `SELECT COALESCE(SUM(cost_usd)::decimal(10,2), 0) as total_cost_mtd,
                  COALESCE(SUM(tokens_in + tokens_out)::bigint, 0) as total_tokens_mtd
           FROM cost_tracking
           WHERE created_at >= DATE_TRUNC('month', NOW())`
        ),
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE role = 'admin')::int as admins,
                  COUNT(*) FILTER (WHERE role = 'editor')::int as editors,
                  COUNT(*) FILTER (WHERE role = 'client')::int as clients
           FROM users WHERE is_active = true`
        ),
        pool.query(
          `SELECT a.*, k.keyword
           FROM articles a
           LEFT JOIN keywords k ON k.id = a.keyword_id
           ORDER BY a.created_at DESC
           LIMIT 10`
        )
      ]);

      // Last 30 days activity
      const activity = await pool.query(
        `SELECT DATE(created_at) as date, COUNT(*)::int as count
         FROM activity_logs
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY date`
      );

      res.json({
        clients: clientStats.rows[0],
        articles: articleStats.rows[0],
        keywords: keywordStats.rows[0],
        publishing: publishStats.rows[0],
        costs: costStats.rows[0],
        users: userStats.rows[0],
        activity: activity.rows,
        recentArticles: recentArticles.rows
      });
    } catch (err) {
      next(err);
    }
  });

  // Remaining admin routes require admin role
  router.use(authorize('admin'));

  // ─── List all errors (system-wide) ──────────
  router.get('/errors', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await pool.query(
        `SELECT * FROM activity_logs
         WHERE level = 'error'
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // ─── System Health ──────────────────────────
  router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const start = Date.now();

      // Check database
      await pool.query('SELECT 1');

      // Check Redis (shared client)
      const redisStatus = await checkRedisHealth();

      const dbDuration = Date.now() - start;

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks: {
          database: { status: 'healthy', responseTime: `${dbDuration}ms` },
          redis: { status: redisStatus }
        }
      });
    } catch (err) {
      res.status(503).json({
        status: 'degraded',
        error: (err as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // ─── Configuration (read-only view) ─────────
  router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const safeConfig: Record<string, string | undefined> = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        LOG_LEVEL: process.env.LOG_LEVEL,
        OPENAI_MODEL: process.env.OPENAI_MODEL,
        CONTENT_MIN_WORDS: process.env.CONTENT_MIN_WORDS,
        CONTENT_MAX_WORDS: process.env.CONTENT_MAX_WORDS,
        QUEUE_MAX_CONCURRENT: process.env.QUEUE_MAX_CONCURRENT,
        KEYWORD_DEDUP_WINDOW_DAYS: process.env.KEYWORD_DEDUP_WINDOW_DAYS,
        MIN_KEYWORD_VOLUME: process.env.MIN_KEYWORD_VOLUME,
        MAX_KEYWORD_COMPETITION: process.env.MAX_KEYWORD_COMPETITION,
        MAX_INTERNAL_LINKS_PER_ARTICLE: process.env.MAX_INTERNAL_LINKS_PER_ARTICLE,
        COST_MONTHLY_LIMIT: process.env.COST_MONTHLY_LIMIT,
        SHOPIFY_DEFAULT_API_VERSION: process.env.SHOPIFY_DEFAULT_API_VERSION
      };

      // Remove undefined values
      Object.keys(safeConfig).forEach(key => {
        if (safeConfig[key] === undefined) delete safeConfig[key];
      });

      res.json(safeConfig);
    } catch (err) {
      next(err);
    }
  });

  // ─── System Logs (raw) ──────────────────────
  router.get('/system-logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 100;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await pool.query(
        `SELECT * FROM activity_logs
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // ─── Recent Store Signups ───────────────────
  router.get('/recent-signups', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

      const result = await pool.query(
        `SELECT al.*, c.name AS client_name, c.shopify_shop
         FROM activity_logs al
         LEFT JOIN clients c ON c.id = al.client_id
         WHERE al.action = 'shopify_store_registered'
         ORDER BY al.created_at DESC
         LIMIT $1`,
        [limit]
      );

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // ═══════ Connected Sites Registry ══════════════

  router.get('/sites', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { platform, status, health, search } = req.query;
      const sites = await sitesService.list({
        platform: platform as any,
        status: status as any,
        health: health as any,
        search: search as string,
      });
      const stats = await sitesService.getStats();
      res.json({ success: true, data: sites, stats });
    } catch (err) {
      next(err);
    }
  });

  router.get('/sites/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { platform, status } = req.query;
      const sites = await sitesService.list({
        platform: platform as any,
        status: status as any,
      });

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Kivo OS';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Connected Sites');

      sheet.columns = [
        { header: 'Platform', key: 'platform', width: 14 },
        { header: 'Site Name', key: 'site_name', width: 30 },
        { header: 'Domain', key: 'domain', width: 40 },
        { header: 'Status', key: 'connection_status', width: 16 },
        { header: 'Health', key: 'health_status', width: 14 },
        { header: 'Connected At', key: 'connected_at', width: 22 },
        { header: 'Last Sync', key: 'last_sync_at', width: 22 },
        { header: 'Last Publish', key: 'last_publish_at', width: 22 },
        { header: 'Total Articles', key: 'total_articles_published', width: 16 },
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '171414' } };

      for (const site of sites) {
        sheet.addRow({
          platform: site.platform,
          site_name: site.site_name,
          domain: site.domain,
          connection_status: site.connection_status,
          health_status: site.health_status,
          connected_at: site.connected_at ? new Date(site.connected_at).toISOString().replace('T', ' ').slice(0, 19) : '-',
          last_sync_at: site.last_sync_at ? new Date(site.last_sync_at).toISOString().replace('T', ' ').slice(0, 19) : '-',
          last_publish_at: site.last_publish_at ? new Date(site.last_publish_at).toISOString().replace('T', ' ').slice(0, 19) : '-',
          total_articles_published: site.total_articles_published || 0,
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=connected-sites-${new Date().toISOString().slice(0, 10)}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      next(err);
    }
  });

  // ─── Broadcast Notification ────────────────
  router.post('/notify', validate(adminNotifySchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, level = 'info', clientIds } = req.body;

      if (clientIds && Array.isArray(clientIds)) {
        for (const clientId of clientIds) {
          await pool.query(
            `INSERT INTO activity_logs (client_id, action, level, message)
             VALUES ($1, 'admin_notification', $2, $3)`,
            [clientId, level, message]
          );
        }
      } else {
        // Broadcast to all active clients
        const clients = await pool.query('SELECT id FROM clients WHERE is_active = true');
        for (const client of clients.rows) {
          await pool.query(
            `INSERT INTO activity_logs (client_id, action, level, message)
             VALUES ($1, 'admin_notification', $2, $3)`,
            [client.id, level, message]
          );
        }
      }

      logger.info(`Admin notification sent: ${message}`);
      res.json({ message: 'Notification sent' });
    } catch (err) {
      next(err);
    }
  });

  // ─── Vault Sync (WordPress plugin pushes credential updates) ──
  router.post('/vault/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { siteUrl, username, password, wpUsername, wpPassword, dbName, dbUser, dbPassword, dbHost } = req.body;
      if (!siteUrl) {
        res.status(400).json({ error: 'siteUrl is required' });
        return;
      }

      const user = (req as any).user;
      const service = new URL(siteUrl).hostname.replace(/^www\./, '');

      const upsert = async (category: string, label: string, u: string, p: string, url: string, notes: string) => {
        const encUser = u ? encrypt(u) : '';
        const encPass = p ? encrypt(p) : '';
        const maskedU = u ? mask(u) : '';
        const maskedP = p ? mask(p) : '';

        const existing = await pool.query(
          `SELECT id FROM credential_vault WHERE service = $1 AND category = $2 AND label = $3 AND deleted_at IS NULL`,
          [service, category, label]
        );

        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE credential_vault SET username = $1, password = $2, masked_username = $3, masked_password = $4,
             url = $5, notes = $6, updated_at = NOW() WHERE id = $7`,
            [encUser || null, encPass || null, maskedU || null, maskedP || null, url, notes, existing.rows[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO credential_vault (category, service, label, url, username, password, notes, masked_username, masked_password)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [category, service, label, url, encUser || null, encPass || null, notes || null, maskedU || null, maskedP || null]
          );
        }
      };

      if (username && password) {
        await upsert('wordpress', 'WordPress Admin', username, password, siteUrl, '');
      }
      if (wpUsername && wpPassword) {
        await upsert('wordpress', 'WP Application Password', wpUsername, wpPassword, siteUrl, 'For REST API / plugin updates');
      }
      if (dbUser && dbPassword) {
        await upsert('database', 'Database', dbUser, dbPassword, dbHost || siteUrl, dbName ? `Database: ${dbName}` : '');
      }

      res.json({ message: 'Vault synced', service });
    } catch (err) { next(err); }
  });

  return router;
}
