/**
 * Vireon Next.js Integration — Webhook Route Handler
 *
 * Receives real-time content events from Vireon (article.created,
 * article.updated, article.deleted, ping) and performs the
 * corresponding storage operation + ISR revalidation.
 *
 * Usage in your Next.js App Router:
 *   // app/api/vireon/webhook/route.ts
 *   import { createWebhookHandler } from '@vireon/nextjs-integration/server';
 *
 *   const handler = createWebhookHandler({ apiKey: process.env.VIREON_API_KEY! });
 *   export const POST = handler.POST;
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '../lib/auth';
import { revalidateVireonPost } from '../lib/revalidation';
import {
  VireonConfig,
  VireonWebhookPayload,
  VireonArticle,
  VireonApiResponse,
  StorageProvider,
} from '../types';
import { FileStorage } from '../lib/storage';
import { slugify } from '../lib/utils';

export function createWebhookHandler(config: VireonConfig) {
  const storage: StorageProvider = config.storage || new FileStorage();
  const apiKey = config.apiKey;

  /** POST /api/vireon/webhook — Receive content events */
  async function POST(request: NextRequest): Promise<NextResponse<VireonApiResponse>> {
    const auth = verifyRequest(request, apiKey);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.reason! }, { status: 401 });
    }

    try {
      const payload = (await request.json()) as VireonWebhookPayload;

      if (!payload.event) {
        return NextResponse.json(
          { success: false, error: 'Missing event type in webhook payload.' },
          { status: 400 }
        );
      }

      if (config.debug) {
        console.log('[Vireon] Webhook received:', payload.event);
      }

      switch (payload.event) {
        case 'article.created': {
          const article = payload.data as VireonArticle;
          if (!article.title || !article.content) {
            return NextResponse.json(
              { success: false, error: 'Article data missing required fields: title, content' },
              { status: 400 }
            );
          }

          const post = await storage.upsertPost(article);
          revalidateVireonPost({
            localId: post.localId,
            slug: post.slug,
            tags: post.tags,
            categories: post.categories,
          });

          return NextResponse.json({
            success: true,
            data: { localId: post.localId, slug: post.slug, action: 'created' },
          });
        }

        case 'article.updated': {
          const article = payload.data as VireonArticle;
          if (!article.id) {
            return NextResponse.json(
              { success: false, error: 'Article data missing required field: id' },
              { status: 400 }
            );
          }

          // Try to find existing post by Vireon ID
          const existing = await storage.getPostByVireonId(article.id);

          if (existing) {
            const mergedArticle: VireonArticle = {
              ...article,
              slug: article.slug || existing.slug,
              tags: article.tags || existing.tags,
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString(),
            };

            const post = await storage.upsertPost(mergedArticle);
            revalidateVireonPost({
              localId: post.localId,
              slug: post.slug,
              tags: post.tags,
              categories: post.categories,
            });

            return NextResponse.json({
              success: true,
              data: { localId: post.localId, slug: post.slug, action: 'updated' },
            });
          }

          // If no existing post found, create it
          const newArticle: VireonArticle = {
            ...article,
            slug: article.slug || slugify(article.title),
            tags: article.tags || [],
            createdAt: article.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const post = await storage.upsertPost(newArticle);
          revalidateVireonPost({
            localId: post.localId,
            slug: post.slug,
            tags: post.tags,
            categories: post.categories,
          });

          return NextResponse.json({
            success: true,
            data: { localId: post.localId, slug: post.slug, action: 'created_fallback' },
          });
        }

        case 'article.deleted': {
          const data = payload.data as { vireonArticleId?: string; postId?: string };
          const vireonId = data.vireonArticleId || data.postId || '';

          if (!vireonId) {
            return NextResponse.json(
              { success: false, error: 'Missing article ID for deletion.' },
              { status: 400 }
            );
          }

          // Find post by Vireon ID
          let post = await storage.getPostByVireonId(vireonId);
          if (!post) post = await storage.getPost(vireonId);

          if (post) {
            const slug = post.slug;
            const tags = post.tags;
            const categories = post.categories;
            await storage.deletePost(post.localId);

            // Revalidate to remove from listings
            revalidateVireonPost({ localId: post.localId, slug, tags, categories });
          }

          return NextResponse.json({
            success: true,
            data: { deleted: !!post, action: 'deleted' },
          });
        }

        case 'ping': {
          return NextResponse.json({
            success: true,
            data: { pong: true, timestamp: new Date().toISOString() },
          });
        }

        default:
          return NextResponse.json(
            {
              success: false,
              error: `Unknown webhook event: ${payload.event}. Supported events: article.created, article.updated, article.deleted, ping`,
            },
            { status: 400 }
          );
      }
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Webhook processing failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  return { POST };
}
