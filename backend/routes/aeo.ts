import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import geoIntelligence, {
  generateLlmsTxt,
  generateAiRobotsTxt,
  scoreParagraphCitability,
  checkAiCitations,
  AI_CRAWLERS,
  LlmsTxtSection,
} from '../services/geoIntelligence';

export function createAeoRoutes(): Router {
  const router = Router();

  // GET /api/aeo/crawlers — list AI crawlers with current status
  router.get('/crawlers', authenticate, (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: AI_CRAWLERS.map(c => ({
        userAgent: c.userAgent,
        allowed: c.allowed,
        description: c.description,
      })),
    });
  });

  // POST /api/aeo/robots-txt — generate robots.txt for AI crawlers
  router.post('/robots-txt', authenticate, (req: Request, res: Response) => {
    try {
      const { rules } = req.body as { rules?: { userAgent: string; allowed: boolean }[] };
      const appliedRules = rules
        ? AI_CRAWLERS.map(c => {
            const override = rules.find(r => r.userAgent === c.userAgent);
            return { ...c, allowed: override ? override.allowed : c.allowed };
          })
        : AI_CRAWLERS;
      const robots = generateAiRobotsTxt(appliedRules);
      res.json({ success: true, data: { robots, contentType: 'text/plain' } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/aeo/llms-txt — generate llms.txt
  router.post('/llms-txt', authenticate, (req: Request, res: Response) => {
    try {
      const { siteName, siteDescription, sections } = req.body as {
        siteName: string;
        siteDescription: string;
        sections: LlmsTxtSection[];
      };
      const llms = generateLlmsTxt(
        siteName || 'My Website',
        siteDescription || '',
        sections || []
      );
      res.json({ success: true, data: { content: llms, contentType: 'text/markdown' } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/aeo/citability — per-paragraph citability score
  router.post('/citability', authenticate, (req: Request, res: Response) => {
    try {
      const { content } = req.body as { content: string };
      if (!content || content.length < 50) {
        res.status(400).json({ success: false, error: 'Content too short (min 50 chars)' });
        return;
      }
      const result = scoreParagraphCitability(content);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/aeo/citations/:domain — check AI engine citations
  router.get('/citations/:domain', authenticate, async (req: Request, res: Response) => {
    try {
      const { domain } = req.params;
      const result = await checkAiCitations(domain);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/aeo/llms-txt/:domain — serve llms.txt for a domain
  router.get('/llms-txt/:domain', async (req: Request, res: Response) => {
    try {
      const { domain } = req.params;
      const sections: LlmsTxtSection[] = [
        {
          title: 'Content',
          description: 'Main articles and pages',
          pages: [
            { url: `https://${domain}/`, title: 'Home' },
          ],
        },
      ];
      const llms = generateLlmsTxt(domain, `Content from ${domain}`, sections);
      res.type('text/markdown').send(llms);
    } catch (err: any) {
      res.status(500).send(`# llms.txt generation failed\n${err.message}`);
    }
  });

  return router;
}
