/**
 * TDS Geo Next.js Integration — Storage Layer
 *
 * Provides a StorageProvider interface and a JSON-file-based implementation
 * that stores TDS Geo posts as individual JSON files under `.tds-geo/`.
 *
 * For production, implement your own StorageProvider backed by PostgreSQL,
 * SQLite, Prisma, or your database of choice.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync } from 'node:fs';
import {
  TdsGeoArticle,
  TdsGeoPost,
  TdsGeoPostList,
  StorageProvider,
} from '../types';

// ══════════════════════════════════════════════════════════════════
// FILE STORAGE — JSON files in .tds-geo/ directory
// ══════════════════════════════════════════════════════════════════

const DEFAULT_STORAGE_DIR = '.tds-geo';

export class FileStorage implements StorageProvider {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = path.resolve(process.cwd(), storageDir || DEFAULT_STORAGE_DIR);
  }

  // ─── Initialization ─────────────────────────

  /** Ensure the storage directory exists, create it if needed. */
  async init(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
  }

  /** Path to the index file that lists all stored post IDs. */
  private get indexPath(): string {
    return path.join(this.storageDir, 'index.json');
  }

  /** Path to a single post's data file. */
  private postPath(id: string): string {
    return path.join(this.storageDir, `post-${id}.json`);
  }

  /** Load or create the index file. */
  private async loadIndex(): Promise<string[]> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /** Save the index file. */
  private async saveIndex(ids: string[]): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(ids, null, 2), 'utf-8');
  }

  // ─── CRUD Operations ────────────────────────

  async listPosts(options?: {
    status?: string;
    limit?: number;
    offset?: number;
    tag?: string;
  }): Promise<TdsGeoPostList> {
    await this.init();
    const ids = await this.loadIndex();
    let posts: TdsGeoPost[] = [];

    for (const id of ids) {
      try {
        const data = await fs.readFile(this.postPath(id), 'utf-8');
        const post = JSON.parse(data) as TdsGeoPost;
        posts.push(post);
      } catch {
        // Skip corrupted entries
      }
    }

    // Sort most recent first
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter by status
    if (options?.status) {
      posts = posts.filter(p => p.status === options.status);
    }

    // Filter by tag
    if (options?.tag) {
      posts = posts.filter(p => p.tags.includes(options.tag!));
    }

    const total = posts.length;
    const pageSize = options?.limit || 20;
    const offset = options?.offset || 0;
    const sliced = posts.slice(offset, offset + pageSize);

    return {
      posts: sliced,
      total,
      page: Math.floor(offset / pageSize) + 1,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getPost(id: string): Promise<TdsGeoPost | null> {
    try {
      const data = await fs.readFile(this.postPath(id), 'utf-8');
      return JSON.parse(data) as TdsGeoPost;
    } catch {
      return null;
    }
  }

  async getPostBySlug(slug: string): Promise<TdsGeoPost | null> {
    const ids = await this.loadIndex();
    for (const id of ids) {
      try {
        const data = await fs.readFile(this.postPath(id), 'utf-8');
        const post = JSON.parse(data) as TdsGeoPost;
        if (post.slug === slug) return post;
      } catch {
        // Skip
      }
    }
    return null;
  }

  async getPostByTdsGeoId(tdsGeoId: string): Promise<TdsGeoPost | null> {
    const ids = await this.loadIndex();
    for (const id of ids) {
      try {
        const data = await fs.readFile(this.postPath(id), 'utf-8');
        const post = JSON.parse(data) as TdsGeoPost;
        if (post.id === tdsGeoId) return post;
      } catch {
        // Skip
      }
    }
    return null;
  }

  async upsertPost(article: TdsGeoArticle): Promise<TdsGeoPost> {
    await this.init();

    // Check if we already have this article (by TDS Geo ID)
    const existing = await this.getPostByTdsGeoId(article.id);
    const now = new Date().toISOString();

    const post: TdsGeoPost = {
      ...article,
      localId: existing?.localId || crypto.randomUUID(),
      importedAt: existing?.importedAt || now,
      revalidationTags: existing?.revalidationTags || ['tds-geo'],
      seo: existing?.seo || {
        metaTitle: article.metaTitle || article.title,
        metaDescription: article.metaDescription || article.excerpt || '',
      },
      updatedAt: article.updatedAt || now,
    };

    await fs.writeFile(this.postPath(post.localId), JSON.stringify(post, null, 2), 'utf-8');

    // Update index if new
    if (!existing) {
      const ids = await this.loadIndex();
      ids.push(post.localId);
      await this.saveIndex(ids);
    }

    return post;
  }

  async deletePost(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.postPath(id));
      const ids = await this.loadIndex();
      const filtered = ids.filter(i => i !== id);
      await this.saveIndex(filtered);
      return true;
    } catch {
      return false;
    }
  }

  async getPostCount(status?: string): Promise<number> {
    const ids = await this.loadIndex();
    if (!status) return ids.length;

    let count = 0;
    for (const id of ids) {
      try {
        const data = await fs.readFile(this.postPath(id), 'utf-8');
        const post = JSON.parse(data) as TdsGeoPost;
        if (post.status === status) count++;
      } catch {
        // Skip
      }
    }
    return count;
  }

  async getAllTags(): Promise<string[]> {
    const tagSet = new Set<string>();
    const ids = await this.loadIndex();
    for (const id of ids) {
      try {
        const data = await fs.readFile(this.postPath(id), 'utf-8');
        const post = JSON.parse(data) as TdsGeoPost;
        for (const tag of post.tags) tagSet.add(tag);
      } catch {
        // Skip
      }
    }
    return Array.from(tagSet).sort();
  }

  async getAllCategories(): Promise<string[]> {
    const catSet = new Set<string>();
    const ids = await this.loadIndex();
    for (const id of ids) {
      try {
        const data = await fs.readFile(this.postPath(id), 'utf-8');
        const post = JSON.parse(data) as TdsGeoPost;
        for (const cat of post.categories || []) catSet.add(cat);
      } catch {
        // Skip
      }
    }
    return Array.from(catSet).sort();
  }
}
