// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// ChatEngine Tests
// Tests: command parsing, permission checking,
//        command execution, response generation
// ══════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import chatEngine from '../../services/chatEngine';

// ─── Mock Dependencies ────────────────────────

vi.mock('../../services/openai', () => ({
  default: {
    get isMockMode() { return true; },
    chat: vi.fn().mockResolvedValue(null),
    generateBlogPost: vi.fn(),
    generateTitle: vi.fn(),
    generateOutline: vi.fn(),
    generateFAQ: vi.fn(),
    generateMetadata: vi.fn(),
    enhanceSEO: vi.fn(),
    moderateContent: vi.fn(),
    generateArticleImage: vi.fn(),
    analyzeSEO: vi.fn(),
    generateKeywordVariations: vi.fn(),
    get provider() { return 'openai'; },

    initialize: vi.fn(),
    defaultModel: 'mock-model',
    maxTokens: 4096,
    temperature: 0.7,
  },
}));

vi.mock('../../utils/queue', () => ({
  addJob: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
  getJobStatus: vi.fn(),
  QueueNames: {
    CONTENT_GENERATION: 'content-generation',
    KEYWORD_RESEARCH: 'keyword-research',
    SHOPIFY_PUBLISH: 'shopify-publish',
    SEO_ANALYSIS: 'seo-analysis',
    DEFAULT: 'default',
  },
  JobTypes: {
    CONTENT_GENERATION: 'content-generation',
    KEYWORD_RESEARCH: 'keyword-research',
    SHOPIFY_PUBLISH: 'shopify-publish',
    SEO_ANALYSIS: 'seo-analysis',
  },
}));

const mockQuery = vi.fn();

function createMockPool() {
  return {
    query: mockQuery,
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
}

const mockAdmin = { userId: 'admin-1', role: 'admin', clientId: 'client-1' };
const mockEditor = { userId: 'editor-1', role: 'editor', clientId: 'client-1' };
const mockClientUser = { userId: 'client-1', role: 'client', clientId: 'client-1' };
const mockViewer = { userId: 'viewer-1', role: 'viewer' };

// ─────────────────────────────────────────────
// parseCommand — Pattern Matching
// ─────────────────────────────────────────────

describe('ChatEngine', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    chatEngine.initialize(createMockPool() as any);
  });

  describe('parseCommand', () => {
    it('should parse "generate" commands with count and keyword', async () => {
      const result = await chatEngine.parseCommand('generate 3 articles about plumbing repair');
      expect(result.action).toBe('generate_article');
      expect(result.params.count).toBe(3);
      expect(result.params.keyword).toBe('plumbing repair');
      expect(result.confidence).toBe(0.9);
      expect(result.requiresApproval).toBe(true);
    });

    it('should parse "generate" commands with default count of 1', async () => {
      const result = await chatEngine.parseCommand('generate article for HVAC maintenance');
      expect(result.action).toBe('generate_article');
      expect(result.params.count).toBe(1);
      expect(result.params.keyword).toBe('HVAC maintenance');
    });

    it('should parse "generate" commands with client ID', async () => {
      const result = await chatEngine.parseCommand('generate 2 articles for "gutter cleaning" for client abc-123');
      expect(result.action).toBe('generate_article');
      expect(result.params.count).toBe(2);
      expect(result.params.keyword).toBe('gutter cleaning');
      expect(result.params.clientId).toBe('abc-123');
    });

    it('should parse "publish" commands', async () => {
      const result = await chatEngine.parseCommand('publish article abc-123');
      expect(result.action).toBe('publish_article');
      expect(result.params.articleId).toBe('abc-123');
      expect(result.requiresApproval).toBe(false);
    });

    it('should parse "publish" commands with blog ID', async () => {
      const result = await chatEngine.parseCommand('publish article abc-123 to blog 456');
      expect(result.action).toBe('publish_article');
      expect(result.params.articleId).toBe('abc-123');
      expect(result.params.blogId).toBe('456');
    });

    it('should parse "research keywords" commands', async () => {
      const result = await chatEngine.parseCommand('research keywords for roof repair');
      expect(result.action).toBe('research_keywords');
      expect(result.params.seedKeyword).toBe('roof repair');
      expect(result.requiresApproval).toBe(false);
    });

    it('should parse "research keywords" commands with industry', async () => {
      const result = await chatEngine.parseCommand('research keywords for gutter cleaning in construction');
      expect(result.action).toBe('research_keywords');
      expect(result.params.seedKeyword).toBe('gutter cleaning');
      expect(result.params.industry).toBe('construction');
    });

    it('should parse "create client" commands', async () => {
      const result = await chatEngine.parseCommand('create client "Acme Plumbing" shop: acme.myshopify.com token: shpat_abc123');
      expect(result.action).toBe('create_client');
      expect(result.params.name).toBe('Acme Plumbing');
      expect(result.params.shop).toBe('acme.myshopify.com');
      expect(result.params.token).toBe('shpat_abc123');
      expect(result.requiresApproval).toBe(true);
    });

    it('should parse "help" command', async () => {
      const result = await chatEngine.parseCommand('help');
      expect(result.action).toBe('help');
      expect(result.target).toBe('system');
      expect(result.requiresApproval).toBe(false);
    });

    it('should parse "list articles" command', async () => {
      const result = await chatEngine.parseCommand('list articles');
      expect(result.action).toBe('list');
      expect(result.params.entity).toBe('articles');
    });

    it('should parse "list clients" command', async () => {
      const result = await chatEngine.parseCommand('list all clients');
      expect(result.action).toBe('list');
      expect(result.params.entity).toBe('clients');
    });

    it('should parse "list keywords for client" command', async () => {
      const result = await chatEngine.parseCommand('show keywords for client-1');
      expect(result.action).toBe('list');
      expect(result.params.entity).toBe('keywords');
      expect(result.params.filter).toBe('client-1');
    });

    it('should parse "list users" command', async () => {
      const result = await chatEngine.parseCommand('show all users');
      expect(result.action).toBe('list');
      expect(result.params.entity).toBe('users');
    });

    it('should parse "list plugins" command', async () => {
      const result = await chatEngine.parseCommand('list plugins');
      expect(result.action).toBe('list');
      expect(result.params.entity).toBe('plugins');
    });

    it('should parse "list api keys" command', async () => {
      const result = await chatEngine.parseCommand('list api keys');
      expect(result.action).toBe('list');
      expect(result.params.entity).toBe('api keys');
    });

    it('should parse "list logs" command', async () => {
      const result = await chatEngine.parseCommand('list logs');
      expect(result.action).toBe('list');
      expect(result.params.entity).toBe('logs');
    });

    it('should parse "delete article" command', async () => {
      const result = await chatEngine.parseCommand('delete article abc-123');
      expect(result.action).toBe('delete');
      expect(result.params.entityType).toBe('article');
      expect(result.params.identifier).toBe('abc-123');
      expect(result.requiresApproval).toBe(true);
    });

    it('should parse "delete client" command', async () => {
      const result = await chatEngine.parseCommand('delete the client xyz-789');
      expect(result.action).toBe('delete');
      expect(result.params.entityType).toBe('client');
      expect(result.params.identifier).toBe('xyz-789');
    });

    it('should parse "analyze improvements" command', async () => {
      const result = await chatEngine.parseCommand('analyze improvements');
      expect(result.action).toBe('analyze_improvements');
      expect(result.requiresApproval).toBe(false);
    });

    it('should parse "run improvements" command', async () => {
      const result = await chatEngine.parseCommand('run improvements');
      expect(result.action).toBe('analyze_improvements');
    });

    it('should parse "analyze seo" command', async () => {
      const result = await chatEngine.parseCommand('analyze seo for article abc-123');
      expect(result.action).toBe('analyze_seo');
      expect(result.params.articleId).toBe('abc-123');
    });

    it('should parse "check seo for article" command', async () => {
      const result = await chatEngine.parseCommand('check seo for article def-456');
      expect(result.action).toBe('analyze_seo');
      expect(result.params.articleId).toBe('def-456');
    });

    it('should parse "check status" command', async () => {
      const result = await chatEngine.parseCommand('check status of job-123');
      expect(result.action).toBe('check_status');
      expect(result.params.jobId).toBe('job-123');
    });

    it('should parse "status of job" command', async () => {
      const result = await chatEngine.parseCommand('status of job-456');
      expect(result.action).toBe('check_status');
      expect(result.params.jobId).toBe('job-456');
    });

    it('should parse "approve article" command', async () => {
      const result = await chatEngine.parseCommand('approve article abc-123');
      expect(result.action).toBe('approve_article');
      expect(result.params.articleId).toBe('abc-123');
      expect(result.requiresApproval).toBe(false);
    });

    it('should parse "reject article" command with reason', async () => {
      const result = await chatEngine.parseCommand('reject article abc-123 because: lacks citations');
      expect(result.action).toBe('reject_article');
      expect(result.params.articleId).toBe('abc-123');
      expect(result.params.reason).toBe('lacks citations');
    });

    it('should parse "reject article" command without reason', async () => {
      const result = await chatEngine.parseCommand('reject article abc-123');
      expect(result.action).toBe('reject_article');
      expect(result.params.articleId).toBe('abc-123');
      expect(result.params.reason).toBe('');
    });

    it('should parse "run plugin" command', async () => {
      const result = await chatEngine.parseCommand('run plugin seo-agent');
      expect(result.action).toBe('run_plugin');
      expect(result.params.pluginSlug).toBe('seo-agent');
      expect(result.requiresApproval).toBe(true);
    });

    it('should parse "run plugin" command with hook', async () => {
      const result = await chatEngine.parseCommand('run plugin seo-agent hook before_publish');
      expect(result.action).toBe('run_plugin');
      expect(result.params.pluginSlug).toBe('seo-agent');
      expect(result.params.hook).toBe('before_publish');
    });

    it('should parse "update config" command', async () => {
      const result = await chatEngine.parseCommand('update config default_model to gpt-4o-mini');
      expect(result.action).toBe('update_config');
      expect(result.params.key).toBe('default_model');
      expect(result.params.value).toBe('gpt-4o-mini');
      expect(result.requiresApproval).toBe(true);
    });

    it('should fall back to help for unknown commands', async () => {
      const result = await chatEngine.parseCommand('do something random');
      expect(result.action).toBe('help');
      expect(result.target).toBe('system');
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  // ─────────────────────────────────────────────
  // checkPermission — Role-Based Access Control
  // ─────────────────────────────────────────────

  describe('checkPermission', () => {
    it('should allow admin to execute admin actions', async () => {
      const cmd = await chatEngine.parseCommand('create client "Test"');
      const perm = chatEngine.checkPermission(cmd, 'admin');
      expect(perm.allowed).toBe(true);
    });

    it('should deny viewer from executing editor actions', async () => {
      const cmd = await chatEngine.parseCommand('generate article about plumbing');
      const perm = chatEngine.checkPermission(cmd, 'viewer');
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('editor');
    });

    it('should deny client from executing admin actions', async () => {
      const cmd = await chatEngine.parseCommand('create client "Test"');
      const perm = chatEngine.checkPermission(cmd, 'client');
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('admin');
    });

    it('should deny editor from executing admin actions', async () => {
      const cmd = await chatEngine.parseCommand('delete article abc-123');
      const perm = chatEngine.checkPermission(cmd, 'editor');
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('admin');
    });

    it('should allow editor to execute editor actions', async () => {
      const cmd = await chatEngine.parseCommand('generate article about plumbing');
      const perm = chatEngine.checkPermission(cmd, 'editor');
      expect(perm.allowed).toBe(true);
    });

    it('should allow editor to execute list actions', async () => {
      const cmd = await chatEngine.parseCommand('list articles');
      const perm = chatEngine.checkPermission(cmd, 'editor');
      expect(perm.allowed).toBe(true);
    });

    it('should allow viewer to execute help action', async () => {
      const cmd = await chatEngine.parseCommand('help');
      const perm = chatEngine.checkPermission(cmd, 'viewer');
      expect(perm.allowed).toBe(true);
    });

    it('should deny viewer from executing publish actions', async () => {
      const cmd = await chatEngine.parseCommand('publish article abc-123');
      const perm = chatEngine.checkPermission(cmd, 'viewer');
      expect(perm.allowed).toBe(false);
    });

    it('should deny client from executing delete actions', async () => {
      const cmd = await chatEngine.parseCommand('delete article abc-123');
      const perm = chatEngine.checkPermission(cmd, 'client');
      expect(perm.allowed).toBe(false);
    });

    it('should return helpful reason for denied permissions', async () => {
      const cmd = await chatEngine.parseCommand('create client "Test"');
      const perm = chatEngine.checkPermission(cmd, 'editor');
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('admin');
      expect(perm.requiredRole).toBe('admin');
    });
  });

  // ─────────────────────────────────────────────
  // executeCommand — Action Execution
  // ─────────────────────────────────────────────

  describe('executeCommand', () => {
    it('should queue article generation', async () => {
      const cmd = await chatEngine.parseCommand('generate 2 articles about plumbing');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('plumbing');
      expect(result.jobId).toBe('test-job-id');
    });

    it('should return error for article generation without clientId', async () => {
      const cmd = await chatEngine.parseCommand('generate article about plumbing');
      const result = await chatEngine.executeCommand(cmd, { userId: 'u1', role: 'editor' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No client specified');
    });

    it('should queue article publishing', async () => {
      const cmd = await chatEngine.parseCommand('publish article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('abc-123');
      expect(result.jobId).toBe('test-job-id');
    });

    it('should queue keyword research', async () => {
      const cmd = await chatEngine.parseCommand('research keywords for roof repair');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('roof repair');
      expect(result.jobId).toBe('test-job-id');
    });

    it('should return error for keyword research without clientId', async () => {
      const cmd = await chatEngine.parseCommand('research keywords for plumbing');
      const result = await chatEngine.executeCommand(cmd, { userId: 'u1', role: 'editor' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No client selected');
    });

    it('should queue SEO analysis', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ content_md: '# Test article', keyword: 'test keyword' }],
      });
      const cmd = await chatEngine.parseCommand('analyze seo for article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('abc-123');
      expect(result.jobId).toBe('test-job-id');
    });

    it('should return error for SEO analysis when article not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const cmd = await chatEngine.parseCommand('analyze seo for article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Article not found');
    });

    it('should return help text', async () => {
      const cmd = await chatEngine.parseCommand('help');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available Commands');
    });

    it('should approve an article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const cmd = await chatEngine.parseCommand('approve article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('abc-123');
      expect(result.message).toContain('approved');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE articles SET status'),
        ['abc-123']
      );
    });

    it('should reject an article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const cmd = await chatEngine.parseCommand('reject article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('abc-123');
      expect(result.message).toContain('rejected');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE articles SET status'),
        ['abc-123']
      );
    });

    it('should check permission before executing', async () => {
      const cmd = await chatEngine.parseCommand('create client "Test"');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    it('should create a client', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-client-id', name: 'Test Client' }],
      });
      const cmd = await chatEngine.parseCommand('create client "Test Client"');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test Client');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO clients'),
        expect.arrayContaining(['Test Client', expect.any(String)])
      );
    });

    it('should deactivate a client on delete', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const cmd = await chatEngine.parseCommand('delete client abc-123');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.message).toContain('abc-123');
      expect(result.message).toContain('deactivated');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE clients'),
        ['abc-123']
      );
    });

    it('should archive an article on delete', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const cmd = await chatEngine.parseCommand('delete article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.message).toContain('abc-123');
      expect(result.message).toContain('deactivated');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE articles'),
        ['abc-123']
      );
    });

    it('should queue plugin execution', async () => {
      const cmd = await chatEngine.parseCommand('run plugin seo-agent');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.message).toContain('seo-agent');
      expect(result.jobId).toBe('test-job-id');
    });

    it('should return greeting message', async () => {
      const cmd = { action: 'greeting', target: 'system', params: {}, confidence: 0.9, requiresApproval: false };
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Hello');
    });

    it('should return thanks message', async () => {
      const cmd = { action: 'thanks', target: 'system', params: {}, confidence: 0.9, requiresApproval: false };
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('welcome');
    });

    it('should return analyze_improvements message', async () => {
      const cmd = await chatEngine.parseCommand('analyze improvements');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.message).toContain('improvement analysis');
    });
  });

  // ─────────────────────────────────────────────
  // executeCommand — List (handleList)
  // ─────────────────────────────────────────────

  describe('executeCommand — list', () => {
    it('should list articles with client filter', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'a1', title: 'Article 1', status: 'published', word_count: 500, seo_score: 75, created_at: new Date() },
        ],
      });
      const cmd = await chatEngine.parseCommand('list articles for client-1');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('1 articles');
      expect(result.data).toBeDefined();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM articles'),
        ['client-1']
      );
    });

    it('should list clients (admin only)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Client 1' }] });
      const cmd = await chatEngine.parseCommand('list clients');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.message).toContain('clients');
    });

    it('should deny non-admin from listing clients', async () => {
      const cmd = await chatEngine.parseCommand('list clients');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Admin access required');
    });

    it('should list keywords', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ keyword: 'plumbing', search_volume: 500, competition: 0.3, relevance_score: 80 }],
      });
      const cmd = await chatEngine.parseCommand('list keywords');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('keywords');
    });

    it('should list users (admin only)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'test@test.com', name: 'Test', role: 'editor' }] });
      const cmd = await chatEngine.parseCommand('list users');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(true);
      expect(result.message).toContain('users');
    });

    it('should deny non-admin from listing users', async () => {
      const cmd = await chatEngine.parseCommand('list users');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Admin access required');
    });

    it('should list plugins', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ name: 'SEO Agent', slug: 'seo-agent', version: '1.0.0', is_active: true }],
      });
      const cmd = await chatEngine.parseCommand('list plugins');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('plugins');
    });

    it('should list api keys', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'k1', service: 'openai', label: 'Prod Key', masked_value: 'sk-****', is_active: true }],
      });
      const cmd = await chatEngine.parseCommand('list api keys');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('api keys');
    });

    it('should list logs', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_at: new Date(), level: 'info', action: 'pipeline_started', message: 'Pipeline started' }],
      });
      const cmd = await chatEngine.parseCommand('list logs');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('logs');
    });

    it('should return error for unknown entity', async () => {
      const cmd = { action: 'list', target: 'data', params: { entity: 'widgets', filter: null }, confidence: 0.9, requiresApproval: false };
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown entity');
    });

    it('should list articles with clientId from user when no filter provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const cmd = await chatEngine.parseCommand('list articles');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('client_id = $1'),
        ['client-1']
      );
    });
  });

  // ─────────────────────────────────────────────
  // executeCommand — check_status
  // ─────────────────────────────────────────────

  describe('executeCommand — check_status', () => {
    it('should report job status when job exists', async () => {
      const { getJobStatus } = await import('../../utils/queue');
      (getJobStatus as any).mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: { url: 'https://example.com' },
      });
      const cmd = await chatEngine.parseCommand('check status of job-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('job-123');
    });

    it('should return error when job not found', async () => {
      const { getJobStatus } = await import('../../utils/queue');
      (getJobStatus as any).mockResolvedValueOnce(undefined);
      const cmd = await chatEngine.parseCommand('check status of job-999');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Job not found');
    });

    it('should handle Redis unavailability gracefully', async () => {
      const { getJobStatus } = await import('../../utils/queue');
      (getJobStatus as any).mockRejectedValueOnce(new Error('Redis unavailable'));
      const cmd = await chatEngine.parseCommand('check status of job-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis may be unavailable');
    });
  });

  // ─────────────────────────────────────────────
  // executeCommand — Permission Denial
  // ─────────────────────────────────────────────

  describe('executeCommand — permission denial', () => {
    it('should deny execute when permission check fails', async () => {
      const cmd = await chatEngine.parseCommand('delete client abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
      expect(result.requiresApproval).toBe(false);
    });

    it('should deny generate_article for viewer', async () => {
      const cmd = await chatEngine.parseCommand('generate article about plumbing');
      const result = await chatEngine.executeCommand(cmd, mockViewer);
      expect(result.success).toBe(false);
      expect(result.error).toContain('editor');
    });
  });

  // ─────────────────────────────────────────────
  // executeCommand — Database Not Connected
  // ─────────────────────────────────────────────

  describe('executeCommand — DB not connected', () => {
    it('should return error for analyze_seo without pool', async () => {
      chatEngine.initialize(null as any);
      const cmd = await chatEngine.parseCommand('analyze seo for article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database not connected');
    });

    it('should return error for approve without pool', async () => {
      chatEngine.initialize(null as any);
      const cmd = await chatEngine.parseCommand('approve article abc-123');
      const result = await chatEngine.executeCommand(cmd, mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database not connected');
    });

    it('should return error for create_client without pool', async () => {
      chatEngine.initialize(null as any);
      const cmd = await chatEngine.parseCommand('create client "Test"');
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database not connected');
    });
  });

  // ─────────────────────────────────────────────
  // executeCommand — Unknown Action
  // ─────────────────────────────────────────────

  describe('executeCommand — unknown action', () => {
    it('should return error for unknown action', async () => {
      // Use admin role so permission check passes and we reach the default switch case
      const cmd = { action: 'fly_to_moon', target: 'system', params: {}, confidence: 0.9, requiresApproval: false };
      const result = await chatEngine.executeCommand(cmd, mockAdmin);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });

  // ─────────────────────────────────────────────
  // generateResponse — Top-Level Orchestration
  // ─────────────────────────────────────────────

  describe('generateResponse', () => {
    it('should execute high-confidence commands directly', async () => {
      const result = await chatEngine.generateResponse('help', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available Commands');
    });

    it('should return fallback for low-confidence unknown commands', async () => {
      const result = await chatEngine.generateResponse('do something random', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('not sure I understood');
    });

    it('should handle empty input', async () => {
      const result = await chatEngine.generateResponse('', [], mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should handle whitespace-only input', async () => {
      const result = await chatEngine.generateResponse('   ', [], mockEditor);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should route greetings to fallback response', async () => {
      const result = await chatEngine.generateResponse('hello', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Hello');
    });

    it('should route thanks to fallback response', async () => {
      const result = await chatEngine.generateResponse('thank you', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('welcome');
    });

    it('should route how-are-you to fallback response', async () => {
      const result = await chatEngine.generateResponse('how are you', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('doing great');
    });

    it('should include conversation history context', async () => {
      const history = [
        { role: 'user', content: 'list articles' },
        { role: 'assistant', content: '📋 Found 5 articles' },
      ];
      const result = await chatEngine.generateResponse('generate 2 more', history, mockEditor);
      expect(result.success).toBe(true);
    });

    it('should execute commands with trailing spaces', async () => {
      const result = await chatEngine.generateResponse('  help  ', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available Commands');
    });
  });

  // ─────────────────────────────────────────────
  // ruleBasedClassify — Fallback Intent Classifier
  // ─────────────────────────────────────────────

  describe('ruleBasedClassify', () => {
    it('should classify greetings', async () => {
      const result = await chatEngine.parseCommand('hello there');
      expect(result.action).toBe('greeting');
    });

    it('should classify "thank you" via fallback', async () => {
      const result = await chatEngine.parseCommand('thank you very much');
      expect(result.action).toBe('thanks');
    });

    it('should classify research fallback', async () => {
      const result = await chatEngine.parseCommand('research keywords for plumbing');
      expect(result.action).toBe('research_keywords');
      expect(result.params.seedKeyword).toBe('plumbing');
    });

    it('should classify generate fallback', async () => {
      const result = await chatEngine.parseCommand('write article about HVAC maintenance');
      expect(result.action).toBe('generate_article');
      expect(result.params.keyword).toContain('HVAC');
    });
  });

  // ─────────────────────────────────────────────
  // fallbackResponse — Conversational Fallbacks
  // ─────────────────────────────────────────────

  describe('fallbackResponse', () => {
    it('should respond to "hey" greeting', async () => {
      const result = await chatEngine.generateResponse('hey', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Hello');
    });

    it('should respond to "good morning" greeting', async () => {
      const result = await chatEngine.generateResponse('good morning', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Buffy');
    });

    it('should respond to "thanks"', async () => {
      const result = await chatEngine.generateResponse('thanks a lot!', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('welcome');
    });

    it('should respond to "what can you do"', async () => {
      const result = await chatEngine.generateResponse('what can you do?', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('SEO content pipeline');
    });

    it('should respond to "capabilities"', async () => {
      const result = await chatEngine.generateResponse('tell me your capabilities', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('SEO content pipeline');
    });

    it('should provide default redirect for unknown input', async () => {
      const result = await chatEngine.generateResponse('tell me a joke', [], mockEditor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('help');
    });
  });
});
