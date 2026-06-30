// ══════════════════════════════════════════════════════════════════
// Quality Assurance Department Manager
// Manages: AI evaluation, fact checking, brand consistency, quality scoring
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';

export class QualityAssuranceManager extends DepartmentManager {
  readonly department: DepartmentName = 'quality_assurance';
  readonly name = 'Quality Assurance Manager';
  readonly description = 'Oversees AI evaluation, fact checking, brand consistency, quality scoring';
  readonly managedQueues: QueueNames[] = [
    QueueNames.FACT_CHECK,
    QueueNames.AI_EVALUATION,
  ];

  /**
   * Note: INTERNAL_LINKING moved to SeoManager (SEO owns linking).
   * QA handles fact-checking and AI evaluation.
   */

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'run_quality_gate': {
        subtasks.push({
          type: 'ai_evaluation',
          queueName: QueueNames.AI_EVALUATION,
          payload: {
            articleId: task.payload.articleId,
            content: task.payload.content,
            keyword: task.payload.keyword,
          },
          priority: 'high',
          timeoutMs: 60000,
        });
        subtasks.push({
          type: 'fact_check',
          queueName: QueueNames.FACT_CHECK,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            content: task.payload.content,
          },
          priority: 'high',
          timeoutMs: 60000,
        });
        parallelGroups.push(['ai_evaluation', 'fact_check']);
        break;
      }

      case 'verify_article': {
        subtasks.push({
          type: 'fact_check',
          queueName: QueueNames.FACT_CHECK,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            content: task.payload.content,
          },
          priority: 'high',
          timeoutMs: 60000,
        });
        parallelGroups.push(['fact_check']);
        break;
      }

      case 'evaluate_content': {
        subtasks.push({
          type: 'ai_evaluation',
          queueName: QueueNames.AI_EVALUATION,
          payload: {
            content: task.payload.content,
            keyword: task.payload.keyword || 'general',
            articleId: task.payload.articleId,
          },
          priority: 'normal',
          timeoutMs: 60000,
        });
        parallelGroups.push(['ai_evaluation']);
        break;
      }

      case 'run_benchmark': {
        subtasks.push({
          type: 'ai_benchmark',
          queueName: QueueNames.AI_EVALUATION,
          payload: {
            benchmark: task.payload.benchmarkId,
          },
          priority: 'low',
          timeoutMs: 300000,
        });
        parallelGroups.push(['ai_benchmark']);
        break;
      }

      case 'full_quality_assessment': {
        subtasks.push({
          type: 'ai_evaluation',
          queueName: QueueNames.AI_EVALUATION,
          payload: {
            articleId: task.payload.articleId,
            content: task.payload.content,
            keyword: task.payload.keyword,
          },
          priority: 'high',
          timeoutMs: 60000,
        });
        subtasks.push({
          type: 'fact_check',
          queueName: QueueNames.FACT_CHECK,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            content: task.payload.content,
          },
          priority: 'high',
          timeoutMs: 60000,
        });

        subtasks.push({
          type: 'internal_linking_check',
          queueName: QueueNames.INTERNAL_LINKING,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            content: task.payload.content,
            title: task.payload.articleTitle,
          },
          dependsOn: ['ai_evaluation'],
          priority: 'normal',
          timeoutMs: 30000,
        });
        parallelGroups.push(['ai_evaluation', 'fact_check']);
        parallelGroups.push(['internal_linking_check']);
        break;
      }

      default: {
        subtasks.push({
          type: 'ai_evaluation',
          queueName: QueueNames.AI_EVALUATION,
          payload: {
            content: task.payload.content || '',
            keyword: task.payload.keyword || 'general',
          },
          priority: task.priority,
          timeoutMs: 60000,
        });
        parallelGroups.push(['ai_evaluation']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }
}

export default new QualityAssuranceManager();
