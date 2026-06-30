// ══════════════════════════════════════════════════════════════════
// Client Operations Department Manager
// Manages: client website scanning, editorial workflow, scheduling
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';

export class ClientOperationsManager extends DepartmentManager {
  readonly department: DepartmentName = 'client_operations';
  readonly name = 'Client Operations Manager';
  readonly description = 'Oversees client website scanning, editorial workflow, scheduling';
  readonly managedQueues: QueueNames[] = [
    QueueNames.CLIENT_SCAN,
    QueueNames.BATCH_CLIENT_SCAN,
    QueueNames.EDITORIAL_WORKFLOW,
  ];

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'scan_client_website': {
        subtasks.push({
          type: 'client_scan',
          queueName: QueueNames.CLIENT_SCAN,
          payload: {
            clientId: task.clientId,
            url: task.payload.url,
            force: task.payload.force,
          },
          priority: 'high',
          timeoutMs: 120000,
        });
        parallelGroups.push(['client_scan']);
        break;
      }

      case 'scan_all_clients': {
        subtasks.push({
          type: 'batch_client_scan',
          queueName: QueueNames.BATCH_CLIENT_SCAN,
          payload: { force: task.payload.force },
          priority: 'batch',
          timeoutMs: 300000,
        });
        parallelGroups.push(['batch_client_scan']);
        break;
      }

      case 'submit_for_review': {
        subtasks.push({
          type: 'editorial_submit',
          queueName: QueueNames.EDITORIAL_WORKFLOW,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            action: 'submit_for_review',
            reviewType: task.payload.reviewType || 'editor_review',
            reviewerId: task.payload.reviewerId,
          },
          priority: 'high',
          timeoutMs: 30000,
        });
        parallelGroups.push(['editorial_submit']);
        break;
      }

      case 'approve_article': {
        subtasks.push({
          type: 'editorial_approve',
          queueName: QueueNames.EDITORIAL_WORKFLOW,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            action: 'approve',
            reviewerId: task.payload.reviewerId,
            comment: task.payload.comment,
            reviewType: task.payload.reviewType || 'final_approval',
          },
          priority: 'high',
          timeoutMs: 30000,
        });
        parallelGroups.push(['editorial_approve']);
        break;
      }

      case 'reject_article': {
        subtasks.push({
          type: 'editorial_reject',
          queueName: QueueNames.EDITORIAL_WORKFLOW,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            action: 'reject',
            reviewerId: task.payload.reviewerId,
            comment: task.payload.comment || 'Revision requested',
            reviewType: task.payload.reviewType || 'editor_review',
          },
          priority: 'normal',
          timeoutMs: 30000,
        });
        parallelGroups.push(['editorial_reject']);
        break;
      }

      case 'process_client_intelligence': {
        subtasks.push({
          type: 'client_scan',
          queueName: QueueNames.CLIENT_SCAN,
          payload: {
            clientId: task.clientId,
            url: task.payload.url,
            force: true,
          },
          priority: 'normal',
          timeoutMs: 120000,
        });

        subtasks.push({
          type: 'editorial_submit',
          queueName: QueueNames.EDITORIAL_WORKFLOW,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            action: 'submit_for_review',
            reviewType: 'seo_review',
          },
          priority: 'low',
          timeoutMs: 30000,
        });

        parallelGroups.push(['client_scan', 'editorial_submit']);
        break;
      }

      default: {
        subtasks.push({
          type: 'client_scan',
          queueName: QueueNames.CLIENT_SCAN,
          payload: { clientId: task.clientId, url: task.payload.url },
          priority: task.priority,
          timeoutMs: 60000,
        });
        parallelGroups.push(['client_scan']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }
}

export default new ClientOperationsManager();
