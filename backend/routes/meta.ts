// ──────────────────────────────────────────────
// Meta Routes (Prompt Hardening)
// Server-driven UI data that was previously hardcoded
// in frontend files. Moving to server prevents leaking
// internal system details to unauthorized users.
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';

export function createMetaRoutes(pool: Pool): Router {
  const router = Router();

  // ─── GET /api/meta/quick-actions ──────────
  // Returns available chat quick actions.
  // Previously hardcoded in Chat.tsx.
  router.get('/quick-actions', authenticate, async (_req: Request, res: Response) => {
    const role = (_req as any).user?.role || 'editor';

    // Base actions available to all authenticated users
    const baseActions = [
      { id: 'list-articles', label: '📋 List Articles', actionId: 'list_articles', icon: '📋', roles: ['super_admin', 'admin', 'editor', 'client'] },
      { id: 'dashboard-stats', label: '📊 Dashboard Stats', actionId: 'show_analytics', icon: '📊', roles: ['super_admin', 'admin', 'editor', 'client'] },
    ];

    // Editor+ actions
    const editorActions = [
      { id: 'research-keywords', label: '🔍 Research Keywords', actionId: 'research_keywords', icon: '🔍', roles: ['super_admin', 'admin', 'editor'] },
      { id: 'run-analysis', label: '🤖 Run Analysis', actionId: 'analyze_improvements', icon: '🤖', roles: ['super_admin', 'admin', 'editor'] },
    ];

    // Admin actions
    const adminActions = [
      { id: 'system-config', label: '⚙️ System Config', actionId: 'list_config', icon: '⚙️', roles: ['super_admin', 'admin'] },
      { id: 'list-plugins', label: '🧩 List Plugins', actionId: 'list_plugins', icon: '🧩', roles: ['super_admin', 'admin'] },
    ];

    const allActions = [...baseActions, ...editorActions, ...adminActions];
    const filtered = allActions.filter(a => a.roles.includes(role));

    res.json({ actions: filtered.map(({ roles, ...rest }) => rest) });
  });

  // ─── GET /api/meta/services ───────────────
  // Returns available API key service types.
  // Previously hardcoded in ApiKeys.tsx.
  router.get('/services', authenticate, async (_req: Request, res: Response) => {
    const services = [
      { id: 'openai', label: 'OpenAI', category: 'ai' },
      { id: 'serpapi', label: 'SerpAPI', category: 'seo' },
      { id: 'shopify', label: 'Shopify', category: 'ecommerce' },
      { id: 'google_trends', label: 'Google Trends', category: 'seo' },
      { id: 'google_search_console', label: 'Google Search Console', category: 'seo' },
      { id: 'anthropic', label: 'Anthropic', category: 'ai' },
      { id: 'stability_ai', label: 'Stability AI', category: 'ai' },
      { id: 'pexels', label: 'Pexels', category: 'images' },
      { id: 'custom', label: 'Custom', category: 'other' },
    ];

    res.json({ services });
  });

  // ─── GET /api/meta/models ─────────────────
  // Returns available AI models for prompt templates.
  // Previously hardcoded in Prompts.tsx.
  router.get('/models', authenticate, async (_req: Request, res: Response) => {
    const models = [
      { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', capabilities: ['text', 'vision', 'reasoning'] },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', capabilities: ['text', 'vision'] },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai', capabilities: ['text', 'vision'] },
      { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai', capabilities: ['text', 'reasoning'] },
      { id: 'o3-mini', label: 'o3-mini', provider: 'openai', capabilities: ['text', 'reasoning'] },
      { id: 'o1', label: 'o1', provider: 'openai', capabilities: ['text', 'advanced_reasoning'] },
    ];

    res.json({ models });
  });

  // ─── GET /api/meta/permissions ────────────
  // Returns available user roles for admin UI.
  router.get('/permissions', authenticate, async (_req: Request, res: Response) => {
    const roles = [
      { id: 'super_admin', label: 'Super Admin', level: 4, color: 'gold' },
      { id: 'admin', label: 'Admin', level: 3, color: 'purple' },
      { id: 'editor', label: 'Editor', level: 2, color: 'blue' },
      { id: 'client', label: 'Client', level: 1, color: 'green' },
    ];

    res.json({ roles });
  });

  return router;
}
