import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../utils/config';

export function validateHmac(req: Request, res: Response, next: NextFunction): void {
  const hmac = req.query.hmac as string;
  if (!hmac) {
    res.status(401).json({ error: 'Missing HMAC' });
    return;
  }

  const { hmac: _, ...params } = req.query;
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const calculatedHmac = crypto
    .createHmac('sha256', config.shopify.apiSecret)
    .update(sortedParams)
    .digest('hex');

  if (crypto.timingSafeEqual(Buffer.from(calculatedHmac), Buffer.from(hmac))) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid HMAC' });
  }
}

export function validateProxyRequest(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-tds-geo-api-key'] as string;
  if (!apiKey || apiKey !== config.tdsGeo.apiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
