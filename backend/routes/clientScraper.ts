// ══════════════════════════════════════════════════════════════════
// Client Website Scanner Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import clientScraper from '../services/clientScraper';
import { logger } from '../utils/logger';

export function createClientScraperRoutes(pool: Pool): Router {
  const router = Router();
  clientScraper.initialize(pool);

  // ─── Scan a client's website ──────────────────
  router.post('/scan/:clientId', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;

      // Get client info for URL
      const clientResult = await pool.query(
        'SELECT id, name, shopify_shop FROM clients WHERE id = $1 AND is_active = true',
        [clientId]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Client not found' });
      }

      const client = clientResult.rows[0];
      const url = req.body.url || client.shopify_shop || '';

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'No URL provided. Set a domain on the client or pass a url in the request body.',
        });
      }

      logger.info('Triggering website scan', { clientId: client.id, name: client.name, url });

      const intelligence = await clientScraper.scanWebsite(url, clientId);

      res.json({
        success: true,
        data: {
          id: intelligence.id,
          client_id: clientId,
          site_name: intelligence.site_name,
          pages_scanned: intelligence.pages_scanned,
          pages_found: intelligence.pages_found.slice(0, 10),
          services_count: intelligence.services.length,
          industries_count: intelligence.industries.length,
          scraped_at: intelligence.scraped_at,
          summary: `Scanned ${intelligence.pages_scanned} pages, found ${intelligence.services.length} services, ${intelligence.industries.length} industries`,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Get stored intelligence for a client ────
  router.get('/intelligence/:clientId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const intelligence = await clientScraper.getIntelligence(clientId);

      if (!intelligence) {
        return res.status(404).json({
          success: false,
          error: 'No intelligence found for this client. Run a scan first.',
        });
      }

      res.json({ success: true, data: intelligence });
    } catch (err) {
      next(err);
    }
  });

  // ─── Get condensed AI prompt from intelligence ──
  router.get('/intelligence/:clientId/prompt', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const intelligence = await clientScraper.getIntelligence(clientId);

      if (!intelligence) {
        // Return a basic prompt based on client data
        const clientResult = await pool.query(
          'SELECT name, shopify_shop, service_area, brand_voice FROM clients WHERE id = $1',
          [clientId]
        );
        if (clientResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Client not found' });
        }

        const client = clientResult.rows[0];
        return res.json({
          success: true,
          data: {
            company_name: client.name,
            description: `${client.name} offers ${client.service_area || 'professional services'}.`,
            industry: client.service_area || 'general',
            services: '',
            target_audience: client.service_area || 'Businesses',
            tone: client.brand_voice || 'professional',
            unique_selling_points: '',
            common_terms: '',
            cta_style: 'Professional call-to-action',
            source: 'client_record',
            note: 'No website intelligence available. Run a scan for richer data.',
          },
        });
      }

      const prompt = clientScraper.buildIntelligencePrompt(intelligence);

      res.json({
        success: true,
        data: {
          ...prompt,
          source: 'website_intelligence',
          pages_scanned: intelligence.pages_scanned,
          scraped_at: intelligence.scraped_at,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Get all clients needing scan ────────────
  router.get('/needs-scan', authenticate, authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const clients = await clientScraper.getClientsNeedingScan();
      res.json({ success: true, data: clients, total: clients.length });
    } catch (err) {
      next(err);
    }
  });

  // ─── Scan ALL clients (batch) ────────────────
  router.post('/scan-all', authenticate, authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const clients = await clientScraper.getClientsNeedingScan();

      // Scan clients sequentially (rate limiting)
      const results = [];
      for (const client of clients) {
        try {
          const intelligence = await clientScraper.scanWebsite(client.domain, client.id);
          results.push({
            clientId: client.id,
            name: client.name,
            status: 'success',
            pagesScanned: intelligence.pages_scanned,
          });
          // Small delay between scans to be polite
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          results.push({
            clientId: client.id,
            name: client.name,
            status: 'failed',
            error: (err as Error).message,
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;

      res.json({
        success: true,
        data: {
          total: clients.length,
          scanned: successCount,
          failed: clients.length - successCount,
          results,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Check if Scrapling is available ─────────
  router.get('/status', authenticate, async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        scrapling_available: clientScraper.isAvailable,
        python_scanner_ready: true,
      },
    });
  });

  return router;
}
