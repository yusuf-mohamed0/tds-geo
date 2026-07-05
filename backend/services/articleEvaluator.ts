import { logger } from '../utils/logger';
import resilience from './circuitBreaker';
import openaiService from './openai';

export interface EvaluationResult {
  overallScore: number;
  dimensions: {
    geoReadiness: { score: number; issues: string[] };
    eeat: { score: number; issues: string[] };
    entityConsistency: { score: number; issues: string[] };
    statisticalPrecision: { score: number; issues: string[] };
    answerCapsuleQuality: { score: number; issues: string[] };
    structure: { score: number; issues: string[] };
  };
  summary: string;
}

class ArticleEvaluator {
  async evaluate(
    article: { title: string; content: string; metaDescription?: string },
    keyword: string
  ): Promise<EvaluationResult> {
    const systemPrompt = `You are an expert content quality evaluator. Score the given article on 6 dimensions, 0-100 each.

Dimensions:
1. **GEO Readiness** — Are H2s independently quotable? Do they start with definitions? Are answer capsules present? Are FAQ sections structured as question/answer pairs?
2. **EEAT** — Does it demonstrate Experience (specific stories), Expertise (technical depth), Authoritativeness (named sources), Trustworthiness (specific numbers)?
3. **Entity Consistency** — Is one term used per concept throughout? No synonym switching? Are related entities explicitly named?
4. **Statistical Precision** — Are statistics sourced with institution/year/sample? No fabricated numbers? Are claims verifiable?
5. **Answer Capsule Quality** — Does the first sentence of each H2 work as a standalone answer? Can AI extract it independently?
6. **Structure** — Is the H2 hierarchy logical? Are sections depth-layered (surface → detail → expert)? Is the FAQ at the end?

Return valid JSON:
{
  "overallScore": number 0-100,
  "dimensions": {
    "geoReadiness": { "score": number, "issues": [string] },
    "eeat": { "score": number, "issues": [string] },
    "entityConsistency": { "score": number, "issues": [string] },
    "statisticalPrecision": { "score": number, "issues": [string] },
    "answerCapsuleQuality": { "score": number, "issues": [string] },
    "structure": { "score": number, "issues": [string] }
  },
  "summary": "2-3 sentence overall assessment"
}`;

    const userPrompt = `Evaluate this article for target keyword: "${keyword}"

Title: ${article.title}
Meta Description: ${article.metaDescription || '(none)'}

Content:
${article.content.slice(0, 8000)}`;

    try {
      const response = await resilience.getCircuitBreaker().call(
        'openai-evaluate-article',
        async () => {
          return openaiService.getClient()!.chat.completions.create({
            model: openaiService.defaultModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 1000,
            temperature: 0.2,
            response_format: { type: 'json_object' }
          });
        },
        async () => {
          logger.warn('Article evaluation circuit open — returning fallback score');
          return null;
        }
      );

      const content = response?.choices?.[0]?.message?.content;
      if (!content) return this.fallbackEvaluation();

      const result = JSON.parse(content) as EvaluationResult;
      logger.info('Article evaluated', {
        keyword,
        overallScore: result.overallScore,
        dimensions: Object.entries(result.dimensions).map(([k, v]) => `${k}:${v.score}`).join(', '),
      });

      return result;
    } catch (err) {
      logger.warn('Article evaluation failed', { keyword, error: (err as Error).message });
      return this.fallbackEvaluation();
    }
  }

  async evaluateAndStore(
    pool: any,
    articleId: string,
    clientId: string,
    article: { title: string; content: string; metaDescription?: string },
    keyword: string
  ): Promise<EvaluationResult> {
    const result = await this.evaluate(article, keyword);

    try {
      await pool.query(
        `INSERT INTO article_evaluations (article_id, client_id, overall_score, dimensions, summary, evaluated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (article_id) DO UPDATE SET
           overall_score = EXCLUDED.overall_score,
           dimensions = EXCLUDED.dimensions,
           summary = EXCLUDED.summary,
           evaluated_at = NOW()`,
        [
          articleId,
          clientId,
          result.overallScore,
          JSON.stringify(result.dimensions),
          result.summary,
        ]
      );
    } catch (err) {
      logger.warn('Failed to store evaluation', { articleId, error: (err as Error).message });
    }

    return result;
  }

  private fallbackEvaluation(): EvaluationResult {
    return {
      overallScore: 0,
      dimensions: {
        geoReadiness: { score: 0, issues: ['Evaluation service unavailable'] },
        eeat: { score: 0, issues: ['Evaluation service unavailable'] },
        entityConsistency: { score: 0, issues: ['Evaluation service unavailable'] },
        statisticalPrecision: { score: 0, issues: ['Evaluation service unavailable'] },
        answerCapsuleQuality: { score: 0, issues: ['Evaluation service unavailable'] },
        structure: { score: 0, issues: ['Evaluation service unavailable'] },
      },
      summary: 'Evaluation failed — circuit breaker open or API error',
    };
  }
}

export default new ArticleEvaluator();
