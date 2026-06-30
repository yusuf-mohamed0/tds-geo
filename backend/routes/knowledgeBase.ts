import { Router, Request, Response } from 'express';
import { authenticate, authorizeClientAccess } from '../middleware/auth';
import knowledgeBaseService from '../services/knowledgeBase';

export function createKnowledgeBaseRoutes(): Router {
  const router = Router();

  // GET /api/knowledge-bases — list KBs for client
  router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
      const clientId = req.query.client_id as string;
      if (!clientId) {
        res.status(400).json({ success: false, error: 'client_id required' });
        return;
      }
      const bases = await knowledgeBaseService.listBases(clientId);
      res.json({ success: true, data: bases });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/knowledge-bases — create KB
  router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
      const { client_id, name, description } = req.body;
      if (!client_id || !name) {
        res.status(400).json({ success: false, error: 'client_id and name required' });
        return;
      }
      const base = await knowledgeBaseService.createBase(client_id, name, description);
      res.json({ success: true, data: base });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/knowledge-bases/:id — delete KB
  router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const clientId = req.query.client_id as string;
      if (!clientId) {
        res.status(400).json({ success: false, error: 'client_id required' });
        return;
      }
      const deleted = await knowledgeBaseService.deleteBase(req.params.id, clientId);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/knowledge-bases/:id/documents — list documents
  router.get('/:id/documents', authenticate, async (req: Request, res: Response) => {
    try {
      const docs = await knowledgeBaseService.listDocuments(req.params.id);
      res.json({ success: true, data: docs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/knowledge-bases/:id/documents — upload document (text content)
  router.post('/:id/documents', authenticate, async (req: Request, res: Response) => {
    try {
      const { client_id, filename, content, file_type } = req.body;
      if (!client_id || !filename || !content) {
        res.status(400).json({ success: false, error: 'client_id, filename, and content required' });
        return;
      }
      const doc = await knowledgeBaseService.storeDocument(
        req.params.id, client_id, filename, content, file_type
      );
      // Process asynchronously
      knowledgeBaseService.processDocument(doc.id).catch(() => {});
      res.json({ success: true, data: doc, message: 'Document queued for processing' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/knowledge-bases/:kbId/documents/:docId
  router.delete('/:kbId/documents/:docId', authenticate, async (req: Request, res: Response) => {
    try {
      const clientId = req.query.client_id as string;
      if (!clientId) {
        res.status(400).json({ success: false, error: 'client_id required' });
        return;
      }
      const deleted = await knowledgeBaseService.deleteDocument(req.params.docId, clientId);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/knowledge-bases/recall — RAG recall
  router.post('/recall', authenticate, async (req: Request, res: Response) => {
    try {
      const { client_id, query, limit } = req.body;
      if (!client_id || !query) {
        res.status(400).json({ success: false, error: 'client_id and query required' });
        return;
      }
      const results = await knowledgeBaseService.findRelevantContent(client_id, query, limit || 5);
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
