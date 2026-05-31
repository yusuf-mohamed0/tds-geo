// ──────────────────────────────────────────────
// Request Validation Schemas (Joi)
// ──────────────────────────────────────────────

import Joi from 'joi';

// ─── Auth ─────────────────────────────────────

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  name: Joi.string().min(2).max(255).required(),
  role: Joi.string().valid('admin', 'editor', 'client').default('editor'),
  clientId: Joi.string().uuid().optional()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// ─── Clients ──────────────────────────────────

export const createClientSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  slug: Joi.string().min(2).max(255).pattern(/^[a-z0-9-]+$/).required(),
  shopifyShop: Joi.string().required(),
  shopifyToken: Joi.string().required(),
  shopifyApiVersion: Joi.string().default('2024-07'),
  brandVoice: Joi.string().optional(),
  serviceArea: Joi.string().optional(),
  timezone: Joi.string().optional(),
  publishFrequency: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly', 'manual').optional(),
  preferredPublishHour: Joi.number().integer().min(0).max(23).optional(),
  approvalMode: Joi.string().valid('auto', 'manual').optional(),
  monthlyTokenLimit: Joi.number().integer().min(0).optional(),
  monthlyCostLimit: Joi.number().min(0).optional(),
  settings: Joi.object().optional()
});

export const updateClientSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  slug: Joi.string().min(2).max(255).pattern(/^[a-z0-9-]+$/).optional(),
  shopifyShop: Joi.string().optional(),
  shopifyToken: Joi.string().optional(),
  shopifyApiVersion: Joi.string().optional(),
  brandVoice: Joi.string().optional(),
  serviceArea: Joi.string().optional(),
  timezone: Joi.string().optional(),
  publishFrequency: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly', 'manual').optional(),
  preferredPublishHour: Joi.number().integer().min(0).max(23).optional(),
  approvalMode: Joi.string().valid('auto', 'manual').optional(),
  monthlyTokenLimit: Joi.number().integer().min(0).optional(),
  monthlyCostLimit: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
  settings: Joi.object().optional()
});

// ─── Keywords ─────────────────────────────────

export const discoverKeywordsSchema = Joi.object({
  industry: Joi.string().default('maintenance'),
  seedKeywords: Joi.array().items(Joi.string()).min(1).default(['home maintenance', 'property care']),
  count: Joi.number().integer().min(1).max(100).default(20)
});

// ─── Articles ─────────────────────────────────

export const generateArticleSchema = Joi.object({
  keyword: Joi.string().required(),
  count: Joi.number().integer().min(1).max(10).default(1),
  publish: Joi.boolean().default(false),
  blogId: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  tone: Joi.string().optional(),
  minWords: Joi.number().integer().min(300).max(5000).optional(),
  maxWords: Joi.number().integer().min(300).max(5000).optional()
});

export const updateArticleSchema = Joi.object({
  title: Joi.string().min(10).max(500).optional(),
  contentMd: Joi.string().min(100).optional(),
  metaTitle: Joi.string().max(60).optional(),
  metaDescription: Joi.string().max(160).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('draft', 'generated', 'reviewed', 'approved', 'rejected').optional()
});

export const publishArticleSchema = Joi.object({
  blogId: Joi.alternatives().try(Joi.number(), Joi.string()).required()
});

// ─── Webhooks ─────────────────────────────────

export const createWebhookSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  url: Joi.string().uri().required(),
  events: Joi.array().items(Joi.string()).min(1).required(),
  secret: Joi.string().optional(),
  retryCount: Joi.number().integer().min(0).max(10).default(3),
  timeoutMs: Joi.number().integer().min(1000).max(60000).default(10000)
});

export const updateWebhookSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  url: Joi.string().uri().optional(),
  events: Joi.array().items(Joi.string()).min(1).optional(),
  secret: Joi.string().optional(),
  retryCount: Joi.number().integer().min(0).max(10).optional(),
  timeoutMs: Joi.number().integer().min(1000).max(60000).optional(),
  isActive: Joi.boolean().optional()
});

// ─── Schedules ────────────────────────────────

export const createScheduleSchema = Joi.object({
  name: Joi.string().max(255).required(),
  frequency: Joi.string().valid('cron', 'interval', 'once').required(),
  cronExpression: Joi.string().when('frequency', { is: 'cron', then: Joi.required(), otherwise: Joi.optional() }),
  intervalMinutes: Joi.number().integer().min(1).when('frequency', { is: 'interval', then: Joi.required(), otherwise: Joi.optional() }),
  config: Joi.object().default({})
});

// ─── SEO Analysis ─────────────────────────────

export const seoAnalyzeSchema = Joi.object({
  content: Joi.string().min(50).required(),
  keyword: Joi.string().required()
});

// ─── Image Generation ─────────────────────────

export const generateImageSchema = Joi.object({
  articleTitle: Joi.string().required(),
  keyword: Joi.string().required(),
  tone: Joi.string().default('professional')
});

// ─── Pagination ───────────────────────────────

export const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

// ─── Validation Middleware ────────────────────

import { Request, Response, NextFunction } from 'express';
import JoiBase from 'joi';

export function validate(schema: JoiBase.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, '')
      }));

      res.status(400).json({
        error: 'Validation failed',
        details
      });
      return;
    }

    // Replace with validated (and stripped) values
    (req as any).validated = value;
    next();
  };
}
