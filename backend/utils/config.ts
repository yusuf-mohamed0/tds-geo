// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

export const config = {
  nodeEnv: env('NODE_ENV', 'development'),
  port: parseInt(env('PORT', '3000'), 10),
  isDev: () => config.nodeEnv === 'development',
  isProd: () => config.nodeEnv === 'production',
  isTest: () => config.nodeEnv === 'test',

  database: {
    url: env('DATABASE_URL'),
    poolMax: parseInt(env('DB_POOL_MAX', '10'), 10),
    poolIdle: parseInt(env('DB_POOL_IDLE', '30000'), 10),
  },

  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    secret: env('JWT_SECRET'),
  },

  cors: {
    origin: env('CORS_ORIGIN', 'http://localhost:5173'),
  },

  rateLimit: {
    max: parseInt(env('RATE_LIMIT_MAX', '500'), 10),
    authMax: parseInt(env('AUTH_RATE_LIMIT_MAX', '20'), 10),
    windowMs: 15 * 60 * 1000,
  },

  shopify: {
    defaultShop: env('SHOPIFY_DEFAULT_SHOP'),
    defaultAccessToken: env('SHOPIFY_DEFAULT_ACCESS_TOKEN'),
    apiKey: env('SHOPIFY_API_KEY', 'a178c8740049e04eec663378b6e30ad8'),
    apiSecret: env('SHOPIFY_API_SECRET'),
  },

  openai: {
    apiKey: env('OPENAI_API_KEY', ''),
    baseUrl: env('OPENAI_BASE_URL', ''),
    fallbackKey: env('OPENAI_FALLBACK_KEY', ''),
  },

  serpapi: {
    apiKey: env('SERPAPI_API_KEY', ''),
  },

  headroom: {
    baseUrl: env('HEADROOM_BASE_URL', ''),
  },

  crawl4ai: {
    url: env('CRAWL4AI_URL', ''),
  },

  freellmapi: {
    encryptionKey: env('FREELMAPI_ENCRYPTION_KEY', ''),
  },

  openseo: {
    url: env('OPENSEO_URL', 'http://localhost:3001'),
    dataforseoApiKey: env('DATAFORSEO_API_KEY', ''),
  },

  smtp: {
    host: env('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(env('SMTP_PORT', '587'), 10),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    from: env('SMTP_FROM', ''),
  },

  n8n: {
    webhookUrl: env('N8N_WEBHOOK_URL', ''),
  },

  turbovec: {
    url: env('TVEC_URL', ''),
  },

  airllm: {
    url: env('AIRLLM_URL', ''),
  },

  odoo: {
    url: env('ODOO_URL', ''),
    db: env('ODOO_DB', ''),
    username: env('ODOO_USERNAME', ''),
    password: env('ODOO_PASSWORD', ''),
  },

  heartbeat: {
    checkIntervalMs: parseInt(env('HEARTBEAT_INTERVAL_MS', '300000'), 10),
    alertEmail: env('HEARTBEAT_ALERT_EMAIL', ''),
  },

  storage: {
    uploadDir: env('UPLOAD_DIR', 'uploads'),
  },
} as const;

function env(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  if (process.env.NODE_ENV === 'test') return `test-${key.toLowerCase()}`;
  throw new Error(`Missing required environment variable: ${key}`);
}

export type Config = typeof config;
