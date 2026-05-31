// ──────────────────────────────────────────────
// Plugin System Service
// Manages plugin lifecycle, hook execution, and
// runtime plugin instances
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface PluginHookContext {
  clientId?: string;
  articleId?: string;
  keyword?: string;
  data?: Record<string, unknown>;
}

export class PluginService {
  private pool: Pool | null = null;
  private hookRegistry: Map<string, string[]> = new Map();
  private _tablesVerified: boolean | null = null; // null=not checked, true/false=cached

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Plugin service initialized');
  }

  /**
   * Verify that plugin tables exist. Cache result to avoid repeated checks.
   */
  private async verifyTables(): Promise<boolean> {
    if (this._tablesVerified !== null) return this._tablesVerified;
    if (!this.pool) return false;

    try {
      await this.pool.query('SELECT 1 FROM plugin_registry LIMIT 0');
      this._tablesVerified = true;
    } catch {
      logger.warn('Plugin tables not found — plugin system disabled. Run migration_platform_v1.sql to enable.');
      this._tablesVerified = false;
    }
    return this._tablesVerified;
  }

  /**
   * Execute all active plugins for a given hook.
   * Returns results from each plugin that handled the hook.
   * Gracefully degrades if plugin tables don't exist.
   */
  async executeHook(hookName: string, context: PluginHookContext): Promise<PluginHookResult[]> {
    if (!this.pool) return [];
    if (!this._tablesVerified) {
      const verified = await this.verifyTables();
      if (!verified) return [];
    }

    const results: PluginHookResult[] = [];

    try {
      // Find active plugin instances with plugins that register this hook
      const plugins = await this.pool.query(
        `SELECT pi.id as instance_id, pi.config, pi.client_id,
                pr.name, pr.slug, pr.entry_point, pr.config_schema,
                pi.is_enabled
         FROM plugin_instances pi
         JOIN plugin_registry pr ON pr.id = pi.plugin_id
         WHERE pr.hooks @> ARRAY[$1]::text[]
           AND pr.is_active = true
           AND pi.is_enabled = true
         ${context.clientId ? 'AND (pi.client_id = $2 OR pi.client_id IS NULL)' : ''}`,
        context.clientId ? [hookName, context.clientId] : [hookName]
      );

      for (const plugin of plugins.rows) {
        try {
          const pluginResult = await this.runPluginHook(plugin, hookName, context);
          results.push({
            plugin: plugin.slug,
            hook: hookName,
            success: true,
            result: pluginResult
          });
        } catch (err) {
          logger.warn(`Plugin hook failed: ${plugin.slug}.${hookName}`, {
            error: (err as Error).message
          });
          results.push({
            plugin: plugin.slug,
            hook: hookName,
            success: false,
            error: (err as Error).message
          });
        }
      }
    } catch (err) {
      logger.error('Plugin hook execution failed', {
        hook: hookName,
        error: (err as Error).message
      });
    }

    return results;
  }

  private async runPluginHook(
    plugin: any,
    hookName: string,
    context: PluginHookContext
  ): Promise<unknown> {
    const config = { ...plugin.default_config, ...plugin.config };

    switch (plugin.slug) {
      case 'seo-content-agent':
        if (hookName === 'before_content_generation') {
          return { enhancePrompt: true, tone: config.tone, minWords: config.minWords };
        }
        if (hookName === 'after_content_generation') {
          return { optimizeSeo: true, score: context.data?.seoScore || 0 };
        }
        return null;

      case 'shopify-publisher':
        if (hookName === 'before_publish') {
          return { autoPublish: config.autoPublish, generateImages: config.generateImages };
        }
        if (hookName === 'after_publish') {
          return { published: true, url: context.data?.publishUrl };
        }
        return null;

      case 'trend-analyzer':
        if (hookName === 'on_schedule') {
          return { analyze: true, region: config.region };
        }
        return null;

      default:
        // For custom plugins, return config as context
        return { config, hook: hookName, context };
    }
  }

  /**
   * Register a plugin instance for a client.
   */
  async registerInstance(pluginSlug: string, clientId: string, config: Record<string, unknown> = {}): Promise<any> {
    if (!this.pool) throw new Error('Plugin service not initialized');

    const plugin = await this.pool.query(
      'SELECT id, default_config FROM plugin_registry WHERE slug = $1 AND is_active = true',
      [pluginSlug]
    );
    if (plugin.rows.length === 0) throw new Error(`Plugin not found: ${pluginSlug}`);

    const mergedConfig = { ...plugin.rows[0].default_config, ...config };
    const result = await this.pool.query(
      `INSERT INTO plugin_instances (plugin_id, client_id, config)
       VALUES ($1, $2, $3)
       ON CONFLICT (plugin_id, client_id)
       DO UPDATE SET config = $3, updated_at = NOW()
       RETURNING id, (SELECT slug FROM plugin_registry WHERE id = plugin_instances.plugin_id) as plugin_slug, is_enabled`,
      [plugin.rows[0].id, clientId, JSON.stringify(mergedConfig)]
    );
    return result.rows[0];
  }

  /**
   * Get all registered plugins with their instances for a client.
   */
  async getClientPlugins(clientId: string): Promise<any[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT pr.id, pr.name, pr.slug, pr.description, pr.version, pr.hooks,
              pr.config_schema, pr.default_config, pr.is_system, pr.installed_at,
              pi.id as instance_id, pi.config as instance_config,
              pi.is_enabled, pi.last_run_at
       FROM plugin_registry pr
       LEFT JOIN plugin_instances pi ON pi.plugin_id = pr.id AND pi.client_id = $1
       WHERE pr.is_active = true
       ORDER BY pr.name`,
      [clientId]
    );
    return result.rows;
  }

  /**
   * Toggle a plugin instance on/off.
   */
  async toggleInstance(instanceId: string, clientId: string): Promise<any> {
    if (!this.pool) throw new Error('Plugin service not initialized');
    const result = await this.pool.query(
      `UPDATE plugin_instances SET is_enabled = NOT is_enabled, updated_at = NOW()
       WHERE id = $1 AND client_id = $2 RETURNING id, is_enabled`,
      [instanceId, clientId]
    );
    if (result.rows.length === 0) throw new Error('Plugin instance not found');
    return result.rows[0];
  }

  /**
   * Update plugin instance config.
   */
  async updateConfig(instanceId: string, clientId: string, config: Record<string, unknown>): Promise<any> {
    if (!this.pool) throw new Error('Plugin service not initialized');
    const result = await this.pool.query(
      `UPDATE plugin_instances SET config = $1, updated_at = NOW()
       WHERE id = $2 AND client_id = $3 RETURNING id, config`,
      [JSON.stringify(config), instanceId, clientId]
    );
    if (result.rows.length === 0) throw new Error('Plugin instance not found');
    return result.rows[0];
  }

  async close(): Promise<void> {
    this.hookRegistry.clear();
    logger.info('Plugin service closed');
  }
}

export interface PluginHookResult {
  plugin: string;
  hook: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export default new PluginService();
