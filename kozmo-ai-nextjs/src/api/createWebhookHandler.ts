/**
 * KozmoAI Next.js Integration — Webhook Route Handler
 *
 * Receives real-time content events from KozmoAI (article.created,
 * article.updated, article.deleted, ping) and performs the
 * corresponding storage operation + ISR revalidation.
 *
 * Usage in your Next.js App Router:
 *   // app/api/kozmo-ai/webhook/route.ts
 *   import { createWebhookHandler } from '@kozmo-ai/nextjs-integration/server';
 *
 *   const handler = createWebhookHandler({ apiKey: process.env.KOZMO_AI_API_KEY! });
 *   export const POST = handler.POST;
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '../lib/auth';
import { revalidateKozmoAIPost } from '../lib/revalidation';
import {
  KozmoAIConfig,
  KozmoAIWebhookPayload,
  KozmoAIArticle,
  KozmoAIAPIResponse,
  StorageProvider,
} from '../types';
import { FileStorage } from '../lib/storage';
import { slugify } from '../lib/utils';

export function createWebhookHandler(config: KozmoAIConfig) {
  const storage: StorageProvider = config.storage || new FileStorage();
  const apiKey = config.apiKey;

  /** POST /api/kozmo-ai/webhook — Receive content events */
  async function POST(request: NextRequest): Promise<NextResponse<KozmoAIAPIResponse>> {
    const auth = verifyRequest(request, apiKey);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.reason! }, { status: 401 });
    }

    try {
      const payload = (await request.json()) as KozmoAIWebhookPayload;

      if (!payload.event) {
        return NextResponse.json(
          { success: false, error: 'Missing event type in webhook payload.' },
          { status: 400 }
        );
      }

      if (config.debug) {
        console.log('[KozmoAI] Webhook received:', payload.event);
      }

      switch (payload.event) {
        case 'article.created': {
          const article = payload.data as KozmoAIArticle;
          if (!article.title || !article.content) {
            return NextResponse.json(
              { success: false, error: 'Article data missing required fields: title, content' },
              { status: 400 }
            );
          }

          const post = await storage.upsertPost(article);
          revalidateKozmoAIPost({
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
          const article = payload.data as KozmoAIArticle;
          if (!article.id) {
            return NextResponse.json(
              { success: false, error: 'Article data missing required field: id' },
              { status: 400 }
            );
          }

          // Try to find existing post by KozmoAI ID
          const existing = await storage.getPostByKozmoAIId(article.id);

          if (existing) {
            const mergedArticle: KozmoAIArticle = {
              ...article,
              slug: article.slug || existing.slug,
              tags: article.tags || existing.tags,
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString(),
            };

            const post = await storage.upsertPost(mergedArticle);
            revalidateKozmoAIPost({
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
          const newArticle: KozmoAIArticle = {
            ...article,
            slug: article.slug || slugify(article.title),
            tags: article.tags || [],
            createdAt: article.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const post = await storage.upsertPost(newArticle);
          revalidateKozmoAIPost({
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
          const data = payload.data as { kozmo-aiArticleId?: string; postId?: string };
          const kozmo-aiId = data.kozmo-aiArticleId || data.postId || '';

          if (!kozmo-aiId) {
            return NextResponse.json(
              { success: false, error: 'Missing article ID for deletion.' },
              { status: 400 }
            );
          }

          // Find post by KozmoAI ID
          let post = await storage.getPostByKozmoAIId(kozmo-aiId);
          if (!post) post = await storage.getPost(kozmo-aiId);

          if (post) {
            const slug = post.slug;
            const tags = post.tags;
            const categories = post.categories;
            await storage.deletePost(post.localId);

            // Revalidate to remove from listings
            revalidateKozmoAIPost({ localId: post.localId, slug, tags, categories });
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
