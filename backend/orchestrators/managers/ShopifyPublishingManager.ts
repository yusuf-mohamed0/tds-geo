// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';

export class ShopifyPublishingManager extends DepartmentManager {
  readonly department: DepartmentName = 'shopify_publishing';
  readonly name = 'Shopify Publishing Manager';
  readonly description = 'Oversees article publishing to Shopify and other CMS platforms, webhook delivery';
  readonly managedQueues: QueueNames[] = [
    QueueNames.SHOPIFY_PUBLISH,
    QueueNames.MULTI_CMS_PUBLISH,
    QueueNames.WEBHOOK_DELIVERY,
  ];

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'publish_article': {
        subtasks.push({
          type: 'shopify_publish',
          queueName: QueueNames.SHOPIFY_PUBLISH,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            blogId: task.payload.blogId,
            scheduleAt: task.payload.scheduleAt,
          },
          priority: 'high',
          timeoutMs: 60000,
        });
        parallelGroups.push(['shopify_publish']);

        subtasks.push({
          type: 'webhook_notification',
          queueName: QueueNames.WEBHOOK_DELIVERY,
          payload: {
            event: 'article.published',
            clientId: task.clientId,
            payload: {
              articleId: task.payload.articleId,
              title: task.payload.articleTitle,
              url: task.payload.publishUrl,
            },
          },
          dependsOn: ['shopify_publish'],
          priority: 'low',
          timeoutMs: 15000,
        });
        parallelGroups.push(['webhook_notification']);
        break;
      }

      case 'publish_multi_cms': {
        subtasks.push({
          type: 'multi_cms_publish',
          queueName: QueueNames.MULTI_CMS_PUBLISH,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            provider: task.payload.provider,
            scheduleAt: task.payload.scheduleAt,
          },
          priority: 'high',
          timeoutMs: 60000,
        });
        parallelGroups.push(['multi_cms_publish']);

        subtasks.push({
          type: 'webhook_notification',
          queueName: QueueNames.WEBHOOK_DELIVERY,
          payload: {
            event: 'article.published',
            clientId: task.clientId,
            payload: {
              articleId: task.payload.articleId,
              provider: task.payload.provider,
            },
          },
          dependsOn: ['multi_cms_publish'],
          priority: 'low',
          timeoutMs: 15000,
        });
        parallelGroups.push(['webhook_notification']);
        break;
      }

      case 'schedule_publish': {
        subtasks.push({
          type: 'multi_cms_publish',
          queueName: QueueNames.MULTI_CMS_PUBLISH,
          payload: {
            articleId: task.payload.articleId,
            clientId: task.clientId,
            provider: task.payload.provider,
            scheduleAt: task.payload.scheduleAt,
          },
          priority: 'normal',
          timeoutMs: 60000,
        });
        parallelGroups.push(['multi_cms_publish']);
        break;
      }

      case 'send_webhook': {
        subtasks.push({
          type: 'webhook_delivery',
          queueName: QueueNames.WEBHOOK_DELIVERY,
          payload: {
            event: task.payload.event,
            clientId: task.clientId,
            payload: task.payload.data || {},
          },
          priority: task.priority,
          timeoutMs: 15000,
        });
        parallelGroups.push(['webhook_delivery']);
        break;
      }

      default: {
        subtasks.push({
          type: 'shopify_publish',
          queueName: QueueNames.SHOPIFY_PUBLISH,
          payload: { articleId: task.payload.articleId, clientId: task.clientId },
          priority: task.priority,
          timeoutMs: 60000,
        });
        parallelGroups.push(['shopify_publish']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }
}

export default new ShopifyPublishingManager();
