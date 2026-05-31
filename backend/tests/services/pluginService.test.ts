// ══════════════════════════════════════════════
// PluginService Tests
// Graceful degradation patterns
// ══════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { PluginService } from '../../services/pluginService';

function createMockPool(overrides: Record<string, any> = {}) {
  return {
    query: async (_text: string, _params?: any[]) => {
      if (overrides.defaultRows !== undefined) return { rows: overrides.defaultRows, rowCount: (overrides.defaultRows as any[]).length };
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
    end: async () => {},
    on: () => {},
    ...overrides,
  } as any;
}

describe('PluginService — graceful degradation', () => {
  let service: PluginService;

  beforeEach(() => {
    service = new PluginService();
    // Reset internal state
    (service as any)._tablesVerified = null;
    (service as any).pool = null;
  });

  // ─── Uninitialized state (no pool) ─────────────

  describe('uninitialized (no pool)', () => {
    it('executeHook should return empty array', async () => {
      const result = await service.executeHook('any_hook', {});
      expect(result).toEqual([]);
    });

    it('getClientPlugins should return empty array', async () => {
      const result = await service.getClientPlugins('any-client');
      expect(result).toEqual([]);
    });

    it('registerInstance should throw', async () => {
      await expect(service.registerInstance('test-plugin', 'client-1'))
        .rejects.toThrow('Plugin service not initialized');
    });

    it('toggleInstance should throw', async () => {
      await expect(service.toggleInstance('inst-1', 'client-1'))
        .rejects.toThrow('Plugin service not initialized');
    });

    it('updateConfig should throw', async () => {
      await expect(service.updateConfig('inst-1', 'client-1', {}))
        .rejects.toThrow('Plugin service not initialized');
    });
  });

  // ─── Tables don't exist ────────────────────────

  describe('tables missing (verifyTables=false)', () => {
    it('executeHook should return empty array gracefully', async () => {
      const pool = createMockPool();
      pool.query = async () => { throw new Error('relation "plugin_registry" does not exist'); };
      service.initialize(pool);

      const result = await service.executeHook('before_publish', { clientId: 'c1' });
      expect(result).toEqual([]);
    });

    it('should cache negative table verification result', async () => {
      let queryCount = 0;
      const pool = createMockPool();
      pool.query = async () => {
        queryCount++;
        throw new Error('relation "plugin_registry" does not exist');
      };
      service.initialize(pool);

      await service.executeHook('hook1', {});
      expect(queryCount).toBe(1);

      await service.executeHook('hook2', {});
      // Second call uses cached result, does not re-query
      expect(queryCount).toBe(1);
    });
  });

  // ─── Tables exist, no plugins ──────────────────

  describe('tables exist but no plugins', () => {
    it('executeHook should return empty array when no plugins match', async () => {
      const pool = createMockPool({ defaultRows: [] });
      service.initialize(pool);

      const result = await service.executeHook('test-hook', {});
      expect(result).toEqual([]);
    });
  });

  // ─── Hook execution — single result ────────────

  describe('hook execution with matching plugins', () => {
    it('should return results for matching hooks', async () => {
      const pool = createMockPool();
      let callCount = 0;
      pool.query = async (text: string, _params?: any[]) => {
        if (text.startsWith('SELECT')) {
          callCount++;
          if (callCount === 1) {
            // First SELECT: verifyTables()
            return { rows: [{}], rowCount: 1 };
          }
          // Second SELECT: find active plugin instances
          return {
            rows: [
              {
                instance_id: 'inst-1',
                config: { tone: 'professional', minWords: 500 },
                client_id: 'c1',
                name: 'SEO Content Agent',
                slug: 'seo-content-agent',
                entry_point: null,
                config_schema: null,
                default_config: {},
                is_enabled: true,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };
      service.initialize(pool);

      const results = await service.executeHook('before_content_generation', {
        clientId: 'c1',
      });

      expect(results).toHaveLength(1);
      expect(results[0].plugin).toBe('seo-content-agent');
      expect(results[0].hook).toBe('before_content_generation');
      expect(results[0].success).toBe(true);
      expect(results[0].result).toEqual({
        enhancePrompt: true,
        tone: 'professional',
        minWords: 500,
      });
    });

    it('should handle plugin execution errors gracefully', async () => {
      const pool = createMockPool();
      let callCount = 0;
      pool.query = async (text: string, _params?: any[]) => {
        if (text.startsWith('SELECT')) {
          callCount++;
          if (callCount === 1) {
            return { rows: [{}], rowCount: 1 };
          }
          return {
            rows: [
              {
                instance_id: 'inst-2',
                config: {},
                client_id: 'c1',
                name: 'Broken Plugin',
                slug: 'unknown-broken',
                entry_point: null,
                config_schema: null,
                default_config: {},
                is_enabled: true,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };
      service.initialize(pool);

      const results = await service.executeHook('unregistered_hook', {
        clientId: 'c1',
      });

      expect(results).toHaveLength(1);
      expect(results[0].plugin).toBe('unknown-broken');
      expect(results[0].success).toBe(true);
      expect(results[0].result).toEqual({
        config: {},
        hook: 'unregistered_hook',
        context: { clientId: 'c1' },
      });
    });
  });

  // ─── Shopify publisher hook ───────────────────

  describe('shopify-publisher hooks', () => {
    it('before_publish should return autoPublish and generateImages config', async () => {
      const pool = createMockPool();
      let callCount = 0;
      pool.query = async (text: string, _params?: any[]) => {
        if (text.startsWith('SELECT')) {
          callCount++;
          if (callCount === 1) return { rows: [{}], rowCount: 1 };
          return {
            rows: [{
              instance_id: 'inst-3',
              config: { autoPublish: true, generateImages: false },
              client_id: 'c1',
              name: 'Shopify Publisher',
              slug: 'shopify-publisher',
              entry_point: null,
              config_schema: null,
              default_config: {},
              is_enabled: true,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };
      service.initialize(pool);

      const results = await service.executeHook('before_publish', { clientId: 'c1' });

      expect(results).toHaveLength(1);
      expect(results[0].plugin).toBe('shopify-publisher');
      expect(results[0].success).toBe(true);
      expect(results[0].result).toEqual({
        autoPublish: true,
        generateImages: false,
      });
    });

    it('after_publish should return published status and URL', async () => {
      const pool = createMockPool();
      let callCount = 0;
      pool.query = async (text: string, _params?: any[]) => {
        if (text.startsWith('SELECT')) {
          callCount++;
          if (callCount === 1) return { rows: [{}], rowCount: 1 };
          return {
            rows: [{
              instance_id: 'inst-4',
              config: {},
              client_id: 'c1',
              name: 'Shopify Publisher',
              slug: 'shopify-publisher',
              entry_point: null,
              config_schema: null,
              default_config: {},
              is_enabled: true,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };
      service.initialize(pool);

      const results = await service.executeHook('after_publish', {
        clientId: 'c1',
        data: { publishUrl: 'https://shop.example.com/articles/test' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].plugin).toBe('shopify-publisher');
      expect(results[0].success).toBe(true);
      expect(results[0].result).toEqual({
        published: true,
        url: 'https://shop.example.com/articles/test',
      });
    });
  });

  // ─── Instance management ─────────────────────

  describe('instance management', () => {
    it('registerInstance should throw when plugin not in registry', async () => {
      const pool = createMockPool();
      pool.query = async () => ({ rows: [], rowCount: 0 });
      service.initialize(pool);

      await expect(service.registerInstance('nonexistent', 'c1'))
        .rejects.toThrow('Plugin not found: nonexistent');
    });

    it('toggleInstance should throw when instance not found', async () => {
      const pool = createMockPool();
      pool.query = async () => ({ rows: [], rowCount: 0 });
      service.initialize(pool);

      await expect(service.toggleInstance('missing', 'c1'))
        .rejects.toThrow('Plugin instance not found');
    });

    it('toggleInstance should return updated is_enabled status', async () => {
      const pool = createMockPool();
      pool.query = async (text: string) => {
        if (text.includes('UPDATE plugin_instances SET is_enabled = NOT is_enabled')) {
          return { rows: [{ id: 'inst-1', is_enabled: true }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      };
      service.initialize(pool);

      const result = await service.toggleInstance('inst-1', 'c1');
      expect(result).toEqual({ id: 'inst-1', is_enabled: true });
    });

    it('updateConfig should throw when instance not found', async () => {
      const pool = createMockPool();
      pool.query = async () => ({ rows: [], rowCount: 0 });
      service.initialize(pool);

      await expect(service.updateConfig('missing', 'c1', { key: 'val' }))
        .rejects.toThrow('Plugin instance not found');
    });

    it('updateConfig should return updated config', async () => {
      const pool = createMockPool();
      pool.query = async (text: string, params?: any[]) => {
        if (text.includes('UPDATE plugin_instances SET config')) {
          return { rows: [{ id: 'inst-1', config: params?.[0] }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      };
      service.initialize(pool);

      const result = await service.updateConfig('inst-1', 'c1', { tone: 'friendly' });
      expect(result.id).toBe('inst-1');
      expect(JSON.parse(result.config)).toEqual({ tone: 'friendly' });
    });
  });

  // ─── close() ─────────────────────────────────

  describe('close', () => {
    it('should clear hook registry and log info', async () => {
      service.initialize(createMockPool());
      await service.close();
      expect((service as any).hookRegistry.size).toBe(0);
    });
  });
});
