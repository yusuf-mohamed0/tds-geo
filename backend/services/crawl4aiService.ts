// ══════════════════════════════════════════════════════════════════
// Crawl4AI Service
// Orchestrates crawl4ai web scraping for LLM-ready content extraction.
// ══════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

// ─── Types ─────────────────────────────────────

export interface Crawl4aiResult {
  success: boolean;
  url: string;
  title?: string;
  markdown?: string;
  text?: string;
  extracted?: Record<string, unknown>;
  metadata?: Record<string, string>;
  error?: string;
  duration_seconds: number;
  extraction_error?: string;
}

export interface Crawl4aiOptions {
  /** Output format: markdown, json, text, or all (default: markdown) */
  output?: 'markdown' | 'json' | 'text' | 'all';
  /** Scrape timeout in seconds (default: 60) */
  timeout?: number;
  /** LLM extraction query (for structured JSON output) */
  query?: string;
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
}

// ─── Service ────────────────────────────────────

class Crawl4aiService {
  private scriptPath: string = '';

  /**
   * Initialize the service.
   */
  initialize(): void {
    const possiblePaths = [
      path.resolve(__dirname, '../../scripts/crawl4ai-scraper.py'),
      path.resolve(__dirname, '../../../scripts/crawl4ai-scraper.py'),
      '/root/my-project/scripts/crawl4ai-scraper.py',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.scriptPath = p;
        break;
      }
    }

    if (this.scriptPath) {
      logger.info('Crawl4aiService initialized', { scriptPath: this.scriptPath });
    } else {
      logger.warn('Crawl4aiService initialized but bridge script not found');
    }
  }

  /**
   * Check if crawl4ai Python library is available.
   */
  get isAvailable(): boolean {
    if (!this.scriptPath) return false;
    return fs.existsSync(this.scriptPath);
  }

  /**
   * Scrape a URL using crawl4ai.
   */
  async scrapeUrl(url: string, options: Crawl4aiOptions = {}): Promise<Crawl4aiResult> {
    if (!this.scriptPath) {
      return {
        success: false,
        url,
        error: 'Crawl4ai bridge script not found. Run initialize() first.',
        duration_seconds: 0,
      };
    }

    return new Promise((resolve) => {
      const startTime = Date.now();

      const args = [this.scriptPath, url];
      if (options.output) args.push('--output', options.output);
      if (options.timeout) args.push('--timeout', String(options.timeout));
      if (options.query) args.push('-q', options.query);
      if (options.headless !== false) args.push('--headless');

      const pythonProcess = spawn('python', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: (options.timeout || 60) * 1000 + 30000,
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
          logger.debug('Crawl4ai stderr', { stderr: stderr.slice(0, 300) });
        }

        if (code === 0 && stdout) {
          try {
            const lines = stdout.trim().split('\n');
            const lastJson = lines.filter(l => l.startsWith('{')).pop() || stdout;
            const result: Crawl4aiResult = JSON.parse(lastJson);
            logger.info('Crawl4ai scrape completed', {
              success: result.success,
              url,
              durationMs: duration,
            });
            resolve(result);
          } catch (err) {
            resolve({
              success: false,
              url,
              error: `Failed to parse output: ${(err as Error).message}`,
              duration_seconds: duration / 1000,
            });
          }
        } else {
          resolve({
            success: false,
            url,
            error: `Scraper exited with code ${code}: ${stderr.slice(0, 300)}`,
            duration_seconds: duration / 1000,
          });
        }
      });

      pythonProcess.on('error', (err: Error) => {
        resolve({
          success: false,
          url,
          error: `Failed to start scraper: ${err.message}`,
          duration_seconds: (Date.now() - startTime) / 1000,
        });
      });
    });
  }

  /**
   * Clean up resources.
   */
  async close(): Promise<void> {
    logger.info('Crawl4aiService closed');
  }
}

export default new Crawl4aiService();
