import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../utils/config';
import { validateHmac } from '../middleware/auth';

const router = Router();

function buildInstallUrl(shop: string, state: string): string {
  const redirectUri = `${config.shopify.appUrl}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: config.shopify.apiKey,
    scope: config.shopify.scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

router.get('/', validateHmac, (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  if (!shop) {
    res.status(400).send('Missing shop parameter');
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  const installUrl = buildInstallUrl(shop, state);

  res.redirect(installUrl);
});

router.get('/callback', async (req: Request, res: Response) => {
  const { shop, code, state } = req.query;

  if (!shop || !code) {
    res.status(400).send('Missing required parameters');
    return;
  }

  try {
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.shopify.apiKey,
          client_secret: config.shopify.apiSecret,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange token');
    }

    const { access_token } = await tokenResponse.json() as { access_token: string };

    res.redirect(
      `https://${shop}/admin/apps/tds-geo?token=${access_token}`
    );
  } catch (err) {
    res.status(500).send('Authentication failed');
  }
});

router.get('/token', async (req: Request, res: Response) => {
  const { shop, code } = req.query;
  if (!shop || !code) {
    res.status(400).json({ error: 'Missing shop or code' });
    return;
  }

  try {
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.shopify.apiKey,
          client_secret: config.shopify.apiSecret,
          code,
        }),
      }
    );

    const data = await tokenResponse.json() as { access_token: string };
    res.json({ access_token: data.access_token, shop });
  } catch (err) {
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

export default router;
