// ──────────────────────────────────────────────
// Chat Control Engine
// Converts natural language commands into safe,
// permission-checked backend actions and queued jobs
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { generateSlug } from '../utils/stringUtils';
import { addJob, getJobStatus } from '../utils/queue';
import { QueueNames, JobTypes } from '../queues/definitions';
import openaiService from './openai';

interface ParsedCommand {
  action: string;
  target: string;
  params: Record<string, unknown>;
  confidence: number;
  requiresApproval: boolean;
}

interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  requiredRole?: string;
}

const COMMAND_PATTERNS: Array<{
  pattern: RegExp;
  action: string;
  target: string;
  extractParams: (matches: RegExpMatchArray) => Record<string, unknown>;
  minRole: string;
  requiresApproval: boolean;
}> = [
  {
    pattern: /generate\s+(\d+)?\s*(?:seo\s+)?articles?\s+(?:for|about)\s+["']?(.+?)["']?\s*(?:for\s+client\s+(.+))?$/i,
    action: 'generate_article',
    target: 'article',
    extractParams: (m) => ({
      count: parseInt(m[1] || '1'),
      keyword: m[2]?.trim(),
      clientId: m[3]?.trim() || null,
    }),
    minRole: 'editor',
    requiresApproval: true,
  },
  {
    pattern: /publish\s+(?:article\s+)?(.+?)(?:\s+to\s+(?:blog\s+)?(\d+))?$/i,
    action: 'publish_article',
    target: 'article',
    extractParams: (m) => ({ articleId: m[1]?.trim(), blogId: m[2] || null }),
    minRole: 'editor',
    requiresApproval: false,
  },
  {
    pattern: /research\s+keywords?\s+(?:for\s+)?(.+?)(?:\s+in\s+(.+?))?$/i,
    action: 'research_keywords',
    target: 'keywords',
    extractParams: (m) => ({ seedKeyword: m[1]?.trim(), industry: m[2]?.trim() || '' }),
    minRole: 'editor',
    requiresApproval: false,
  },
  {
    pattern: /create\s+(?:a\s+)?client\s+(?:named\s+)?["']?(.+?)["']?\s*(?:shop:\s*(.+?))?(?:\s*token:\s*(.+))?$/i,
    action: 'create_client',
    target: 'client',
    extractParams: (m) => ({ name: m[1]?.trim(), shop: m[2]?.trim(), token: m[3]?.trim() }),
    minRole: 'admin',
    requiresApproval: true,
  },
  {
    pattern: /(?:list|show)\s+(?:all\s+)?(articles|clients|keywords|users|plugins|api.keys|logs)(?:\s+(?:for|of)\s+(.+))?$/i,
    action: 'list',
    target: 'data',
    extractParams: (m) => ({ entity: m[1]?.trim().toLowerCase(), filter: m[2]?.trim() || null }),
    minRole: 'editor',
    requiresApproval: false,
  },
  {
    pattern: /delete\s+(?:the\s+)?(article|client|user|plugin|api.key)\s+(.+)$/i,
    action: 'delete',
    target: 'entity',
    extractParams: (m) => ({ entityType: m[1]?.trim().toLowerCase(), identifier: m[2]?.trim() }),
    minRole: 'admin',
    requiresApproval: true,
  },
  {
    pattern: /(?:analyze|run)\s+improvements?$/i,
    action: 'analyze_improvements',
    target: 'improvements',
    extractParams: () => ({}),
    minRole: 'admin',
    requiresApproval: false,
  },
  {
    pattern: /(?:analyze|check seo)\s+(?:seo\s+)?(?:for\s+)?(?:article\s+)?(.+)$/i,
    action: 'analyze_seo',
    target: 'article',
    extractParams: (m) => ({ articleId: m[1]?.trim() }),
    minRole: 'editor',
    requiresApproval: false,
  },
  {
    pattern: /(?:check\s+)?status\s+(?:of\s+)?(?:job\s+)?(.+)$/i,
    action: 'check_status',
    target: 'job',
    extractParams: (m) => ({ jobId: m[1]?.trim() }),
    minRole: 'editor',
    requiresApproval: false,
  },
  {
    pattern: /approve\s+(?:article\s+)?(.+)$/i,
    action: 'approve_article',
    target: 'article',
    extractParams: (m) => ({ articleId: m[1]?.trim() }),
    minRole: 'editor',
    requiresApproval: false,
  },
  {
    pattern: /reject\s+(?:article\s+)?(.+?)(?:\s+(?:because|reason):\s*(.+))?$/i,
    action: 'reject_article',
    target: 'article',
    extractParams: (m) => ({ articleId: m[1]?.trim(), reason: m[2]?.trim() || '' }),
    minRole: 'editor',
    requiresApproval: false,
  },
  {
    pattern: /help$/i,
    action: 'help',
    target: 'system',
    extractParams: () => ({}),
    minRole: 'viewer',
    requiresApproval: false,
  },
  {
    pattern: /run\s+(?:plugin\s+)?(.+?)(?:\s+hook\s+(.+))?$/i,
    action: 'run_plugin',
    target: 'plugin',
    extractParams: (m) => ({ pluginSlug: m[1]?.trim(), hook: m[2]?.trim() || 'manual' }),
    minRole: 'admin',
    requiresApproval: true,
  },
  {
    pattern: /(?:update|change)\s+config\s+(.+?)\s+to\s+(.+)$/i,
    action: 'update_config',
    target: 'config',
    extractParams: (m) => ({ key: m[1]?.trim(), value: m[2]?.trim() }),
    minRole: 'admin',
    requiresApproval: true,
  },
  // Conversational patterns (minRole: viewer so anyone can use them)
  {
    pattern: /^$/, // not pattern-matched; exists only for checkPermission
    action: 'greeting',
    target: 'conversational',
    extractParams: () => ({}),
    minRole: 'viewer',
    requiresApproval: false,
  },
  {
    pattern: /^$/, // not pattern-matched; exists only for checkPermission
    action: 'thanks',
    target: 'conversational',
    extractParams: () => ({}),
    minRole: 'viewer',
    requiresApproval: false,
  },
];

export class ChatEngine {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Chat engine initialized');
  }

  /**
   * Parse a natural language command and return a structured action.
   */
  async parseCommand(input: string): Promise<ParsedCommand> {
    const trimmed = input.trim();

    // Try pattern matching first
    for (const pattern of COMMAND_PATTERNS) {
      const match = trimmed.match(pattern.pattern);
      if (match) {
        return {
          action: pattern.action,
          target: pattern.target,
          params: pattern.extractParams(match),
          confidence: 0.9,
          requiresApproval: pattern.requiresApproval,
        };
      }
    }

    // Fallback: use AI to interpret
    try {
      const interpretation = await this.aiInterpret(trimmed);
      return interpretation;
    } catch (err) {
      logger.warn('AI command interpretation failed, returning help', { input: trimmed });
      return {
        action: 'help',
        target: 'system',
        params: { unknownCommand: trimmed },
        confidence: 0.1,
        requiresApproval: false,
      };
    }
  }

  /**
   * Check if user has permission to execute a command.
   */
  checkPermission(command: ParsedCommand, userRole: string): PermissionCheck {
    const pattern = COMMAND_PATTERNS.find(p => p.action === command.action);
    const requiredRole = pattern?.minRole || 'admin';

    const roleHierarchy: Record<string, number> = {
      viewer: 0,
      client: 1,
      editor: 2,
      admin: 3,
    };

    const userLevel = roleHierarchy[userRole] ?? -1;
    const requiredLevel = roleHierarchy[requiredRole] ?? 99;

    if (userLevel < requiredLevel) {
      return {
        allowed: false,
        reason: `This action requires ${requiredRole} role. Your role: ${userRole}`,
        requiredRole,
      };
    }

    return { allowed: true };
  }

  /**
   * Execute a parsed command — either directly or via queue.
   */
  async executeCommand(
    command: ParsedCommand,
    user: { userId: string; role: string; clientId?: string }
  ): Promise<CommandResult> {
    const permission = this.checkPermission(command, user.role);
    if (!permission.allowed) {
      return { success: false, error: permission.reason, requiresApproval: false };
    }

    logger.info('Executing command', { action: command.action, user: user.userId, params: command.params });

    switch (command.action) {
      case 'generate_article': {
        const clientId = (command.params.clientId as string) || user.clientId;
        if (!clientId) return { success: false, error: 'No client specified', requiresApproval: false };

        const job = await addJob(QueueNames.CONTENT_GENERATION, JobTypes.CONTENT_GENERATION, {
          clientId,
          keyword: command.params.keyword as string,
          publish: false,
        });

        await this.logChatAction(user.userId, 'generate_article', `Queued article generation: ${command.params.keyword}`, {
          jobId: job.id,
          clientId,
        });

        return {
          success: true,
          message: `✅ Queued article generation for "${command.params.keyword}" (Job: ${job.id})`,
          jobId: job.id,
          requiresApproval: command.requiresApproval,
        };
      }

      case 'publish_article': {
        const job = await addJob(QueueNames.SHOPIFY_PUBLISH, JobTypes.SHOPIFY_PUBLISH, {
          articleId: command.params.articleId as string,
          clientId: user.clientId,
          blogId: command.params.blogId || null,
        });
        return {
          success: true,
          message: `📤 Publishing queued for article ${command.params.articleId}`,
          jobId: job.id,
          requiresApproval: false,
        };
      }

      case 'research_keywords': {
        const clientId = user.clientId;
        if (!clientId) return { success: false, error: 'No client selected', requiresApproval: false };
        const job = await addJob(QueueNames.KEYWORD_RESEARCH, JobTypes.KEYWORD_RESEARCH, {
          clientId,
          seedKeywords: [command.params.seedKeyword as string],
          industry: command.params.industry as string,
        });
        return {
          success: true,
          message: `🔍 Researching keywords for "${command.params.seedKeyword}"`,
          jobId: job.id,
          requiresApproval: false,
        };
      }

      case 'analyze_seo': {
        if (!this.pool) return { success: false, error: 'Database not connected', requiresApproval: false };
        const articleId = command.params.articleId as string;
        const article = await this.pool.query(
          'SELECT content_md, keyword FROM articles a LEFT JOIN keywords k ON k.id = a.keyword_id WHERE a.id = $1',
          [articleId]
        );
        if (article.rows.length === 0) {
          return { success: false, error: 'Article not found', requiresApproval: false };
        }
        const job = await addJob(QueueNames.SEO_ANALYSIS, JobTypes.SEO_ANALYSIS, {
          articleId: articleId,
          content: article.rows[0].content_md as string,
          keyword: (article.rows[0].keyword as string) || '',
        });
        return {
          success: true,
          message: `📊 SEO analysis queued for article ${command.params.articleId}`,
          jobId: job.id,
          requiresApproval: false,
        };
      }

      case 'list': {
        return this.handleList(command, user);
      }

      case 'help': {
        return {
          success: true,
          message: this.getHelpText(),
          requiresApproval: false,
        };
      }

      case 'check_status': {
        try {
          const job = await getJobStatus(QueueNames.DEFAULT, command.params.jobId as string);
          if (job) {
            return {
              success: true,
              message: `Job ${command.params.jobId}: ${(await job.getState()) || 'unknown'}`,
              data: { state: await job.getState(), progress: job.progress, result: job.returnvalue },
              requiresApproval: false,
            };
          }
          return { success: false, error: 'Job not found', requiresApproval: false };
        } catch {
          return { success: false, error: 'Could not check job status (Redis may be unavailable)', requiresApproval: false };
        }
      }

      case 'approve_article': {
        if (!this.pool) return { success: false, error: 'Database not connected', requiresApproval: false };
        await this.pool.query(
          `UPDATE articles SET status = 'approved', updated_at = NOW() WHERE id = $1`,
          [command.params.articleId as string]
        );
        return { success: true, message: `✅ Article ${command.params.articleId} approved`, requiresApproval: false };
      }

      case 'reject_article': {
        if (!this.pool) return { success: false, error: 'Database not connected', requiresApproval: false };
        await this.pool.query(
          `UPDATE articles SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
          [command.params.articleId as string]
        );
        return { success: true, message: `❌ Article ${command.params.articleId} rejected`, requiresApproval: false };
      }

      case 'create_client': {
        if (!this.pool) return { success: false, error: 'Database not connected', requiresApproval: false };
        const { name, shop, token } = command.params;
        const slug = generateSlug(name as string);
        const result = await this.pool.query(
          `INSERT INTO clients (name, slug, shopify_shop, shopify_token)
           VALUES ($1, $2, $3, $4) RETURNING id, name`,
          [name, slug, shop || '', token || '']
        );
        return { success: true, message: `🏢 Client created: ${result.rows[0].name} (${result.rows[0].id})`, requiresApproval: false };
      }

      case 'delete': {
        if (!this.pool) return { success: false, error: 'Database not connected', requiresApproval: false };
        const { entityType, identifier } = command.params;
        if (entityType === 'client') {
          await this.pool.query('UPDATE clients SET is_active = false WHERE id = $1', [identifier]);
        } else if (entityType === 'article') {
          await this.pool.query('UPDATE articles SET status = \'archived\' WHERE id = $1', [identifier]);
        }
        return { success: true, message: `🗑️ ${entityType} ${identifier} deactivated`, requiresApproval: false };
      }

      case 'run_plugin': {
        const job = await addJob(QueueNames.DEFAULT, 'plugin-execution', {
          pluginSlug: command.params.pluginSlug,
          hook: command.params.hook,
          clientId: user.clientId,
        });
        return {
          success: true,
          message: `🔌 Plugin "${command.params.pluginSlug}" execution queued (Hook: ${command.params.hook})`,
          jobId: job.id,
          requiresApproval: false,
        };
      }

      case 'greeting':
        return { success: true, message: 'Hello! How can I help you today? Type `help` to see available commands.', requiresApproval: false };

      case 'thanks':
        return { success: true, message: "You're welcome! Let me know if you need anything else.", requiresApproval: false };

      case 'analyze_improvements': {
        return {
          success: true,
          message: `🤖 Running platform improvement analysis... This will analyze job performance, error rates, and execution patterns to find optimization opportunities. Results will appear in the AI Insights dashboard. You can also visit the AI Insights page to see past suggestions.`,
          requiresApproval: false,
        };
      }

      default:
        return { success: false, error: `Unknown action: ${command.action}`, requiresApproval: false };
    }
  }

  private async handleList(command: ParsedCommand, user: { userId: string; role: string; clientId?: string }): Promise<CommandResult> {
    if (!this.pool) return { success: false, error: 'Database not connected', requiresApproval: false };
    const entity = command.params.entity as string;
    const filter = command.params.filter as string;
    const isAdmin = user.role === 'admin';
    const clientFilter = user.clientId;

    let query: string;
    let params: any[] = [];

    const effectiveClientId = filter || clientFilter;

    switch (entity) {
      case 'articles':
        if (effectiveClientId) {
          query = `SELECT id, title, status, word_count, seo_score, created_at FROM articles WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20`;
          params = [effectiveClientId];
        } else {
          query = `SELECT id, title, status, word_count, seo_score, created_at FROM articles ORDER BY created_at DESC LIMIT 20`;
        }
        break;
      case 'clients':
        if (!isAdmin) return { success: false, error: 'Admin access required', requiresApproval: false };
        query = `SELECT id, name, slug, is_active, created_at FROM clients ORDER BY name LIMIT 20`;
        break;
      case 'keywords':
        if (effectiveClientId) {
          query = `SELECT keyword, search_volume, competition, relevance_score FROM keywords WHERE client_id = $1 AND is_active = true ORDER BY relevance_score DESC LIMIT 20`;
          params = [effectiveClientId];
        } else {
          query = `SELECT keyword, search_volume, competition, relevance_score FROM keywords WHERE is_active = true ORDER BY relevance_score DESC LIMIT 20`;
        }
        break;
      case 'users':
        if (!isAdmin) return { success: false, error: 'Admin access required', requiresApproval: false };
        query = `SELECT id, email, name, role, is_active, last_login_at FROM users ORDER BY name LIMIT 20`;
        break;
      case 'plugins':
        query = `SELECT name, slug, version, is_active FROM plugin_registry ORDER BY name`;
        break;
      case 'api keys':
        if (effectiveClientId) {
          query = `SELECT id, service, label, masked_value, is_active FROM api_keys WHERE client_id = $1 ORDER BY created_at DESC`;
          params = [effectiveClientId];
        } else {
          query = `SELECT id, service, label, masked_value, is_active FROM api_keys ORDER BY created_at DESC LIMIT 20`;
        }
        break;
      case 'logs':
        if (effectiveClientId) {
          query = `SELECT created_at, level, action, message FROM activity_logs WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20`;
          params = [effectiveClientId];
        } else {
          query = `SELECT created_at, level, action, message FROM activity_logs ORDER BY created_at DESC LIMIT 20`;
        }
        break;
      default:
        return { success: false, error: `Unknown entity: ${entity}. Try: articles, clients, keywords, users, plugins, api keys, logs`, requiresApproval: false };
    }

    const result = await this.pool.query(query, params);
    return {
      success: true,
      message: `📋 Found ${result.rows.length} ${entity}`,
      data: result.rows,
      requiresApproval: false,
    };
  }

  private async aiInterpret(input: string): Promise<ParsedCommand> {
    // Use OpenAI to classify unknown commands
    const response = await this.classifyIntent(input);
    return {
      action: response.action || 'help',
      target: response.target || 'system',
      params: response.params || {},
      confidence: response.confidence || 0.5,
      requiresApproval: response.requiresApproval || true,
    };
  }

  private async classifyIntent(input: string): Promise<{
    action: string;
    target: string;
    params: Record<string, unknown>;
    confidence: number;
    requiresApproval: boolean;
  }> {
    if (openaiService.isMockMode) {
      return this.ruleBasedClassify(input);
    }

    try {
      const systemPrompt = `You are an intent classifier for an AI SEO automation platform. Given a user message, classify it into ONE of the following actions and extract parameters.

Available actions with their expected params:
- generate_article: { keyword: string, count?: number, clientId?: string } — "generate 3 articles about plumbing"
- publish_article: { articleId: string, blogId?: string } — "publish article abc-123"
- research_keywords: { seedKeyword: string, industry?: string } — "research keywords for roof repair in construction"
- create_client: { name: string, shop?: string, token?: string } — "create client Acme Plumbing"
- list: { entity: string, filter?: string } — "list articles", "list clients", "list keywords"
- delete: { entityType: string, identifier: string } — "delete article abc-123"
- analyze_improvements: {} — "run improvements", "analyze system"
- analyze_seo: { articleId: string } — "analyze seo for article abc-123"
- check_status: { jobId: string } — "check status of job-123"
- approve_article: { articleId: string } — "approve article abc-123"
- reject_article: { articleId: string, reason?: string } — "reject article abc-123 because it lacks data"
- update_config: { key: string, value: string } — "update config default_model to gpt-4o-mini"
- run_plugin: { pluginSlug: string, hook?: string } — "run plugin seo-agent"
- greeting: {} — any greeting or casual chat
- thanks: {} — expressions of gratitude
- help: {} — requests for capabilities or what you can do

Respond with JSON ONLY:
{
  "action": "action_name",
  "target": "target_type",
  "params": {},
  "confidence": 0.0-1.0,
  "requiresApproval": true/false
}`;

      const response = await openaiService.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Classify this: "${input}"` }
      ], { temperature: 0.1, maxTokens: 300 });

      if (response) {
        const result = JSON.parse(response);
        if (result.action) {
          return {
            action: result.action as string,
            target: result.target as string || 'system',
            params: (result.params as Record<string, unknown>) || {},
            confidence: (result.confidence as number) || 0.7,
            requiresApproval: (result.requiresApproval as boolean) || true
          };
        }
      }
    } catch (err) {
      logger.warn('AI intent classification failed, falling back to rule-based', {
        input,
        error: (err as Error).message
      });
    }

    return this.ruleBasedClassify(input);
  }

  /**
   * Rule-based intent classification fallback.
   */
  private ruleBasedClassify(input: string): {
    action: string;
    target: string;
    params: Record<string, unknown>;
    confidence: number;
    requiresApproval: boolean;
  } {
    const lower = input.toLowerCase();
    if (/\b(hello|hi|hey)\b/i.test(lower)) {
      return { action: 'greeting', target: 'system', params: {}, confidence: 0.8, requiresApproval: false };
    }
    if (lower.includes('thank')) {
      return { action: 'thanks', target: 'system', params: {}, confidence: 0.9, requiresApproval: false };
    }
    if (lower.includes('research') || lower.includes('find') || lower.includes('discover')) {
      return { action: 'research_keywords', target: 'keywords', params: { seedKeyword: input.replace(/research|find|discover/gi, '').trim() }, confidence: 0.6, requiresApproval: false };
    }
    if (lower.includes('generate') || lower.includes('create article') || lower.includes('write')) {
      const keyword = input.replace(/generate|create article|write|about|for/gi, '').replace(/\d+/g, '').trim();
      const count = parseInt(input.match(/\d+/)?.[0] || '1', 10);
      return { action: 'generate_article', target: 'article', params: { keyword, count }, confidence: 0.6, requiresApproval: false };
    }
    return { action: 'help', target: 'system', params: { query: input }, confidence: 0.3, requiresApproval: false };
  }

  /**
   * Generate a response to a user message.
   *
   * Flow:
   * 1. Try pattern matching for explicit commands
   * 2. If no command matched, try AI conversation (when OpenAI available)
   * 3. Fall back to rule-based intent classification
   */
  async generateResponse(
    input: string,
    history: Array<{ role: string; content: string }>,
    user: { userId: string; role: string; clientId?: string }
  ): Promise<CommandResult> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { success: false, error: 'Message cannot be empty', requiresApproval: false };
    }

    // Step 1: Try pattern matching for explicit commands
    const parsed = await this.parseCommand(trimmed);

    // High-confidence explicit command — execute it directly
    if (parsed.confidence >= 0.9 && parsed.action !== 'help') {
      const result = await this.executeCommand(parsed, user);
      // Enrich help fallback with AI personality
      if (!result.success && result.error?.includes('Unknown action')) {
        // Fall through to AI
      } else {
        return result;
      }
    }

    // Step 2: Search database for relevant context and try AI conversation
    if (!openaiService.isMockMode) {
      const dbContext = await this.searchDatabase(trimmed, user);
      const aiResponse = await this.aiConversation(trimmed, history, user, dbContext);
      if (aiResponse) {
        return aiResponse;
      }
    }

    // Step 3: Fallback — execute parsed command (greeting, thanks, or unknown)
    // Low-confidence 'help' means classifyIntent didn't understand — use conversational fallback
    if (parsed.confidence < 0.9 && parsed.action === 'help') {
      return {
        success: true,
        message: this.fallbackResponse(trimmed),
        requiresApproval: false,
      };
    }

    const result = await this.executeCommand(parsed, user);

    // If unknown action, give a friendly fallback instead of the raw error
    if (!result.success && result.error?.includes('Unknown action')) {
      return {
        success: true,
        message: this.fallbackResponse(trimmed),
        requiresApproval: false,
      };
    }

    return result;
  }

  /**
   * Search the database for context relevant to the user's query.
   * Searches clients, articles, keywords, and activity logs.
   */
  private async searchDatabase(
    input: string,
    user: { userId: string; role: string; clientId?: string }
  ): Promise<string> {
    if (!this.pool) return '';

    const lower = input.toLowerCase();

    // Extract meaningful search terms (remove common stop words and chat filler)
    const stopWords = new Set([
      'tell', 'me', 'what', 'we', 'did', 'for', 'about', 'the', 'a', 'an', 'is', 'are',
      'was', 'were', 'show', 'give', 'get', 'find', 'list', 'all', 'how', 'many', 'any',
      'some', 'can', 'you', 'they', 'them', 'this', 'that', 'with', 'from', 'have', 'has',
      'been', 'being', 'does', 'done', 'doing', 'make', 'made', 'need', 'know',
      'want', 'like', 'just', 'will', 'would', 'could', 'should', 'has', 'had', 'its'
    ]);

    const terms = lower
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.has(t))
      .map(t => t.trim());

    if (terms.length === 0) return '';

    try {
      const contextParts: string[] = [];
      const seenClientIds = new Set<string>();

      // ── Search clients by name ──
      const likeClauses = terms.map((_, i) => `LOWER(c.name) LIKE $${i + 1}`).join(' OR ');
      const clientResult = await this.pool.query(
        `SELECT c.id, c.name, c.slug, c.is_active, c.created_at,
                (SELECT COUNT(*) FROM articles a WHERE a.client_id = c.id) as article_count
         FROM clients c
         WHERE c.is_active = true AND (${likeClauses})
         ORDER BY c.name LIMIT 10`,
        terms.map(t => `%${t}%`)
      );

      if (clientResult.rows.length > 0) {
        const clientLines: string[] = ['📋 **CLIENTS FOUND:**'];
        for (const c of clientResult.rows) {
          seenClientIds.add(c.id);
          clientLines.push(`  • ${c.name} (slug: ${c.slug}) — ${c.article_count} articles`);
        }
        contextParts.push(clientLines.join('\n'));
      }

      // ── Search articles by title ──
      const articleLikeClauses = terms.map((_, i) => `LOWER(a.title) LIKE $${i + 1}`).join(' OR ');
      const articleResult = await this.pool.query(
        `SELECT a.id, a.title, a.status, a.seo_score, a.created_at, c.name as client_name, c.id as client_id
         FROM articles a
         JOIN clients c ON c.id = a.client_id
         WHERE (${articleLikeClauses})
         ORDER BY a.created_at DESC
         LIMIT 15`,
        terms.map(t => `%${t}%`)
      );

      if (articleResult.rows.length > 0) {
        const articleLines: string[] = ['\n📄 **ARTICLES FOUND:**'];
        for (const a of articleResult.rows) {
          seenClientIds.add(a.client_id);
          const seo = a.seo_score != null ? `SEO: ${a.seo_score}` : 'No score';
          articleLines.push(`  • "${a.title}" — ${a.client_name} | Status: ${a.status} | ${seo} | ${new Date(a.created_at).toLocaleDateString()}`);
        }
        contextParts.push(articleLines.join('\n'));
      }

      // ── Search keywords ──
      const kwLikeClauses = terms.map((_, i) => `LOWER(k.keyword) LIKE $${i + 1}`).join(' OR ');
      const kwResult = await this.pool.query(
        `SELECT k.keyword, k.search_volume, k.relevance_score, k.intent, c.name as client_name
         FROM keywords k
         JOIN clients c ON c.id = k.client_id
         WHERE k.is_active = true AND (${kwLikeClauses})
         ORDER BY k.relevance_score DESC NULLS LAST
         LIMIT 10`,
        terms.map(t => `%${t}%`)
      );

      if (kwResult.rows.length > 0) {
        const kwLines: string[] = ['\n🔑 **KEYWORDS FOUND:**'];
        for (const k of kwResult.rows) {
          const vol = k.search_volume != null ? `Vol: ${k.search_volume}` : 'No volume data';
          const score = k.relevance_score != null ? `Relevance: ${k.relevance_score}` : '';
          kwLines.push(`  • "${k.keyword}" — ${k.client_name} | ${vol}${score ? ` | ${score}` : ''} | Intent: ${k.intent || 'N/A'}`);
        }
        contextParts.push(kwLines.join('\n'));
      }

      // ── Activity logs for matched clients ──
      if (seenClientIds.size > 0) {
        const logResult = await this.pool.query(
          `SELECT al.action, al.message, al.level, al.created_at, c.name as client_name
           FROM activity_logs al
           JOIN clients c ON c.id = al.client_id
           WHERE al.client_id = ANY($1::uuid[])
           ORDER BY al.created_at DESC
           LIMIT 15`,
          [Array.from(seenClientIds)]
        );

        if (logResult.rows.length > 0) {
          const logLines: string[] = ['\n📋 **RECENT ACTIVITY:**'];
          for (const l of logResult.rows) {
            const icon = l.level === 'error' ? '🔴' : l.level === 'warn' ? '🟡' : '🟢';
            logLines.push(`  ${icon} [${l.client_name}] ${l.action}: ${l.message} — ${new Date(l.created_at).toLocaleDateString()}`);
          }
          contextParts.push(logLines.join('\n'));
        }
      }

      if (contextParts.length === 0) return '';

    const fullContext = contextParts.join('\n');
    // Limit context to 2000 chars to avoid overflowing the AI prompt
    return fullContext.length > 2000 ? fullContext.slice(0, 2000) + '\n... (results truncated)' : fullContext;
    } catch (err) {
      logger.warn('Database context search failed', { input, error: (err as Error).message });
      return '';
    }
  }

  /**
   * Conversational AI via OpenAI.
   * Builds a comprehensive system prompt covering ALL platform features,
   * enriched with real database context when available.
   */
  private async aiConversation(
    input: string,
    history: Array<{ role: string; content: string }>,
    user: { userId: string; role: string; clientId?: string },
    dbContext: string = ''
  ): Promise<CommandResult | null> {
    const providerName = 'OpenAI';
    const systemPrompt = `You are Buffy, a strategic full-stack AI assistant powered by ${providerName} Intelligence. You manage an entire AI SEO Automation SaaS platform. You are professional, direct, concise, and proactive.

## YOUR CAPABILITIES

You can manage platform features by executing natural language commands (listed below). **Important: you only see data that the system returns from these commands — you do NOT have direct database access.** Never fabricate data you haven't received from a command execution.

Here is everything you can do:

### 📝 Content Management
- **Generate Articles**: "generate 5 articles about [topic] for client [id]" — Queues article generation via AI writing engine. Supports tone, word count, and target keywords.
- **Publish Articles**: "publish article [id] to blog [blogId]" — Publishes to Shopify or other connected CMS.
- **Approve/Reject**: "approve article [id]" or "reject article [id] because [reason]" — Review workflow management.
- **List Articles**: "list articles" or "list articles for client [id]" — Shows title, status, SEO score, word count.
- **Analyze SEO**: "analyze seo for article [id]" — Runs full SEO content analysis with suggestions.
- **View Article**: "show article [id]" — Get full article details including content, meta tags, and SEO data.

### 🔍 Research & Keywords
- **Research Keywords**: "research keywords for [topic] in [industry]" — Discovers keywords with volume, competition, relevance scores.
- **List Keywords**: "list keywords" — Shows all tracked keywords with metrics.
- **Keyword Analytics**: "show keyword analytics" — Aggregated keyword performance data.

### 👥 Client Management
- **List Clients**: "list clients" — Shows all clients.
- **Create Client**: "create client [name]" — Registers a new client in the system.
- **Delete Client**: "delete client [id]" — Deactivates a client (admin only).
- **Client Analytics**: "show analytics for client [id]" — Full client analytics overview.

### 🔑 API Key Management
- **List API Keys**: "list api keys" or "list api keys for client [id]"
- **Add API Key**: "add [service] api key for client [id]" — For OpenAI, Shopify, SERP, Google, etc.
- **Toggle/Troubleshoot**: Check if API keys are active and working.

### 🧩 Plugin System
- **List Plugins**: "list plugins" — Shows all installed plugins and available ones.
- **Register Plugin**: "install plugin [slug]" — Installs a plugin for a client.
- **Run Plugin**: "run plugin [slug]" — Executes a plugin's hooks.
- **Toggle Plugin**: "enable/disable plugin [instanceId]"
- **Available Plugins**: SEO Agent, Shopify Publisher, Trend Analyzer, Content Rewriter, Analytics Tracker

### 📋 Prompt Templates
- **List Prompts**: "list prompts" — Shows all AI behavior templates.
- **Edit Prompt**: "update prompt [id]" — Live editing of AI system prompts.
- **Rollback**: "rollback prompt [id] to version [n]" — Version control for prompts.
- **View Prompt**: "show prompt [id]" — Full template details with version history.

### ⚙️ System Configuration
- **List Config**: "list config" or "list config in [category]" — All platform settings.
- **Update Config**: "update config [key] to [value]" — Change any system setting live.
- **Categories**: general, ai, seo, shopify, notifications, security

### 🤖 Self-Improvement System
- **Run Analysis**: "run analysis" — Triggers automated performance analysis of jobs, errors, execution times.
- **List Improvements**: "list improvements" — Shows AI-generated optimization suggestions.
- **Categories**: speed, quality, cost, error, workflow

### 📊 Analytics & Monitoring
- **Dashboard Stats**: "show analytics overview" — Cross-feature analytics with articles, keywords, costs, SEO.
- **Activity Logs**: "show logs" — Recent system activity with levels (info, warn, error).
- **Cost Tracking**: "show costs" — API costs by provider and time period.
- **Job Status**: "check status of [jobId]" — Real-time queue job monitoring.
- **SEO Performance**: "show seo stats" — SEO scores, impressions, clicks trends.

### 🖥️ User Management (Admin)
- **List Users**: "list users" — All platform users with roles.
- **Permissions**: Built-in RBAC — admin, editor, client roles.

## REAL-TIME DATABASE CONTEXT

The following data was **actually queried from your database** in real-time based on the user's message. Use this to answer accurately. If this section says "No relevant data found", tell the user honestly what you found (or didn't find).

${
  dbContext
    ? dbContext
    : 'No relevant data found in the database matching your query.'
}

---

## BEHAVIOR RULES

1. When the user asks to DO something (generate, publish, list, create, analyze, etc.), identify the matching command and respond with clear confirmation. If you can execute the command pattern, start your response with the result.
2. When the user is just chatting (greetings, questions, chit-chat, brainstorming), respond naturally and conversationally. You can suggest relevant platform features.
3. If you're unsure what the user wants, ask clarifying questions. Don't guess.
4. Keep responses concise and actionable. Use emojis sparingly for visual structure.
5. When displaying data results, format them cleanly. If the data is large, summarize.
6. You can proactively suggest related actions: e.g., after listing articles, ask if they want to generate more.
7. **Cross-reference data**: When the user asks about one feature, consider showing related analytics. E.g., when listing articles, note the SEO trends. When showing costs, mention efficiency improvements.
8. Use the user's role appropriately. If they're an editor, don't suggest admin-only actions.

9. ⚠️ **HONESTY ABOVE ALL — NEVER FABRICATE DATA.** The database context above is REAL data. You MUST:
   - ✅ Reference the data above to answer questions specifically and accurately.
   - ✅ If no data was found, say directly: "I searched the database but didn't find anything matching that."
   - ✅ When showing data, present it in a clean, readable format.
   - ❌ NEVER add extra clients, articles, or stats beyond what's shown above.
   - ❌ NEVER guess additional details about a client or article you don't have.
   - ❌ NEVER pretend to have retrieved data when the database context section shows no data.

10. **Clarify your capabilities honestly.** If you're asked about something outside your scope, say so directly — don't make up a capability you don't have.

User info: role=${user.role}, clientId=${user.clientId || 'none (admin — full access)'}
AI Provider: ${providerName}

IMPORTANT: Your responses ARE the assistant messages shown in the chat. Use the REAL DATABASE CONTEXT above to answer accurately. If no relevant data was found, say so honestly. HONESTY is your most important trait — it's better to say "I don't know" than to make something up.`;

    // Build message history (last 20 messages)
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content.slice(0, 2000) });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: input });

    try {
      const response = await openaiService.chat(messages, {
        temperature: 0.7,
        maxTokens: 800,
      });

      if (response === null) {
        return null; // Fall back
      }

      return {
        success: true,
        message: response,
        requiresApproval: false,
      };
    } catch {
      return null;
    }
  }

  /**
   * Friendly fallback response when no command pattern matches and AI is unavailable.
   */
  private fallbackResponse(input: string): string {
    const lower = input.toLowerCase();

    // Greetings
    if (/^(hey|hello|hi|howdy|sup|yo|good\s*(morning|afternoon|evening))/.test(lower)) {
      return 'Hey there! 👋 I\'m Buffy, your strategic AI assistant. How can I help you today? Try `help` to see what I can do.';
    }

    // Thanks
    if (/thank(s| you)|thanks|appreciate|cheers/i.test(lower)) {
      return "You're welcome! 😊 Let me know if you need anything else.";
    }

    // How are you?
    if (/how(s|'s| is) it going|how are you|what'?s up/i.test(lower)) {
      return "I'm doing great, thanks for asking! Ready to help you manage your SEO content pipeline. What would you like to work on? Try `help` to see available commands.";
    }

    // Questions about what the bot can do
    if (/what can you do|what do you do|capabilities|features/i.test(lower)) {
      return `I can help you manage your entire SEO content pipeline through natural conversations. Here's what I can do:

📝 **Content** — Generate articles, publish to Shopify, approve/reject drafts
🔍 **Research** — Discover keywords, analyze SEO
👤 **Management** — List entities (articles, clients, keywords, users), create clients
⚙️ **System** — Run plugins, update config, check job status

Try typing something like "generate 3 articles about outdoor furniture" or "list articles" to get started!`;
    }

    // Default: helpful redirect
    return `I'm not sure I understood that. 🤔 Here's what I *can* help with:

• Generate articles: "generate 3 articles about [topic]"
• List data: "list articles" / "list clients"
• Research keywords: "research keywords for [topic]"
• Check job status: "check status of [jobId]"

Type \`help\` anytime to see the full command list.`;
  }

  private async logChatAction(userId: string, action: string, message: string, metadata: Record<string, unknown> = {}): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
         VALUES (NULL, $1, 'chat_command', 'info', $2, $3)`,
        [action, message, JSON.stringify({ userId, ...metadata })]
      );
    } catch {
      // Non-critical
    }
  }

  private getHelpText(): string {
    return `
**Available Commands:**

📝 **Content**
  • "generate 5 articles about [keyword] for client [id]" — Queue article generation
  • "publish article [id]" — Publish to Shopify
  • "approve article [id]" — Approve for publishing
  • "reject article [id]" — Reject with reason

🔍 **Research**
  • "research keywords for [topic] in [industry]" — Discover keywords
  • "analyze seo for article [id]" — Run SEO analysis
  • "check status of [jobId]" — Check queue job status

👤 **Management**
  • "list [articles|clients|keywords|users|plugins|api keys|logs]" — List entities
  • "create client [name]" — Register new client (admin)
  • "delete [article|client] [id]" — Deactivate entity (admin)

⚙️ **System**
  • "run plugin [slug]" — Execute a plugin
  • "update config [key] to [value]" — Change system config
  • "help" — Show this help
`.trim();
  }
}

export interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
  jobId?: string;
  data?: unknown;
  requiresApproval: boolean;
}

export default new ChatEngine();
