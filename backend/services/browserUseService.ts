// ══════════════════════════════════════════════════════════════════
// Browser Use Service
// Orchestrates browser-use AI agents for autonomous browser
// automation tasks (form filling, data extraction, navigation, etc.)
// ══════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

// ─── Types ─────────────────────────────────────

export interface BrowserUseResult {
  success: boolean;
  task: string;
  result?: string;
  error?: string;
  duration_seconds: number;
  model_used: string;
  steps?: number;
}

export interface BrowserUseOptions {
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
  /** Agent timeout in seconds (default: 120) */
  timeout?: number;
  /** LLM model to use */
  model?: string;
  /** LLM API key (defaults to BROWSER_USE_API_KEY env) */
  llmApiKey?: string;
}

// ─── Service ────────────────────────────────────

class BrowserUseService {
  private scriptPath: string = '';

  /**
   * Initialize the service.
   */
  initialize(): void {
    // Resolve path to the Python bridge script
    const possiblePaths = [
      path.resolve(__dirname, '../../scripts/browser-use-agent.py'),
      path.resolve(__dirname, '../../../scripts/browser-use-agent.py'),
      '/root/my-project/scripts/browser-use-agent.py',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.scriptPath = p;
        break;
      }
    }

    if (this.scriptPath) {
      logger.info('BrowserUseService initialized', { scriptPath: this.scriptPath });
    } else {
      logger.warn('BrowserUseService initialized but bridge script not found');
    }
  }

  /**
   * Check if browser-use Python library is available.
   */
  get isAvailable(): boolean {
    if (!this.scriptPath) return false;
    return fs.existsSync(this.scriptPath);
  }

  /**
   * Clean up resources (no-op for now, kept for graceful shutdown pattern).
   */
  async close(): Promise<void> {
    logger.info('BrowserUseService closed');
  }

  /**
   * Run a browser-use agent task.
   *
   * Spawns the Python bridge script and returns the parsed JSON result.
   *
   * @param task The natural language task for the agent
   * @param options Optional configuration
   */
  async runAgent(task: string, options: BrowserUseOptions = {}): Promise<BrowserUseResult> {
    if (!this.scriptPath) {
      return {
        success: false,
        task,
        error: 'Browser-use bridge script not found. Run initialize() first.',
        duration_seconds: 0,
        model_used: options.model || 'browser-use',
      };
    }

    return new Promise((resolve) => {
      const startTime = Date.now();

      const args = [this.scriptPath, task];
      if (options.headless !== false) args.push('--headless');
      if (options.timeout) args.push('--timeout', String(options.timeout));
      if (options.model) args.push('--model', options.model);
      if (options.llmApiKey) args.push('--llm-api-key', options.llmApiKey);

      const pythonProcess = spawn('python', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: (options.timeout || 120) * 1000 + 30000, // extra 30s buffer
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code: number | null) => {
        const duration = Date.now() - startTime;

        if (stderr) {
          logger.debug('Browser-use stderr', { stderr: stderr.slice(0, 500) });
        }

        if (code === 0 && stdout) {
          try {
            // Parse the last JSON line from stdout
            const lines = stdout.trim().split('\n');
            const lastJson = lines.filter(l => l.startsWith('{')).pop() || stdout;
            const result: BrowserUseResult = JSON.parse(lastJson);
            logger.info('Browser-use agent completed', {
              success: result.success,
              task: task.slice(0, 80),
              durationMs: duration,
              agentDuration: result.duration_seconds,
            });
            resolve(result);
          } catch (err) {
            logger.error('Failed to parse browser-use output', {
              error: (err as Error).message,
              stdout: stdout.slice(0, 300),
            });
            resolve({
              success: false,
              task,
              error: `Failed to parse agent output: ${(err as Error).message}`,
              duration_seconds: duration / 1000,
              model_used: options.model || 'browser-use',
            });
          }
        } else {
          resolve({
            success: false,
            task,
            error: `Agent exited with code ${code}: ${stderr.slice(0, 300)}`,
            duration_seconds: duration / 1000,
            model_used: options.model || 'browser-use',
          });
        }
      });

      pythonProcess.on('error', (err: Error) => {
        resolve({
          success: false,
          task,
          error: `Failed to start agent: ${err.message}`,
          duration_seconds: (Date.now() - startTime) / 1000,
          model_used: options.model || 'browser-use',
        });
      });
    });
  }
}

export default new BrowserUseService();
