// ──────────────────────────────────────────────
// Network Security Middleware
// VPN-only access, IP whitelist, internal subnet check
// ──────────────────────────────────────────────

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger';

// ─── Internal Subnets ─────────────────────────
const INTERNAL_SUBNETS = [
  { prefix: '10.', mask: 8 },       // 10.0.0.0/8
  { prefix: '172.16.', mask: 12 },  // 172.16.0.0/12
  { prefix: '172.17.', mask: 12 },
  { prefix: '172.18.', mask: 12 },
  { prefix: '172.19.', mask: 12 },
  { prefix: '172.20.', mask: 12 },
  { prefix: '172.21.', mask: 12 },
  { prefix: '172.22.', mask: 12 },
  { prefix: '172.23.', mask: 12 },
  { prefix: '172.24.', mask: 12 },
  { prefix: '172.25.', mask: 12 },
  { prefix: '172.26.', mask: 12 },
  { prefix: '172.27.', mask: 12 },
  { prefix: '172.28.', mask: 12 },
  { prefix: '172.29.', mask: 12 },
  { prefix: '172.30.', mask: 12 },
  { prefix: '172.31.', mask: 12 },
  { prefix: '192.168.', mask: 16 }, // 192.168.0.0/16
  { prefix: '127.', mask: 8 },      // 127.0.0.0/8 (localhost)
  { prefix: '::1', mask: 128 },    // IPv6 localhost
  { prefix: 'fc', mask: 7 },       // IPv6 unique local fc00::/7
];

/**
 * Check if an IP address belongs to an internal/private subnet.
 */
export function isInternalIp(ip: string): boolean {
  const normalizedIp = ip.replace(/^::ffff:/, ''); // Normalize IPv4-mapped IPv6
  return INTERNAL_SUBNETS.some(subnet => normalizedIp.startsWith(subnet.prefix));
}

/**
 * VPN Header Check middleware.
 * Requires requests to come through VPN by checking:
 * 1. X-VPN-Header (custom header set by VPN server)
 * 2. Internal IP range check
 *
 * Usage: app.use(requireVpnAccess())
 */
export function requireVpnAccess(excludedPaths: string[] = []): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in development mode
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_VPN_CHECK === 'true') {
      next();
      return;
    }

    // Skip excluded paths (Shopify OAuth, webhooks, compliance, embedded app)
    if (excludedPaths.some(p => req.path.startsWith(p) || req.originalUrl.startsWith(p))) {
      next();
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';

    // Check 1: Custom VPN header (set by VPN server / reverse proxy)
    const vpnHeader = req.headers['x-vpn-verified'] as string;
    const vpnToken = process.env.VPN_AUTH_TOKEN;
    if (vpnToken && vpnHeader === vpnToken) {
      next();
      return;
    }

    // Check 2: Internal IP range (VPN assigns internal IPs)
    if (isInternalIp(clientIp)) {
      next();
      return;
    }

    // Check 3: X-Forwarded-For with internal IP (behind reverse proxy)
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      if (ips.some(ip => isInternalIp(ip))) {
        next();
        return;
      }
    }

    logger.warn('VPN access denied', {
      ip: clientIp,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(403).json({
      error: 'Access denied',
      message: 'This system is only accessible through the company VPN.',
      code: 'VPN_REQUIRED',
    });
  };
}

/**
 * IP Whitelist middleware.
 * Restricts access to a specific set of IPs or CIDR ranges.
 * Configured via INTERNAL_IP_WHITELIST env var (comma-separated IPs).
 *
 * Usage: app.use(ipWhitelist())
 */
export function ipWhitelist(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in development mode or if whitelist is not configured
    if (process.env.NODE_ENV === 'development' || !process.env.INTERNAL_IP_WHITELIST) {
      next();
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';
    const allowedIps = process.env.INTERNAL_IP_WHITELIST.split(',').map(ip => ip.trim());

    // Check direct match
    if (allowedIps.includes(clientIp)) {
      next();
      return;
    }

    // Check X-Forwarded-For
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      if (ips.some(ip => allowedIps.includes(ip))) {
        next();
        return;
      }
    }

    // Check internal subnets as fallback
    if (isInternalIp(clientIp)) {
      next();
      return;
    }

    logger.warn('IP whitelist denied', {
      ip: clientIp,
      allowedIps,
      path: req.originalUrl,
    });

    res.status(403).json({
      error: 'Access denied',
      message: 'Your IP is not authorized to access this system.',
      code: 'IP_NOT_WHITELISTED',
    });
  };
}

/**
 * Internal subnet check middleware.
 * Only allows requests from internal/private IP ranges.
 * This is the strictest network control.
 *
 * Usage: app.use(requireInternalNetwork())
 */
export function requireInternalNetwork(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in development mode
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_INTERNAL_NETWORK_CHECK === 'true') {
      next();
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';

    if (isInternalIp(clientIp)) {
      next();
      return;
    }

    // Check X-Forwarded-For
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      if (ips.some(ip => isInternalIp(ip))) {
        next();
        return;
      }
    }

    logger.warn('Internal network access denied', {
      ip: clientIp,
      path: req.originalUrl,
    });

    res.status(403).json({
      error: 'Access denied',
      message: 'This system is only accessible from the internal company network.',
      code: 'INTERNAL_NETWORK_REQUIRED',
    });
  };
}
