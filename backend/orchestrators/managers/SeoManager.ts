// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// SEO Department Manager
// Manages: SEO analysis, SEO intelligence, content intelligence,
// internal linking
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';

export class SeoManager extends DepartmentManager {
  readonly department: DepartmentName = 'seo';
  readonly name = 'SEO Manager';
  readonly description = 'Oversees SEO analysis, SERP intelligence, content intelligence, and internal linking';
  readonly managedQueues: QueueNames[] = [
    QueueNames.SEO_ANALYSIS,
    QueueNames.SEO_INTELLIGENCE,
    QueueNames.CONTENT_INTELLIGENCE,
    QueueNames.INTERNAL_LINKING,
  ];

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'analyze_seo': {
        subtasks.push({
          type: 'seo_analysis',
          queueName: QueueNames.SEO_ANALYSIS,
          payload: {
            articleId: task.payload.articleId,
            content: task.payload.content,
            keyword: task.payload.keyword,
          },
          priority: 'high',
          timeoutMs: 30000,
        });
        subtasks.push({
          type: 'seo_intelligence',
          queueName: QueueNames.SEO_INTELLIGENCE,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            content: task.payload.content,
            keyword: task.payload.keyword,
            analysisType: 'serp_analysis',
          },
          priority: 'high',
          timeoutMs: 30000,
        });
        parallelGroups.push(['seo_analysis', 'seo_intelligence']);
        break;
      }

      case 'optimize_content': {
        subtasks.push({
          type: 'seo_analysis',
          queueName: QueueNames.SEO_ANALYSIS,
          payload: {
            articleId: task.payload.articleId,
            content: task.payload.content,
            keyword: task.payload.keyword,
          },
          priority: 'high',
          timeoutMs: 30000,
        });

        subtasks.push({
          type: 'entity_extraction',
          queueName: QueueNames.SEO_INTELLIGENCE,
          payload: {
            clientId: task.clientId,
            content: task.payload.content,
            keyword: task.payload.keyword,
            analysisType: 'entity_extraction',
          },
          dependsOn: ['seo_analysis'],
          priority: 'normal',
          timeoutMs: 20000,
        });

        subtasks.push({
          type: 'content_gap_analysis',
          queueName: QueueNames.SEO_INTELLIGENCE,
          payload: {
            clientId: task.clientId,
            keyword: task.payload.keyword,
            analysisType: 'content_gap',
          },
          dependsOn: ['seo_analysis'],
          priority: 'normal',
          timeoutMs: 20000,
        });

        parallelGroups.push(['seo_analysis']);
        parallelGroups.push(['entity_extraction', 'content_gap_analysis']);
        break;
      }

      case 'internal_linking': {
        subtasks.push({
          type: 'internal_linking',
          queueName: QueueNames.INTERNAL_LINKING,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            content: task.payload.content,
            title: task.payload.title,
          },
          priority: 'normal',
          timeoutMs: 30000,
        });

        subtasks.push({
          type: 'cannibalization_check',
          queueName: QueueNames.CONTENT_INTELLIGENCE,
          payload: {
            articleId: task.payload.articleId || '',
            clientId: task.clientId,
            content: task.payload.content,
            title: task.payload.title,
            analysisType: 'cannibalization',
          },
          priority: 'normal',
          timeoutMs: 20000,
        });

        parallelGroups.push(['internal_linking', 'cannibalization_check']);
        break;
      }

      case 'analyze_serp': {
        subtasks.push({
          type: 'serp_analysis',
          queueName: QueueNames.SEO_INTELLIGENCE,
          payload: {
            keyword: task.payload.keyword,
            analysisType: 'serp_analysis',
          },
          priority: 'high',
          timeoutMs: 30000,
        });
        parallelGroups.push(['serp_analysis']);
        break;
      }

      case 'content_intelligence': {
        subtasks.push({
          type: 'content_intelligence_run',
          queueName: QueueNames.CONTENT_INTELLIGENCE,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            content: task.payload.content,
            title: task.payload.title,
            analysisType: task.payload.analysisType || 'cannibalization',
          },
          priority: 'normal',
          timeoutMs: 30000,
        });
        parallelGroups.push(['content_intelligence_run']);
        break;
      }

      default: {
        subtasks.push({
          type: 'seo_analysis',
          queueName: QueueNames.SEO_ANALYSIS,
          payload: {
            content: task.payload.content || '',
            keyword: task.payload.keyword || 'general',
          },
          priority: task.priority,
          timeoutMs: 30000,
        });
        parallelGroups.push(['seo_analysis']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }
}

export default new SeoManager();
