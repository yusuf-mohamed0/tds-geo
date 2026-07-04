// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { connectorManager } from '../connector-manager';
import { logger } from '../utils/logger';
import { sitesService } from '../services/sitesService';

export function createConnectorRoutes(pool: Pool): Router {
  const router = Router();

  const normalizeConnectorInput = (provider: string, body: Record<string, any>) => {
    const endpointUrl = body.endpointUrl || body.siteUrl || body.url || '';
    const apiKey = body.apiKey || body.tdsGeoApiKey || body.tds_geo_api_key || body.accessToken || '';

    return {
      provider,
      endpointUrl,
      apiKey,
      config: {
        endpointUrl,
        apiKey,
      },
    };
  };

  router.get('/', async (_req: Request, res: Response) => {
    const connectors = connectorManager.list();
    res.json({ success: true, data: connectors });
  });

  router.post('/connect/:provider', async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const { clientId } = req.body;
      const normalized = normalizeConnectorInput(provider, req.body);
      const { endpointUrl, apiKey } = normalized;

      if (!endpointUrl || !apiKey) {
        res.status(400).json({ success: false, error: 'endpointUrl and apiKey are required' });
        return;
      }

      const connector = connectorManager.get(provider);
      if (!connector) {
        res.status(404).json({ success: false, error: `Connector '${provider}' not registered` });
        return;
      }

      const connected = await connector.connect({
        provider,
        endpointUrl,
        apiKey,
      });

      if (!connected) {
        res.status(502).json({ success: false, error: `Failed to connect to ${provider}` });
        return;
      }

      if (clientId) {
        await pool.query(
          `INSERT INTO cms_connections (client_id, provider, endpoint_url, config, is_active, created_at)
           VALUES ($1, $2, $3, $4, true, NOW())
           ON CONFLICT (client_id, provider) WHERE is_active = true
           DO UPDATE SET endpoint_url = $3, config = $4, updated_at = NOW()`,
          [clientId, provider, endpointUrl, JSON.stringify(normalized.config)]
        );
      }

      const domain = new URL(endpointUrl).hostname;
      await sitesService.register({
        platform: provider as any,
        site_name: domain,
        domain,
        connector_id: provider,
        encrypted_credentials: apiKey,
        connection_status: 'connected',
      });

      logger.info('Connector connected', { provider, endpoint: endpointUrl });
      res.json({ success: true, data: { provider, endpointUrl } });
    } catch (err) {
      logger.error('Connector connect error', { error: (err as Error).message });
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  router.post('/:provider/test', async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const connector = connectorManager.get(provider);
      const normalized = normalizeConnectorInput(provider, req.body || {});

      if (!connector) {
        res.status(404).json({ success: false, error: `Connector '${provider}' not registered` });
        return;
      }

      if (normalized.endpointUrl && normalized.apiKey) {
        const connected = await connector.connect({
          provider,
          endpointUrl: normalized.endpointUrl,
          apiKey: normalized.apiKey,
        });

        if (!connected) {
          res.status(502).json({ success: false, error: `Failed to connect to ${provider}` });
          return;
        }
      }

      const health = await connector.health();
      res.json({ success: true, data: health });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  return router;
}
