// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Cost Optimization Department Manager
// Manages: cost tracking, budget management, model routing
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';

export class CostOptimizationManager extends DepartmentManager {
  readonly department: DepartmentName = 'cost_optimization';
  readonly name = 'Cost Optimization Manager';
  readonly description = 'Oversees AI cost tracking, budget management, model routing, cost reporting';
  readonly managedQueues: QueueNames[] = [
    QueueNames.COST_OPTIMIZATION,
  ];

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'route_task': {
        subtasks.push({
          type: 'cost_route',
          queueName: QueueNames.COST_OPTIMIZATION,
          payload: {
            clientId: task.clientId,
            taskType: task.payload.taskType,
            estimatedTokens: task.payload.estimatedTokens,
            requiredQuality: task.payload.requiredQuality || 'standard',
            requiresReasoning: task.payload.requiresReasoning,
            estimatedComplexity: task.payload.estimatedComplexity,
          },
          priority: 'high',
          timeoutMs: 10000,
        });
        parallelGroups.push(['cost_route']);
        break;
      }

      case 'generate_cost_report': {
        subtasks.push({
          type: 'cost_report',
          queueName: QueueNames.COST_OPTIMIZATION,
          payload: {
            clientId: task.clientId,
            days: task.payload.days || 30,
            action: 'generate_report',
          },
          priority: 'normal',
          timeoutMs: 15000,
        });
        parallelGroups.push(['cost_report']);
        break;
      }

      case 'check_budget': {
        subtasks.push({
          type: 'cost_check_budget',
          queueName: QueueNames.COST_OPTIMIZATION,
          payload: {
            clientId: task.clientId,
            estimatedTokens: task.payload.estimatedTokens || 1000,
          },
          priority: 'high',
          timeoutMs: 10000,
        });
        parallelGroups.push(['cost_check_budget']);
        break;
      }

      case 'optimize_model_routing': {
        subtasks.push({
          type: 'cost_route',
          queueName: QueueNames.COST_OPTIMIZATION,
          payload: {
            clientId: task.clientId,
            taskType: task.payload.taskType,
            estimatedTokens: task.payload.estimatedTokens,
            requiredQuality: 'premium',
            estimatedComplexity: task.payload.estimatedComplexity || 3,
          },
          priority: 'normal',
          timeoutMs: 10000,
        });
        subtasks.push({
          type: 'cost_report',
          queueName: QueueNames.COST_OPTIMIZATION,
          payload: {
            clientId: task.clientId,
            days: 7,
            action: 'generate_report',
          },
          priority: 'normal',
          timeoutMs: 15000,
        });
        parallelGroups.push(['cost_route', 'cost_report']);
        break;
      }

      default: {
        subtasks.push({
          type: 'cost_report',
          queueName: QueueNames.COST_OPTIMIZATION,
          payload: {
            clientId: task.clientId,
            days: task.payload.days || 30,
            action: 'generate_report',
          },
          priority: task.priority,
          timeoutMs: 15000,
        });
        parallelGroups.push(['cost_report']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }
}

export default new CostOptimizationManager();
