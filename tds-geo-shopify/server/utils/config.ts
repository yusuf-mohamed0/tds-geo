import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    appUrl: process.env.SHOPIFY_APP_URL || '',
    scopes: process.env.SHOPIFY_SCOPES || 'read_content,write_content',
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-07',
  },

  tdsGeo: {
    apiUrl: process.env.TDS_GEO_API_URL || 'http://localhost:3000',
    apiKey: process.env.TDS_GEO_API_KEY || '',
  },

  session: {
    store: process.env.SESSION_STORE || 'memory',
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || '',
  },
};
