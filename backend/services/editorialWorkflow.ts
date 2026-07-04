// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Editorial Workflow Service
// Human-in-the-loop editorial approval system with review queues,
// content versioning, locking, and editorial calendar management
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import {
  Article, ArticleStatus, EditorialStatus,
  EditorialReviewAssignment, EditorialReview,
  EditorialComment, ContentVersion, ContentLock,
  EditorialCalendarEntry, ReviewType, ReviewDecision, ReviewStatus
} from '../types';

class EditorialWorkflowService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Editorial Workflow Service initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // ARTICLE STATUS MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async advanceStatus(
    articleId: string,
    newStatus: EditorialStatus,
    userId?: string
  ): Promise<void> {
    if (!this.pool) return;

    // Map editorial status to legacy status for backward compat
    const statusMap: Record<EditorialStatus, ArticleStatus> = {
      'draft': 'draft',
      'generated': 'generated',
      'in_review': 'reviewed',
      'in_seo_review': 'reviewed',
      'seo_reviewed': 'reviewed',
      'in_editor_review': 'reviewed',
      'editor_reviewed': 'reviewed',
      'approved': 'approved',
      'scheduled': 'approved',
      'published': 'published',
      'rejected': 'rejected',
      'failed': 'failed',
      'archived': 'archived'
    };

    await this.pool.query(
      `UPDATE articles SET status = $2, editorial_status = $3, updated_at = NOW()
       WHERE id = $1`,
      [articleId, statusMap[newStatus], newStatus]
    );

    // Auto-create content version snapshot on status change
    if (['seo_reviewed', 'editor_reviewed', 'approved', 'published'].includes(newStatus)) {
      await this.snapshotVersion(articleId, userId, `Status changed to ${newStatus}`);
    }

    logger.info(`Article ${articleId} status advanced to ${newStatus}`);
  }

  private async snapshotVersion(articleId: string, userId?: string, changeSummary?: string): Promise<void> {
    if (!this.pool) return;
    const article = await this.pool.query('SELECT * FROM articles WHERE id = $1', [articleId]);
    if (article.rows.length === 0) return;

    const a = article.rows[0];
    const maxVersion = await this.pool.query(
      'SELECT COALESCE(MAX(version_number), 0) as max_ver FROM content_versions WHERE article_id = $1',
      [articleId]
    );

    await this.pool.query(
      `INSERT INTO content_versions (article_id, version_number, title, content_md, content_html, meta_title, meta_description, tags, word_count, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [articleId, parseInt(maxVersion.rows[0].max_ver) + 1, a.title, a.content_md, a.content_html, a.meta_title, a.meta_description, a.tags, a.word_count, changeSummary || 'Auto-snapshot', userId || null]
    );
  }

  // ══════════════════════════════════════════════════════════════
  // REVIEW ASSIGNMENTS
  // ══════════════════════════════════════════════════════════════

  async createReviewAssignment(
    assignment: Omit<EditorialReviewAssignment, 'id' | 'created_at' | 'updated_at' | 'status'>
  ): Promise<EditorialReviewAssignment> {
    if (!this.pool) throw new Error('EditorialWorkflow not initialized');
    const result = await this.pool.query(
      `INSERT INTO editorial_review_assignments (article_id, client_id, reviewer_id, assigned_by, review_type, status, priority, due_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
       RETURNING *`,
      [assignment.article_id, assignment.client_id, assignment.reviewer_id || null,
       assignment.assigned_by || null, assignment.review_type, assignment.priority || 0,
       assignment.due_at || null]
    );
    return result.rows[0];
  }

  async getPendingAssignments(reviewerId?: string, clientId?: string): Promise<EditorialReviewAssignment[]> {
    if (!this.pool) return [];
    let query = `SELECT era.*, a.title as article_title, u.name as reviewer_name
                 FROM editorial_review_assignments era
                 LEFT JOIN articles a ON a.id = era.article_id
                 LEFT JOIN users u ON u.id = era.reviewer_id
                 WHERE era.status = 'pending'`;
    const params: (string | number)[] = [];

    if (reviewerId) {
      params.push(reviewerId);
      query += ` AND era.reviewer_id = $${params.length}`;
    }
    if (clientId) {
      params.push(clientId);
      query += ` AND era.client_id = $${params.length}`;
    }

    query += ' ORDER BY era.priority DESC, era.due_at ASC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async submitReview(review: Omit<EditorialReview, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) return;

    // Store the review
    await this.pool.query(
      `INSERT INTO editorial_reviews (article_id, reviewer_id, review_type, decision, score, comments, suggestions, revision_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [review.article_id, review.reviewer_id || null, review.review_type, review.decision,
       review.score || null, review.comments || null, JSON.stringify(review.suggestions || []),
       review.revision_notes || null]
    );

    // Update the assignment status
    await this.pool.query(
      `UPDATE editorial_review_assignments
       SET status = 'completed', completed_at = NOW()
       WHERE article_id = $1 AND review_type = $2 AND status = 'pending'`,
      [review.article_id, review.review_type]
    );

    // Update article editorial status based on decision
    if (review.decision === 'approved') {
      if (review.review_type === 'seo_review') {
        await this.advanceStatus(review.article_id, 'seo_reviewed', review.reviewer_id);
      } else if (review.review_type === 'editor_review') {
        await this.advanceStatus(review.article_id, 'editor_reviewed', review.reviewer_id);
      } else if (review.review_type === 'final_approval') {
        await this.advanceStatus(review.article_id, 'approved', review.reviewer_id);
      }
    } else if (review.decision === 'revision_requested') {
      // Create revision request — article goes back to generated
      await this.advanceStatus(review.article_id, 'generated', review.reviewer_id);

      // Create new assignment for re-review
      const article = await this.pool.query('SELECT client_id FROM articles WHERE id = $1', [review.article_id]);
      if (article.rows[0]) {
        await this.createReviewAssignment({
          article_id: review.article_id,
          client_id: article.rows[0].client_id,
          review_type: review.review_type as ReviewType,
          priority: 1,
          due_at: new Date(Date.now() + 86400000) // 24 hours
        });
      }
    } else if (review.decision === 'rejected') {
      await this.advanceStatus(review.article_id, 'rejected', review.reviewer_id);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // COMMENTS / DISCUSSION
  // ══════════════════════════════════════════════════════════════

  async addComment(comment: Omit<EditorialComment, 'id' | 'created_at' | 'updated_at'>): Promise<EditorialComment> {
    if (!this.pool) throw new Error('EditorialWorkflow not initialized');
    const result = await this.pool.query(
      `INSERT INTO editorial_comments (article_id, parent_id, author_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [comment.article_id, comment.parent_id || null, comment.author_id || null, comment.content]
    );
    return result.rows[0];
  }

  async getComments(articleId: string): Promise<EditorialComment[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT ec.*, u.name as author_name
       FROM editorial_comments ec
       LEFT JOIN users u ON u.id = ec.author_id
       WHERE ec.article_id = $1
       ORDER BY ec.created_at ASC`,
      [articleId]
    );
    return result.rows;
  }

  async resolveComment(commentId: string, userId?: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `UPDATE editorial_comments
       SET resolved = true, resolved_by = $2, resolved_at = NOW()
       WHERE id = $1`,
      [commentId, userId || null]
    );
  }

  // ══════════════════════════════════════════════════════════════
  // CONTENT LOCKING
  // ══════════════════════════════════════════════════════════════

  async acquireLock(articleId: string, userId: string, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.pool) return false;

    // Check if lock exists and is still valid
    const existing = await this.pool.query(
      'SELECT * FROM content_locks WHERE article_id = $1 AND expires_at > NOW()',
      [articleId]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].locked_by !== userId) {
        return false; // Locked by someone else
      }
      // Refresh lock
      await this.pool.query(
        'UPDATE content_locks SET expires_at = NOW() + $2::interval WHERE article_id = $1',
        [articleId, `${ttlSeconds} seconds`]
      );
      return true;
    }

    await this.pool.query(
      `INSERT INTO content_locks (article_id, locked_by, expires_at)
       VALUES ($1, $2, NOW() + $3::interval)
       ON CONFLICT (article_id) DO UPDATE SET locked_by = $2, locked_at = NOW(), expires_at = NOW() + $3::interval`,
      [articleId, userId, `${ttlSeconds} seconds`]
    );
    return true;
  }

  async releaseLock(articleId: string, userId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'DELETE FROM content_locks WHERE article_id = $1 AND locked_by = $2',
      [articleId, userId]
    );
  }

  async getLock(articleId: string): Promise<ContentLock | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      `SELECT cl.*, u.name as locked_by_name
       FROM content_locks cl
       LEFT JOIN users u ON u.id = cl.locked_by
       WHERE cl.article_id = $1 AND cl.expires_at > NOW()`,
      [articleId]
    );
    return result.rows[0] || null;
  }

  // ══════════════════════════════════════════════════════════════
  // CONTENT VERSIONING
  // ══════════════════════════════════════════════════════════════

  async getVersions(articleId: string): Promise<ContentVersion[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT cv.*, u.name as created_by_name
       FROM content_versions cv
       LEFT JOIN users u ON u.id = cv.created_by
       WHERE cv.article_id = $1
       ORDER BY cv.version_number DESC`,
      [articleId]
    );
    return result.rows;
  }

  async restoreVersion(articleId: string, versionNumber: number, userId?: string): Promise<void> {
    if (!this.pool) return;

    // Get the version to restore
    const version = await this.pool.query(
      'SELECT * FROM content_versions WHERE article_id = $1 AND version_number = $2',
      [articleId, versionNumber]
    );

    if (version.rows.length === 0) {
      throw new Error(`Version ${versionNumber} not found for article ${articleId}`);
    }

    const v = version.rows[0];

    // Snapshot current state before restoring
    await this.snapshotVersion(articleId, userId, `Rollback to version ${versionNumber}`);

    // Restore the version
    await this.pool.query(
      `UPDATE articles
       SET title = $2, content_md = $3, content_html = $4, meta_title = $5,
           meta_description = $6, tags = $7, word_count = $8, updated_at = NOW()
       WHERE id = $1`,
      [articleId, v.title, v.content_md, v.content_html, v.meta_title, v.meta_description, v.tags, v.word_count]
    );

    logger.info(`Article ${articleId} restored to version ${versionNumber}`);
  }

  // ══════════════════════════════════════════════════════════════
  // EDITORIAL CALENDAR
  // ══════════════════════════════════════════════════════════════

  async createCalendarEntry(entry: Omit<EditorialCalendarEntry, 'id' | 'created_at' | 'updated_at'>): Promise<EditorialCalendarEntry> {
    if (!this.pool) throw new Error('EditorialWorkflow not initialized');
    const result = await this.pool.query(
      `INSERT INTO editorial_calendar (client_id, article_id, title, keyword, assignee_id, status, priority, due_date, publish_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [entry.client_id, entry.article_id || null, entry.title, entry.keyword || null,
       entry.assignee_id || null, entry.status || 'planned', entry.priority || 'medium',
       entry.due_date || null, entry.publish_date || null, entry.notes || null]
    );
    return result.rows[0];
  }

  async getCalendarEntries(clientId: string, status?: string): Promise<EditorialCalendarEntry[]> {
    if (!this.pool) return [];
    let query = `SELECT ec.*, u.name as assignee_name
                 FROM editorial_calendar ec
                 LEFT JOIN users u ON u.id = ec.assignee_id
                 WHERE ec.client_id = $1`;
    const params: (string | string[])[] = [clientId];

    if (status) {
      params.push(status);
      query += ` AND ec.status = $${params.length}`;
    }

    query += ' ORDER BY ec.due_date ASC, ec.priority DESC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async updateCalendarEntry(id: string, updates: Partial<EditorialCalendarEntry>): Promise<void> {
    if (!this.pool) return;
    const fields: string[] = [];
    const params: (string | number | Date | null)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'created_at', 'updated_at'].includes(key)) continue;
      fields.push(`${key} = $${paramIndex}`);
      params.push(value as any);
      paramIndex++;
    }

    if (fields.length === 0) return;
    params.push(id);
    await this.pool.query(
      `UPDATE editorial_calendar SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      params
    );
  }

  // ══════════════════════════════════════════════════════════════
  // SCHEDULED PUBLISHING
  // ══════════════════════════════════════════════════════════════

  async schedulePublishing(articleId: string, scheduledDate: Date): Promise<void> {
    if (!this.pool) return;
    await this.advanceStatus(articleId, 'scheduled');

    // Create calendar entry
    const article = await this.pool.query('SELECT client_id, title FROM articles WHERE id = $1', [articleId]);
    if (article.rows.length > 0) {
      await this.createCalendarEntry({
        client_id: article.rows[0].client_id,
        article_id: articleId,
        title: article.rows[0].title,
        status: 'approved',
        priority: 'medium',
        publish_date: scheduledDate
      });
    }

    logger.info(`Article ${articleId} scheduled for ${scheduledDate.toISOString()}`);
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default new EditorialWorkflowService();
