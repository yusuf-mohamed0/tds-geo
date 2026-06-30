import { logger } from '../../utils/logger';
import { eventBus } from '../../event-bus';
import { Events } from '../../event-bus/events';
import seoService from '../../services/seo';
import seoIntelligence from '../../services/seoIntelligence';
import geoIntelligence from '../../services/geoIntelligence';
import internalLinksService from '../../services/internalLinks';

export class SEOEngine {
  async initialize(pool: any): Promise<void> {
    logger.info('SEOEngine initialized');
  }

  async analyze(content: string, keyword?: string): Promise<any> {
    const result = await seoService.analyzeContent(content, keyword || '');
    await eventBus.emit(Events.SEO_ANALYZED, { contentLength: content.length, keyword });
    return result;
  }

  async optimize(content: string, keyword: string): Promise<string> {
    await eventBus.emit(Events.SEO_OPTIMIZED, { keyword });
    return content;
  }

  async analyzeGeo(content: string): Promise<any> {
    return geoIntelligence.analyze(content);
  }

  async improveGeo(content: string): Promise<any> {
    return geoIntelligence.improveContent(content);
  }

  async findInternalLinks(clientId: string, content: string, title?: string): Promise<any[]> {
    return internalLinksService.findLinkOpportunities(content, title || '', clientId);
  }

  async generateSlug(title: string): Promise<string> {
    return seoService.generateSlug(title);
  }
}

export const seoEngine = new SEOEngine();
