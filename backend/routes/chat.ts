// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Chat Control Panel Routes
// REST interface for the chat-to-terminal system
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import { validate, createSessionSchema, sendMessageSchema, executeCommandSchema } from '../validators/index';
import { logger, logActivity } from '../utils/logger';
import chatEngine from '../services/chatEngine';

export function createChatRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate);

  // ─── List sessions ─────────────────────────
  router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await pool.query(
        `SELECT id, title, context, is_active, created_at, updated_at,
                (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id) as message_count
         FROM chat_sessions cs
         WHERE user_id = $1
         ORDER BY updated_at DESC LIMIT 50`,
        [user.userId]
      );
      res.json({ sessions: result.rows, total: result.rows.length });
    } catch (err) { next(err); }
  });

  // ─── Create session ────────────────────────
  router.post('/sessions', validate(createSessionSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { title } = req.body;
      const result = await pool.query(
        `INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *`,
        [user.userId, title || 'New Session']
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── Get session with messages ─────────────
  router.get('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const session = await pool.query(
        'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
        [req.params.id, user.userId]
      );
      if (session.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      const messages = await pool.query(
        'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
        [req.params.id]
      );
      res.json({ ...session.rows[0], messages: messages.rows });
    } catch (err) { next(err); }
  });

  // ─── Send message to session ────────────────
  router.post('/sessions/:id/messages', validate(sendMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { message: content } = req.body;

      // Verify session belongs to user
      const session = await pool.query(
        'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
        [req.params.id, user.userId]
      );
      if (session.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Save user message
      const userMsg = await pool.query(
        `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2) RETURNING *`,
        [req.params.id, content]
      );

      // Fetch conversation history for AI context
      const history = await pool.query(
        `SELECT role, content FROM chat_messages
         WHERE session_id = $1 AND id < $2
         ORDER BY created_at ASC`,
        [req.params.id, userMsg.rows[0].id]
      );

      // Generate response via AI chat engine
      const startTime = Date.now();
      const result = await chatEngine.generateResponse(content, history.rows, user);
      const duration = Date.now() - startTime;

      // Build response text with data formatting
      let responseText = result.message || '';
      if (result.data) {
        const dataStr = typeof result.data === 'object'
          ? '\n\n```json\n' + JSON.stringify(result.data, null, 2) + '\n```'
          : `\n${result.data}`;
        responseText += dataStr;
      }

      // Save assistant response
      const assistantMsg = await pool.query(
        `INSERT INTO chat_messages (session_id, role, content, metadata)
         VALUES ($1, 'assistant', $2, $3) RETURNING *`,
        [req.params.id, responseText, JSON.stringify({
          executionResult: {
            success: result.success,
            jobId: result.jobId,
            requiresApproval: result.requiresApproval,
          },
          duration: `${duration}ms`
        })]
      );

      // Update session timestamp
      await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [req.params.id]);

      await logActivity(pool, {
        clientId: user.clientId || '',
        action: 'chat_message',
        entityType: 'chat_session',
        entityId: req.params.id,
        level: 'info',
        message: `Chat: ${content.slice(0, 100)}`,
        metadata: { duration }
      });

      res.json({
        userMessage: userMsg.rows[0],
        assistantMessage: assistantMsg.rows[0],
        duration,
      });
    } catch (err) { next(err); }
  });

  // ─── Quick command (no session needed) ──────
  router.post('/command', validate(executeCommandSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { command } = req.body;

      const result = await chatEngine.generateResponse(command, [], user);

      res.json({
        success: result.success,
        message: result.message || result.error || '',
        data: result.data,
        jobId: result.jobId,
      });
    } catch (err) { next(err); }
  });

  // ─── Delete session (hard delete) ────────────
  router.delete('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      // Admin can delete any session; regular users can only delete their own
      let result;
      if (user.role === 'super_admin' || user.role === 'admin') {
        result = await pool.query(
          'DELETE FROM chat_sessions WHERE id = $1 RETURNING id, title',
          [req.params.id]
        );
      } else {
        result = await pool.query(
          'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id, title',
          [req.params.id, user.userId]
        );
      }
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      // Messages cascade delete via FK constraint
      res.json({ message: 'Session deleted', session: result.rows[0] });
    } catch (err) { next(err); }
  });

  // ─── Admin: Bulk delete old sessions ────────
  router.delete('/sessions/bulk/old', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const days = parseInt(req.query.days as string, 10) || 30;
      const result = await pool.query(
        `DELETE FROM chat_sessions
         WHERE updated_at < NOW() - $1::interval
         RETURNING id, title, updated_at`,
        [`${days} days`]
      );

      res.json({
        message: `Deleted ${result.rowCount} session(s) older than ${days} days`,
        count: result.rowCount,
        sessions: result.rows
      });
    } catch (err) { next(err); }
  });

  // ─── Admin: Delete all sessions for a user ───
  router.delete('/sessions/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const result = await pool.query(
        'DELETE FROM chat_sessions WHERE user_id = $1 RETURNING id, title',
        [req.params.userId]
      );

      res.json({
        message: `Deleted ${result.rowCount} session(s) for user`,
        count: result.rowCount,
        sessions: result.rows
      });
    } catch (err) { next(err); }
  });

  return router;
}
