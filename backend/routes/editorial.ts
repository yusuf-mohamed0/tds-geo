// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Editorial Workflow Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import editorialWorkflow from '../services/editorialWorkflow';
import enterpriseSecurity from '../services/enterpriseSecurity';

export function createEditorialRoutes(pool: Pool): Router {
  const router = Router();
  editorialWorkflow.initialize(pool);

  // Get editorial review assignments
  router.get('/assignments', authenticate, async (req: Request, res: Response) => {
    try {
      const assignments = await editorialWorkflow.getPendingAssignments(
        (req as any).user.userId,
        (req as any).user.clientId
      );
      res.json({ success: true, data: assignments });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create review assignment
  router.post('/assignments', authenticate, async (req: Request, res: Response) => {
    try {
      const assignment = await editorialWorkflow.createReviewAssignment({
        article_id: req.body.article_id,
        client_id: req.body.client_id || (req as any).user.clientId,
        reviewer_id: req.body.reviewer_id,
        assigned_by: (req as any).user.userId,
        review_type: req.body.review_type,
        priority: req.body.priority || 0,
        due_at: req.body.due_at ? new Date(req.body.due_at) : undefined
      } as any);
      await enterpriseSecurity.logAudit({
        client_id: assignment.client_id,
        user_id: (req as any).user.userId,
        action: 'review_assignment_created',
        resource_type: 'assignment',
        resource_id: assignment.id,
        severity: 'info',
        outcome: 'success'
      } as any);
      res.json({ success: true, data: assignment });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Submit a review
  router.post('/reviews', authenticate, async (req: Request, res: Response) => {
    try {
      await editorialWorkflow.submitReview({
        article_id: req.body.article_id,
        reviewer_id: (req as any).user.userId,
        review_type: req.body.review_type,
        decision: req.body.decision,
        score: req.body.score,
        comments: req.body.comments,
        suggestions: req.body.suggestions || [],
        revision_notes: req.body.revision_notes
      });
      res.json({ success: true, message: 'Review submitted' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get comments for an article
  router.get('/articles/:articleId/comments', authenticate, async (req: Request, res: Response) => {
    try {
      const comments = await editorialWorkflow.getComments(req.params.articleId);
      res.json({ success: true, data: comments });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Add comment
  router.post('/articles/:articleId/comments', authenticate, async (req: Request, res: Response) => {
    try {
      const comment = await editorialWorkflow.addComment({
        article_id: req.params.articleId,
        parent_id: req.body.parent_id,
        author_id: (req as any).user.userId,
        content: req.body.content,
        resolved: false
      } as any);
      res.json({ success: true, data: comment });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Resolve comment
  router.patch('/comments/:commentId/resolve', authenticate, async (req: Request, res: Response) => {
    try {
      await editorialWorkflow.resolveComment(req.params.commentId, (req as any).user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Content locking
  router.post('/articles/:articleId/lock', authenticate, async (req: Request, res: Response) => {
    try {
      const acquired = await editorialWorkflow.acquireLock(req.params.articleId, (req as any).user.userId, req.body.ttlSeconds || 300);
      if (!acquired) {
        const lock = await editorialWorkflow.getLock(req.params.articleId);
        return res.status(409).json({ success: false, error: 'Article is locked by another user', data: lock });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/articles/:articleId/lock', authenticate, async (req: Request, res: Response) => {
    try {
      await editorialWorkflow.releaseLock(req.params.articleId, (req as any).user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Content versioning
  router.get('/articles/:articleId/versions', authenticate, async (req: Request, res: Response) => {
    try {
      const versions = await editorialWorkflow.getVersions(req.params.articleId);
      res.json({ success: true, data: versions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/articles/:articleId/restore/:versionNumber', authenticate, async (req: Request, res: Response) => {
    try {
      await editorialWorkflow.restoreVersion(req.params.articleId, parseInt(req.params.versionNumber), (req as any).user.userId);
      res.json({ success: true, message: `Restored to version ${req.params.versionNumber}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Editorial calendar
  router.get('/calendar', authenticate, async (req: Request, res: Response) => {
    try {
      const entries = await editorialWorkflow.getCalendarEntries(
        (req.query.clientId as string) || (req as any).user.clientId,
        req.query.status as string
      );
      res.json({ success: true, data: entries });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/calendar', authenticate, async (req: Request, res: Response) => {
    try {
      const entry = await editorialWorkflow.createCalendarEntry(req.body);
      res.json({ success: true, data: entry });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Advance article status
  router.patch('/articles/:articleId/status', authenticate, async (req: Request, res: Response) => {
    try {
      await editorialWorkflow.advanceStatus(
        req.params.articleId,
        req.body.status,
        (req as any).user.userId
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
