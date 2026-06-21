// ══════════════════════════════════════════════════════════════════
// Odoo ERP Integration Department Manager
// Manages: Odoo record sync, model mapping, batch sync, connection
// testing, webhook event processing — the 9th department
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';

export class OdooManager extends DepartmentManager {
  readonly department: DepartmentName = 'odoo';
  readonly name = 'Odoo Integration Manager';
  readonly description = 'Oversees Odoo ERP sync, model mappings, webhook events, batch operations';
  readonly managedQueues: QueueNames[] = [
    QueueNames.ODOO_SYNC,
    QueueNames.ODOO_BATCH_SYNC,
    QueueNames.ODOO_WEBHOOK,
  ];

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'odoo_sync_record': {
        subtasks.push({
          type: 'odoo_sync',
          queueName: QueueNames.ODOO_SYNC,
          payload: {
            connectionId: task.payload.connectionId,
            model: task.payload.model,
            operation: task.payload.operation || 'sync',
            odooRecordId: task.payload.odooRecordId,
            tdsGeoRecordId: task.payload.tdsGeoRecordId,
            data: task.payload.data,
            fieldMappingId: task.payload.fieldMappingId,
          },
          priority: 'high',
          timeoutMs: 60000,
        });
        parallelGroups.push(['odoo_sync']);
        break;
      }

      case 'odoo_batch_sync': {
        subtasks.push({
          type: 'odoo_batch_sync',
          queueName: QueueNames.ODOO_BATCH_SYNC,
          payload: {
            connectionId: task.payload.connectionId,
            model: task.payload.model,
            syncConfigId: task.payload.syncConfigId,
            fullSync: task.payload.fullSync || false,
          },
          priority: 'normal',
          timeoutMs: 300000,
        });
        parallelGroups.push(['odoo_batch_sync']);
        break;
      }

      case 'odoo_full_sync': {
        subtasks.push({
          type: 'odoo_full_sync',
          queueName: QueueNames.ODOO_BATCH_SYNC,
          payload: {
            connectionId: task.payload.connectionId,
            model: task.payload.model,
            fullSync: true,
          },
          priority: 'batch',
          timeoutMs: 600000,
        });
        parallelGroups.push(['odoo_full_sync']);
        break;
      }

      case 'odoo_webhook_event': {
        subtasks.push({
          type: 'odoo_webhook',
          queueName: QueueNames.ODOO_WEBHOOK,
          payload: {
            connectionId: task.payload.connectionId,
            model: task.payload.model,
            operation: task.payload.operation,
            recordId: task.payload.recordId,
            data: task.payload.data,
          },
          priority: 'high',
          timeoutMs: 30000,
        });
        parallelGroups.push(['odoo_webhook']);
        break;
      }

      case 'odoo_connection_test': {
        subtasks.push({
          type: 'odoo_connection_test',
          queueName: QueueNames.ODOO_SYNC,
          payload: {
            connectionId: task.payload.connectionId,
            baseUrl: task.payload.baseUrl,
            database: task.payload.database,
            username: task.payload.username,
            apiKey: task.payload.apiKey,
          },
          priority: 'high',
          timeoutMs: 30000,
        });
        parallelGroups.push(['odoo_connection_test']);
        break;
      }

      case 'odoo_map_entities': {
        // Map multiple Odoo models to TDS Geo entities in parallel
        if (task.payload.mappings && Array.isArray(task.payload.mappings)) {
          for (const mapping of task.payload.mappings as Array<Record<string, unknown>>) {
            subtasks.push({
              type: 'odoo_sync',
              queueName: QueueNames.ODOO_SYNC,
              payload: {
                connectionId: mapping.connectionId || task.payload.connectionId,
                model: mapping.model,
                operation: 'sync',
                fieldMappingId: mapping.fieldMappingId,
                data: mapping.data,
              },
              priority: 'normal',
              timeoutMs: 60000,
            });
          }
          parallelGroups.push(
            (task.payload.mappings as Array<Record<string, unknown>>).map(
              (_, i) => subtasks[i]?.type || 'odoo_sync'
            )
          );
        }
        break;
      }

      case 'odoo_read_model': {
        subtasks.push({
          type: 'odoo_sync',
          queueName: QueueNames.ODOO_SYNC,
          payload: {
            connectionId: task.payload.connectionId,
            model: task.payload.model,
            operation: 'read',
            domain: task.payload.domain || [],
            fields: task.payload.fields || [],
            options: {
              offset: task.payload.offset || 0,
              limit: task.payload.limit || 100,
              order: task.payload.order || 'id DESC',
            },
          },
          priority: task.priority,
          timeoutMs: 60000,
        });
        parallelGroups.push(['odoo_sync']);
        break;
      }

      default: {
        // Default: try a generic sync for the specified model
        subtasks.push({
          type: 'odoo_sync',
          queueName: QueueNames.ODOO_SYNC,
          payload: {
            connectionId: task.payload.connectionId,
            model: task.payload.model || 'res.partner',
            operation: 'read',
          },
          priority: task.priority,
          timeoutMs: 30000,
        });
        parallelGroups.push(['odoo_sync']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }
}

export default new OdooManager();
