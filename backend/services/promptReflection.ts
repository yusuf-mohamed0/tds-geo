import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import resilience from './circuitBreaker';
import openaiService from './openai';
import type { EvaluationResult } from './articleEvaluator';

const PROMPTS_DIR = path.resolve(__dirname, '..');

interface ReflectionResult {
  improvedPrompt: string;
  changes: string[];
  targetArea: string;
}

class PromptReflection {
  /**
   * GEPA-style reflection: given a low-scoring evaluation and the current prompt,
   * generate an improved version of the prompt targeting the weakest dimensions.
   */
  async reflect(
    currentPrompt: string,
    evaluation: EvaluationResult,
    keyword: string
  ): Promise<ReflectionResult> {
    const weakestDimensions = Object.entries(evaluation.dimensions)
      .sort(([, a], [, b]) => a.score - b.score)
      .slice(0, 3)
      .map(([name, data]) => `- ${name} (${data.score}/100): ${data.issues.join('; ')}`);

    const systemPrompt = `You are a prompt engineering optimization system implementing GEPA (Generative Experience-based Prompt Adaptation).

Given:
1. A current system prompt used for AI article generation
2. An evaluation of a generated article scoring 6 quality dimensions
3. The keyword/topic that was generated

Analyze WHY the weak dimensions scored low, then produce an IMPROVED version of the prompt that specifically addresses those weaknesses.

Return valid JSON:
{
  "improvedPrompt": "The full improved prompt text — only the parts that changed, with markers where unchanged sections remain",
  "changes": ["Specific change 1", "Specific change 2"],
  "targetArea": "The primary dimension this improvement targets"
}`;

    const userPrompt = `Keyword/Article Topic: "${keyword}"

Evaluation Results:
- Overall Score: ${evaluation.overallScore}/100
- Summary: ${evaluation.summary}

Weakest Dimensions (target for improvement):
${weakestDimensions.join('\n')}

All Dimensions:
${Object.entries(evaluation.dimensions).map(([name, data]) =>
  `  ${name}: ${data.score}/100 — ${data.issues.join('; ')}`
).join('\n')}

Current System Prompt (first 2000 chars):
${currentPrompt.slice(0, 2000)}

Generate an improved version of the prompt that addresses these weaknesses. Focus on structural changes, not just wording.`;

    try {
      const response = await resilience.getCircuitBreaker().call(
        'openai-prompt-reflection',
        async () => {
          return openaiService.getClient()!.chat.completions.create({
            model: openaiService.defaultModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.4,
            response_format: { type: 'json_object' }
          });
        },
        async () => {
          logger.warn('Prompt reflection circuit open');
          return null;
        }
      );

      const content = response?.choices?.[0]?.message?.content;
      if (!content) {
        return { improvedPrompt: currentPrompt, changes: [], targetArea: 'none' };
      }

      const result = JSON.parse(content) as ReflectionResult;
      logger.info('Prompt reflection complete', {
        targetArea: result.targetArea,
        changes: result.changes.length,
      });

      return result;
    } catch (err) {
      logger.warn('Prompt reflection failed', { error: (err as Error).message });
      return { improvedPrompt: currentPrompt, changes: [], targetArea: 'none' };
    }
  }

  /**
   * Apply the improved prompt to the writing-system-prompt.md file.
   * Creates a backup of the current prompt first.
   */
  applyImprovement(result: ReflectionResult): boolean {
    try {
      const promptPath = path.join(PROMPTS_DIR, 'writing-system-prompt.md');
      const backupPath = path.join(PROMPTS_DIR, `writing-system-prompt.md.bak.${Date.now()}`);

      if (!fs.existsSync(promptPath)) {
        logger.error('Prompt file not found', { path: promptPath });
        return false;
      }

      // Backup current prompt
      fs.copyFileSync(promptPath, backupPath);
      logger.info('Backup created', { backup: backupPath });

      // Apply improvement
      fs.writeFileSync(promptPath, result.improvedPrompt, 'utf-8');
      logger.info('Prompt updated from reflection', {
        target: result.targetArea,
        changes: result.changes,
      });

      return true;
    } catch (err) {
      logger.error('Failed to apply prompt improvement', { error: (err as Error).message });
      return false;
    }
  }

  /**
   * Full GEPA cycle: evaluate → reflect → apply
   */
  async runFullCycle(
    pool: any,
    articleId: string,
    clientId: string,
    article: { title: string; content: string; metaDescription?: string },
    keyword: string
  ): Promise<{ evaluation: EvaluationResult; reflection: ReflectionResult | null; applied: boolean }> {
    const { default: articleEvaluator } = await import('./articleEvaluator');
    const evaluation = await articleEvaluator.evaluate(article, keyword);

    // Store evaluation
    try {
      await pool.query(
        `INSERT INTO article_evaluations (article_id, client_id, overall_score, dimensions, summary, evaluated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [articleId, clientId, evaluation.overallScore, JSON.stringify(evaluation.dimensions), evaluation.summary]
      );
    } catch { /* best effort */ }

    // Only reflect if score is low
    if (evaluation.overallScore >= 70) {
      return { evaluation, reflection: null, applied: false };
    }

    const promptPath = path.join(PROMPTS_DIR, 'writing-system-prompt.md');
    const currentPrompt = fs.readFileSync(promptPath, 'utf-8');

    const reflection = await this.reflect(currentPrompt, evaluation, keyword);
    const applied = this.applyImprovement(reflection);

    return { evaluation, reflection, applied };
  }
}

export default new PromptReflection();
