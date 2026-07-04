// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Infrastructure Department Manager
// Manages: queue health, monitoring, circuit breaker,
// dead-letter queue, observability
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames, addJob } from '../../utils/queue';
import observabilityService from '../../services/observability';

export class InfrastructureManager extends DepartmentManager {
  readonly department: DepartmentName = 'infrastructure';
  readonly name = 'Infrastructure Manager';
  readonly description = 'Oversees queue health, system monitoring, circuit breakers, observability pipeline';
  readonly managedQueues: QueueNames[] = [
    QueueNames.DEFAULT,
    QueueNames.OBSERVABILITY,
  ];

  /**
   * Note: OBSERVABILITY is assigned to Infrastructure (not DataAnalytics)
   * because observability is an infrastructure/monitoring concern.
   * DataAnalytics focuses on keyword research.
   */

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'check_system_health': {
        subtasks.push({
          type: 'observability_health',
          queueName: QueueNames.OBSERVABILITY,
          payload: { action: 'health_check', clientId: task.clientId },
          priority: 'high',
          timeoutMs: 15000,
        });
        parallelGroups.push(['observability_health']);
        break;
      }

      case 'process_dead_letter': {
        subtasks.push({
          type: 'dead_letter_review',
          queueName: QueueNames.DEFAULT,
          payload: {
            originalJobId: task.payload.originalJobId,
            originalQueue: task.payload.originalQueue,
            payload: task.payload.payload,
            error: task.payload.error,
          },
          priority: 'high',
          timeoutMs: 10000,
        });
        parallelGroups.push(['dead_letter_review']);
        break;
      }

      case 'flush_metrics': {
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

      case 'create_alert': {
        subtasks.push({
          type: 'create_system_alert',
          queueName: QueueNames.OBSERVABILITY,
          payload: {
            action: 'create_alert',
            alertName: task.payload.alertName,
            severity: task.payload.severity || 'warning',
            message: task.payload.message,
            details: task.payload.details,
            metricValue: task.payload.metricValue,
            thresholdValue: task.payload.thresholdValue,
          },
          priority: task.payload.severity === 'critical' ? 'critical' : 'high',
          timeoutMs: 10000,
        });
        parallelGroups.push(['create_system_alert']);
        break;
      }

      case 'health_monitor': {
        // Inline: run health check on all services
        subtasks.push({
          type: 'system_health_check',
          queueName: undefined,
          payload: {},
          priority: 'normal',
          timeoutMs: 30000,
        });
        subtasks.push({
          type: 'observability_health',
          queueName: QueueNames.OBSERVABILITY,
          payload: { action: 'health_check' },
          priority: 'normal',
          timeoutMs: 15000,
        });
        parallelGroups.push(['system_health_check', 'observability_health']);
        break;
      }

      default: {
        subtasks.push({
          type: 'dead_letter_review',
          queueName: QueueNames.DEFAULT,
          payload: task.payload,
          priority: task.priority,
          timeoutMs: 30000,
        });
        parallelGroups.push(['dead_letter_review']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }

  protected async runSubtaskInline(subtask: Subtask, _task: DepartmentTask): Promise<Record<string, unknown>> {
    if (subtask.type === 'system_health_check') {
      try {
        const health = await observabilityService.checkSystemHealth();
        return { status: health.status, checks: health.checks };
      } catch (err) {
        return { status: 'unhealthy', error: (err as Error).message };
      }
    }
    return { executed: false };
  }
}

export default new InfrastructureManager();
