// ──────────────────────────────────────────────
// Prompt Editor Routes
// Live editing of AI behavior templates with
// version history and performance tracking
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { logger, logActivity } from '../utils/logger';

export function createPromptRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate);

  // ─── List all prompt templates ──────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, active } = req.query;
      let query = 'SELECT * FROM prompt_templates WHERE 1=1';
      const params: any[] = [];
      let idx = 1;

      if (category) { query += ` AND category = $${idx++}`; params.push(category); }
      if (active !== undefined) { query += ` AND is_active = $${idx++}`; params.push(active === 'true'); }

      query += ' ORDER BY category, name';
      const result = await pool.query(query, params);
      res.json({ templates: result.rows, total: result.rows.length });
    } catch (err) { next(err); }
  });

  // ─── Get single template with version history ─
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await pool.query(
        'SELECT * FROM prompt_templates WHERE id = $1 OR slug = $1',
        [req.params.id]
      );
      if (template.rows.length === 0) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      const versions = await pool.query(
        'SELECT * FROM prompt_template_versions WHERE template_id = $1 ORDER BY version DESC',
        [template.rows[0].id]
      );
      res.json({ ...template.rows[0], versions: versions.rows });
    } catch (err) { next(err); }
  });

  // ─── Create template ────────────────────────
  router.post('/', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, slug, description, category, systemPrompt, userTemplate, variables, model, temperature, maxTokens } = req.body;
      if (!name || !slug || !systemPrompt || !userTemplate) {
        res.status(400).json({ error: 'name, slug, systemPrompt, and userTemplate are required' });
        return;
      }
      const user = (req as any).user;
      const result = await pool.query(
        `INSERT INTO prompt_templates (name, slug, description, category, system_prompt, user_template, variables, model, temperature, max_tokens, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, slug, description || '', category || 'general', systemPrompt, userTemplate,
         variables || [], model || 'gpt-4o', temperature || 0.7, maxTokens || 2048, user.userId]
      );
      await logActivity(pool, {
        clientId: '',
        action: 'prompt_template_created',
        entityType: 'prompt_template',
        entityId: result.rows[0].id,
        level: 'info',
        message: `Prompt template created: ${name}`
      });
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'Template slug already exists' });
        return;
      }
      next(err);
    }
  });

  // ─── Update template (creates new version) ──
  router.put('/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await pool.query('SELECT * FROM prompt_templates WHERE id = $1', [req.params.id]);
      if (template.rows.length === 0) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      const old = template.rows[0];
      const user = (req as any).user;
      const { systemPrompt, userTemplate, model, temperature, maxTokens, name, description, category, isActive } = req.body;

      // Save current version to history
      await pool.query(
        `INSERT INTO prompt_template_versions (template_id, version, system_prompt, user_template, model, temperature, max_tokens, changelog, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [old.id, old.version, old.system_prompt, old.user_template, old.model, old.temperature, old.max_tokens,
         `Auto-saved before update by ${user.email}`, user.userId]
      );

      // Update template with new values and increment version
      const newVersion = old.version + 1;
      const updateResult = await pool.query(
        `UPDATE prompt_templates SET
          system_prompt = COALESCE($1, system_prompt),
          user_template = COALESCE($2, user_template),
          model = COALESCE($3, model),
          temperature = COALESCE($4, temperature),
          max_tokens = COALESCE($5, max_tokens),
          name = COALESCE($6, name),
          description = COALESCE($7, description),
          category = COALESCE($8, category),
          is_active = COALESCE($9, is_active),
          version = $10,
          updated_at = NOW()
         WHERE id = $11 RETURNING *`,
        [systemPrompt || null, userTemplate || null, model || null, temperature ?? null,
         maxTokens || null, name || null, description || null, category || null,
         isActive !== undefined ? isActive : null, newVersion, old.id]
      );

      await logActivity(pool, {
        clientId: '',
        action: 'prompt_template_updated',
        entityType: 'prompt_template',
        entityId: old.id,
        level: 'info',
        message: `Prompt template updated: ${updateResult.rows[0].name} (v${newVersion})`
      });

      res.json(updateResult.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── Rollback to previous version ──────────
  router.post('/:id/rollback/:version', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versionResult = await pool.query(
        `SELECT * FROM prompt_template_versions
         WHERE template_id = (SELECT id FROM prompt_templates WHERE id = $1) AND version = $2`,
        [req.params.id, parseInt(req.params.version)]
      );
      if (versionResult.rows.length === 0) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }
      const v = versionResult.rows[0];
      const user = (req as any).user;
      const result = await pool.query(
        `UPDATE prompt_templates SET
          system_prompt = $1, user_template = $2, model = $3,
          temperature = $4, max_tokens = $5, version = version + 1, updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [v.system_prompt, v.user_template, v.model, v.temperature, v.max_tokens, req.params.id]
      );
      await logActivity(pool, {
        clientId: '',
        action: 'prompt_template_rolled_back',
        entityType: 'prompt_template',
        entityId: req.params.id,
        level: 'info',
        message: `Prompt template rolled back to v${req.params.version}: ${result.rows[0].name}`
      });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── Template performance stats ────────────
  router.get('/:id/performance', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await pool.query('SELECT * FROM prompt_templates WHERE id = $1', [req.params.id]);
      if (template.rows.length === 0) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      const t = template.rows[0];
      const perf = t.performance || { avgScore: 0, totalRuns: 0 };
      res.json({
        templateId: t.id,
        name: t.name,
        version: t.version,
        performance: perf,
        suggestions: perf.totalRuns > 10 && perf.avgScore < 70
          ? ['Consider adjusting temperature', 'Try a different model', 'Review system prompt clarity']
          : []
      });
    } catch (err) { next(err); }
  });

  // ══════════════════════════════════════════════
  // Content Briefs (for copywriters)
  // ══════════════════════════════════════════════

  // ─── Submit a content brief ───────────────────
  router.post('/briefs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { keyword, topic, targetAudience, tone, keyPoints, references, notes, clientId } = req.body;

      if (!keyword && !topic) {
        res.status(400).json({ error: 'keyword or topic is required' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO content_briefs (client_id, keyword, topic, target_audience, tone, key_points, ref_urls, notes, submitted_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
         RETURNING *`,
        [
          clientId || user.clientId || null,
          keyword || topic,
          topic || keyword,
          targetAudience || '',
          tone || 'professional',
          keyPoints || [],
          references || [],
          notes || '',
          user.userId
        ]
      );

      await logActivity(pool, {
        clientId: result.rows[0].client_id || '',
        action: 'content_brief_submitted',
        entityType: 'content_brief',
        entityId: result.rows[0].id,
        level: 'info',
        message: `Content brief submitted: ${result.rows[0].keyword}`
      });

      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── List content briefs ──────────────────────
  router.get('/briefs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { status, clientId } = req.query;
      let query = `
        SELECT cb.*, u.name as submitted_by_name
        FROM content_briefs cb
        LEFT JOIN users u ON u.id = cb.submitted_by
        WHERE 1=1`;
      const params: any[] = [];
      let idx = 1;

      if (status) { query += ` AND cb.status = $${idx++}`; params.push(status); }
      if (clientId) { query += ` AND cb.client_id = $${idx++}`; params.push(clientId); }
      else if (user.clientId) { query += ` AND cb.client_id = $${idx++}`; params.push(user.clientId); }

      query += ' ORDER BY cb.created_at DESC LIMIT 50';
      const result = await pool.query(query, params);
      res.json({ briefs: result.rows, total: result.rows.length });
    } catch (err) { next(err); }
  });

  return router;
}
