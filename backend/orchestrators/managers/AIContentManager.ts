// ══════════════════════════════════════════════════════════════════
// AI Content Department Manager
// Manages: content generation, image generation, brand voice, pexels
// ══════════════════════════════════════════════════════════════════

import { DepartmentManager } from './DepartmentManager';
import { DepartmentName, DepartmentTask, DecomposedTask, Subtask } from './types';
import { QueueNames } from '../../utils/queue';
import openaiService from '../../services/openai';

export class AIContentManager extends DepartmentManager {
  readonly department: DepartmentName = 'ai_content';
  readonly name = 'AI Content Manager';
  readonly description = 'Oversees content generation, image creation, brand voice analysis, and stock photography';
  readonly managedQueues: QueueNames[] = [
    QueueNames.CONTENT_GENERATION,
    QueueNames.IMAGE_GENERATION,
    QueueNames.BRAND_VOICE,
    QueueNames.PEXELS_IMAGE,
  ];

  async decompose(task: DepartmentTask): Promise<DecomposedTask> {
    const subtasks: Subtask[] = [];
    const parallelGroups: string[][] = [];

    switch (task.type) {
      case 'generate_article': {
        // Stage 1: Brand voice + Keyword research (parallel)
        subtasks.push({
          type: 'brand_voice_analysis',
          queueName: QueueNames.BRAND_VOICE,
          payload: { clientId: task.clientId, generateProfile: true },
          priority: 'high',
          timeoutMs: 30000,
        });
        subtasks.push({
          type: 'keyword_enrichment',
          queueName: undefined, // inline
          payload: task.payload,
          priority: 'normal',
          timeoutMs: 15000,
        });
        parallelGroups.push(['brand_voice_analysis', 'keyword_enrichment']);

        // Stage 2: Content generation (depends on brand voice)
        subtasks.push({
          type: 'content_generation',
          queueName: QueueNames.CONTENT_GENERATION,
          payload: {
            clientId: task.clientId,
            keyword: task.payload.keyword,
            tone: task.payload.tone,
            minWords: task.payload.minWords,
            maxWords: task.payload.maxWords,
            clientSettings: task.payload.clientSettings,
          },
          dependsOn: ['brand_voice_analysis'],
          priority: 'high',
          timeoutMs: 120000,
        });
        parallelGroups.push(['content_generation']);

        // Stage 3: Image generation + Pexels (parallel, depend on content)
        subtasks.push({
          type: 'image_generation',
          queueName: QueueNames.IMAGE_GENERATION,
          payload: {
            clientId: task.clientId,
            articleTitle: task.payload.articleTitle || '',
            keyword: task.payload.keyword,
          },
          dependsOn: ['content_generation'],
          priority: 'normal',
          timeoutMs: 60000,
        });
        subtasks.push({
          type: 'pexels_images',
          queueName: QueueNames.PEXELS_IMAGE,
          payload: {
            clientId: task.clientId,
            keyword: task.payload.keyword,
            articleTitle: task.payload.articleTitle || '',
          },
          dependsOn: ['content_generation'],
          priority: 'normal',
          timeoutMs: 30000,
        });
        parallelGroups.push(['image_generation', 'pexels_images']);
        break;
      }

      case 'generate_image': {
        subtasks.push({
          type: 'image_generation',
          queueName: QueueNames.IMAGE_GENERATION,
          payload: {
            clientId: task.clientId,
            articleTitle: task.payload.articleTitle,
            keyword: task.payload.keyword,
            articleId: task.payload.articleId,
          },
          priority: 'normal',
          timeoutMs: 60000,
        });
        parallelGroups.push(['image_generation']);
        break;
      }

      case 'analyze_brand_voice': {
        subtasks.push({
          type: 'brand_voice_analysis',
          queueName: QueueNames.BRAND_VOICE,
          payload: { clientId: task.clientId, generateProfile: true },
          priority: 'high',
          timeoutMs: 30000,
        });
        parallelGroups.push(['brand_voice_analysis']);
        break;
      }

      case 'fetch_pexels': {
        subtasks.push({
          type: 'pexels_images',
          queueName: QueueNames.PEXELS_IMAGE,
          payload: {
            clientId: task.clientId,
            keyword: task.payload.keyword,
            articleTitle: task.payload.articleTitle,
            articleId: task.payload.articleId,
          },
          priority: 'normal',
          timeoutMs: 30000,
        });
        parallelGroups.push(['pexels_images']);
        break;
      }

      default: {
        // Fallback: send directly to content generation queue
        subtasks.push({
          type: 'content_generation',
          queueName: QueueNames.CONTENT_GENERATION,
          payload: {
            clientId: task.clientId,
            keyword: task.payload.keyword || task.payload.text,
            ...task.payload,
          },
          priority: task.priority,
          timeoutMs: 120000,
        });
        parallelGroups.push(['content_generation']);
      }
    }

    return { originalTask: task, subtasks, parallelGroups };
  }

  protected async runSubtaskInline(_subtask: Subtask, _task: DepartmentTask): Promise<Record<string, unknown>> {
    if (_subtask.type === 'keyword_enrichment') {
      const keyword = _task.payload.keyword as string;
      if (!keyword) return { enriched: false };

      // Lightweight enrichment: estimate word target based on keyword length/complexity
      const wordCount = keyword.split(/\s+/).length;
      const minWords = wordCount <= 2 ? 1200 : wordCount <= 4 ? 1500 : 2000;
      const maxWords = Math.round(minWords * 1.8);

      return {
        enriched: true,
        suggestedMinWords: minWords,
        suggestedMaxWords: maxWords,
        keyword,
      };
    }
    return { executed: false };
  }
}

export default new AIContentManager();
