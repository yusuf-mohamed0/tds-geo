// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Data & Analytics Department Manager
// Manages: keyword research, observability metrics, reporting
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';

export class DataAnalyticsManager extends DepartmentManager {
  readonly department: DepartmentName = 'data_analytics';
  readonly name = 'Data & Analytics Manager';
  readonly description = 'Oversees keyword research, observability metrics, analytics reporting';
  readonly managedQueues: QueueNames[] = [
    QueueNames.KEYWORD_RESEARCH,
    QueueNames.OBSERVABILITY,
  ];

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'research_keywords': {
        subtasks.push({
          type: 'keyword_research',
          queueName: QueueNames.KEYWORD_RESEARCH,
          payload: {
            clientId: task.clientId,
            seedKeywords: task.payload.seedKeywords || [task.payload.keyword],
            industry: task.payload.industry,
          },
          priority: 'high',
          timeoutMs: 120000,
        });
        parallelGroups.push(['keyword_research']);
        break;
      }

      case 'collect_metrics': {
        subtasks.push({
          type: 'observability_metrics',
          queueName: QueueNames.OBSERVABILITY,
          payload: {
            action: 'collect_metrics',
            clientId: task.clientId,
            period: task.payload.period || '24h',
          },
          priority: 'low',
          timeoutMs: 30000,
        });
        parallelGroups.push(['observability_metrics']);
        break;
      }

      case 'flush_observability': {
        subtasks.push({
          type: 'observability_flush',
          queueName: QueueNames.OBSERVABILITY,
          payload: { action: 'flush' },
          priority: 'low',
          timeoutMs: 10000,
        });
        parallelGroups.push(['observability_flush']);
        break;
      }

      case 'generate_report': {
        subtasks.push({
          type: 'keyword_research',
          queueName: QueueNames.KEYWORD_RESEARCH,
          payload: {
            clientId: task.clientId,
            seedKeywords: task.payload.seedKeywords || ['trending'],
            industry: task.payload.industry,
          },
          priority: 'normal',
          timeoutMs: 120000,
        });

        subtasks.push({
          type: 'observability_metrics',
          queueName: QueueNames.OBSERVABILITY,
          payload: {
            action: 'dashboard',
            clientId: task.clientId,
          },
          priority: 'normal',
          timeoutMs: 15000,
        });

        parallelGroups.push(['keyword_research', 'observability_metrics']);
        break;
      }

      default: {
        subtasks.push({
          type: 'keyword_research',
          queueName: QueueNames.KEYWORD_RESEARCH,
          payload: {
            clientId: task.clientId,
            seedKeywords: task.payload.seedKeywords || [task.payload.keyword || 'general'],
          },
          priority: task.priority,
          timeoutMs: 60000,
        });
        parallelGroups.push(['keyword_research']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }
}

export default new DataAnalyticsManager();
