// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from '../../utils/logger';
import { eventBus } from '../../event-bus';
import { Events } from '../../event-bus/events';
import openaiService from '../../services/openai';
import ollamaService from '../../services/ollama';
import { convert } from '../../utils/markdownToHtml';

export class WritingEngine {
  async initialize(pool: any): Promise<void> {
    logger.info('WritingEngine initialized');
  }

  async generate(options: {
    keyword: string;
    tone?: string;
    minWords?: number;
    maxWords?: number;
  }): Promise<any> {

    const article = await openaiService.generateBlogPost({
      keyword: options.keyword,
      tone: options.tone || 'professional',
      minWords: options.minWords || 800,
      maxWords: options.maxWords || 1500,
    });

    await eventBus.emit(Events.ARTICLE_GENERATED, {
      keyword: options.keyword,
      title: article.title,
    });

    return article;
  }

  async convertMarkdown(md: string): Promise<string> {
    return convert(md);
  }

  async rewrite(content: string, instructions: string): Promise<any> {
    return null;
  }

  async generateTitle(keyword: string): Promise<string> {
    return '';
  }

  async generateExcerpt(content: string, maxLength?: number): Promise<string> {
    return content.substring(0, maxLength || 160);
  }
}

export const writingEngine = new WritingEngine();
