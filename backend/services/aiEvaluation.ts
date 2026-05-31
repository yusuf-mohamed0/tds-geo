// ══════════════════════════════════════════════════════════════════
// AI Evaluation Framework
// LLM-as-a-judge evaluation, benchmark datasets, human scoring,
// SEO benchmarking, factual accuracy scoring, A/B testing
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import openaiService from './openai';
import {
  BenchmarkDataset, BenchmarkTestCase,
  EvaluationResult, AbTest
} from '../types';

interface QualityScore {
  overall: number;
  dimensions: {
    factualAccuracy: number;
    seoOptimization: number;
    readability: number;
    engagement: number;
    brandConsistency: number;
    uniqueness: number;
  };
  feedback: string;
}

class AiEvaluationService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('AI Evaluation Framework initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // LLM-AS-A-JUDGE EVALUATION
  // ══════════════════════════════════════════════════════════════

  /**
   * Evaluate content quality using LLM-as-a-judge.
   * This provides multidimensional scoring without human involvement.
   */
  async evaluateContent(
    content: string,
    keyword: string,
    criteria: {
      checkFactualAccuracy?: boolean;
      checkSEO?: boolean;
      checkReadability?: boolean;
      checkEngagement?: boolean;
      checkBrandConsistency?: boolean;
    } = {}
  ): Promise<QualityScore> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are an expert content quality judge. Evaluate the following content for the target keyword "${keyword}".

Score each dimension from 0-100 and provide specific feedback.

Respond with JSON:
{
  "overall": 0-100,
  "dimensions": {
    "factualAccuracy": 0-100,
    "seoOptimization": 0-100,
    "readability": 0-100,
    "engagement": 0-100,
    "brandConsistency": 0-100,
    "uniqueness": 0-100
  },
  "feedback": "detailed feedback on strengths and weaknesses"
}

Be critical and specific. This is production evaluation.`
        },
        {
          role: 'user',
          content: content.slice(0, 8000)
        }
      ], { temperature: 0.2 });

      if (result) {
        const parsed = JSON.parse(result);
        return {
          overall: parsed.overall || 50,
          dimensions: {
            factualAccuracy: parsed.dimensions?.factualAccuracy || 50,
            seoOptimization: parsed.dimensions?.seoOptimization || 50,
            readability: parsed.dimensions?.readability || 50,
            engagement: parsed.dimensions?.engagement || 50,
            brandConsistency: parsed.dimensions?.brandConsistency || 50,
            uniqueness: parsed.dimensions?.uniqueness || 50
          },
          feedback: parsed.feedback || 'No feedback provided'
        };
      }
    } catch (err) {
      logger.warn('LLM-as-a-judge evaluation failed', { error: (err as Error).message });
    }

    return this.fallbackEvaluation(content, keyword);
  }

  private fallbackEvaluation(content: string, keyword: string): QualityScore {
    const words = content.split(/\s+/).length;
    const keywordCount = (content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const seoScore = Math.min(100, keywordCount > 0 ? 60 + Math.min(keywordCount * 5, 30) : 30);
    const readabilityScore = sentences.length > 0
      ? Math.min(100, Math.max(30, Math.round(100 - (words / sentences.length - 10) * 2)))
      : 50;
    const factualAccuracy = 50; // Can't determine without LLM

    return {
      overall: Math.round((seoScore + readabilityScore + factualAccuracy) / 3),
      dimensions: {
        factualAccuracy,
        seoOptimization: seoScore,
        readability: readabilityScore,
        engagement: 50,
        brandConsistency: 50,
        uniqueness: 50
      },
      feedback: 'Fallback evaluation (LLM judge unavailable)'
    };
  }

  // ══════════════════════════════════════════════════════════════
  // BENCHMARK MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async createBenchmark(dataset: Omit<BenchmarkDataset, 'id' | 'created_at'>): Promise<BenchmarkDataset> {
    if (!this.pool) throw new Error('AiEvaluationService not initialized');
    const result = await this.pool.query(
      `INSERT INTO benchmark_datasets (name, description, category, version, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [dataset.name, dataset.description || null, dataset.category, dataset.version || '1.0', JSON.stringify(dataset.metadata || {})]
    );
    return result.rows[0];
  }

  async addTestCase(testCase: Omit<BenchmarkTestCase, 'id' | 'created_at'>): Promise<BenchmarkTestCase> {
    if (!this.pool) throw new Error('AiEvaluationService not initialized');
    const result = await this.pool.query(
      `INSERT INTO benchmark_test_cases (dataset_id, input, expected_output, evaluation_criteria, difficulty)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [testCase.dataset_id, testCase.input, testCase.expected_output || null,
       JSON.stringify(testCase.evaluation_criteria || {}), testCase.difficulty || 'medium']
    );
    return result.rows[0];
  }

  async runBenchmark(datasetId: string): Promise<EvaluationResult[]> {
    if (!this.pool) return [];
    const testCases = await this.pool.query(
      'SELECT * FROM benchmark_test_cases WHERE dataset_id = $1',
      [datasetId]
    );

    const results: EvaluationResult[] = [];
    for (const tc of testCases.rows) {
      try {
        // First, generate a response using the input as a prompt
        const generatedResponse = await openaiService.chat([
          {
            role: 'system',
            content: 'You are being benchmarked. Respond to the user query as accurately and completely as possible.'
          },
          {
            role: 'user',
            content: tc.input
          }
        ], { temperature: 0.7 });

        if (!generatedResponse) {
          logger.warn('Benchmark: generated response was empty', { testCaseId: tc.id });
          continue;
        }

        // Then, evaluate the generated response against the expected output
        const evaluationResult = await openaiService.chat([
          {
            role: 'system',
            content: `You are an expert evaluator. Score the generated response to the given input.

Input: ${tc.input.slice(0, 2000)}
Expected Output: ${tc.expected_output || 'Not specified'}

Score the response on: completeness, accuracy, relevance, and structure.

Respond with JSON: {"score": 0-100, "confidence": 0-1, "feedback": "brief feedback"}`
          },
          {
            role: 'user',
            content: generatedResponse.slice(0, 4000)
          }
        ], { temperature: 0.1 });

        if (evaluationResult) {
          const parsed = JSON.parse(evaluationResult);
          const resultEntry: EvaluationResult = {
            id: '',
            evaluator_type: 'automated',
            target_type: 'article',
            target_id: tc.id,
            criteria: 'benchmark_evaluation',
            score: parsed.score || 50,
            confidence: parsed.confidence || 0.5,
            feedback: parsed.feedback || '',
            metadata: { dataset_id: datasetId, test_case_id: tc.id, generated_response_length: generatedResponse.length },
            created_at: new Date()
          };
          results.push(resultEntry);

          // Store result
          await this.storeEvaluationResult(resultEntry);
        }
      } catch (err) {
        logger.warn('Benchmark test case failed', { testCaseId: tc.id, error: (err as Error).message });
      }
    }

    return results;
  }

  // ══════════════════════════════════════════════════════════════
  // EVALUATION RESULTS STORAGE
  // ══════════════════════════════════════════════════════════════

  async storeEvaluationResult(result: EvaluationResult): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO evaluation_results (evaluator_type, target_type, target_id, criteria, score, confidence, feedback, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [result.evaluator_type, result.target_type, result.target_id, result.criteria,
         result.score, result.confidence || null, result.feedback || null,
         JSON.stringify(result.metadata || {})]
      );
    } catch (err) {
      logger.warn('Failed to store evaluation result', { error: (err as Error).message });
    }
  }

  async getEvaluationHistory(targetType: string, targetId: string): Promise<EvaluationResult[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM evaluation_results WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT 50',
      [targetType, targetId]
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // A/B TESTING
  // ══════════════════════════════════════════════════════════════

  async createAbTest(test: Omit<AbTest, 'id' | 'created_at' | 'status'>): Promise<AbTest> {
    if (!this.pool) throw new Error('AiEvaluationService not initialized');
    const result = await this.pool.query(
      `INSERT INTO ab_tests (client_id, article_base_id, article_variant_id, test_name, status, metrics)
       VALUES ($1, $2, $3, $4, 'running', '{}')
       RETURNING *`,
      [test.client_id, test.article_base_id, test.article_variant_id, test.test_name || null]
    );
    return result.rows[0];
  }

  async completeAbTest(testId: string, winner: string, metrics: Record<string, unknown>): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `UPDATE ab_tests
       SET status = 'completed', end_date = NOW(), winner = $2, metrics = $3
       WHERE id = $1`,
      [testId, winner, JSON.stringify(metrics)]
    );
  }

  // ══════════════════════════════════════════════════════════════
  // COMPREHENSIVE CONTENT QUALITY REPORT
  // ══════════════════════════════════════════════════════════════

  async generateQualityReport(
    content: string,
    keyword: string,
    brandVoiceText?: string
  ): Promise<{
    qualityScore: QualityScore;
    improvementSuggestions: string[];
    estimatedRankingPotential: number;
    actionableSteps: string[];
  }> {
    const qualityScore = await this.evaluateContent(content, keyword);

    // Generate improvement suggestions
    const suggestions: string[] = [];
    const actionableSteps: string[] = [];

    if (qualityScore.dimensions.factualAccuracy < 70) {
      suggestions.push('Factual accuracy needs improvement — add citations and verify claims');
      actionableSteps.push('Run fact-checking pipeline on this content');
    }
    if (qualityScore.dimensions.seoOptimization < 70) {
      suggestions.push('SEO optimization below threshold — improve keyword placement and meta tags');
      actionableSteps.push('Add internal links and optimize heading structure');
    }
    if (qualityScore.dimensions.readability < 60) {
      suggestions.push('Readability score is low — simplify sentences and improve structure');
      actionableSteps.push('Break long paragraphs into shorter sections');
    }
    if (qualityScore.dimensions.engagement < 60) {
      suggestions.push('Content engagement potential is low — add more compelling hooks and examples');
      actionableSteps.push('Add real-world examples and case studies');
    }
    if (qualityScore.dimensions.uniqueness < 60) {
      suggestions.push('Content may not be unique enough — differentiate from competitors');
      actionableSteps.push('Add unique data points, expert quotes, or original insights');
    }

    const rankingPotential = Math.round(
      (qualityScore.dimensions.seoOptimization * 0.4 +
       qualityScore.dimensions.factualAccuracy * 0.2 +
       qualityScore.dimensions.readability * 0.2 +
       qualityScore.dimensions.engagement * 0.2)
    );

    return {
      qualityScore,
      improvementSuggestions: suggestions,
      estimatedRankingPotential: rankingPotential,
      actionableSteps
    };
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default new AiEvaluationService();
