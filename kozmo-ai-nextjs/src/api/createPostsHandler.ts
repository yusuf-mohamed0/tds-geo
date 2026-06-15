/**
 * KozmoAI Next.js Integration — Posts Route Handler
 *
 * Factory that creates GET (list) and POST (create) handlers for
 * the `/api/kozmo-ai/posts` endpoint.
 *
 * Usage in your Next.js App Router:
 *   // app/api/kozmo-ai/posts/route.ts
 *   import { createPostsHandler } from '@kozmo-ai/nextjs-integration/server';
 *
 *   const handler = createPostsHandler({ apiKey: process.env.KOZMO_AI_API_KEY! });
 *   export const GET = handler.GET;
 *   export const POST = handler.POST;
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '../lib/auth';
import { revalidateKozmoAIPost } from '../lib/revalidation';
import {
  KozmoAIConfig,
  KozmoAIArticle,
  KozmoAIPostList,
  KozmoAIAPIResponse,
  StorageProvider,
} from '../types';
import { FileStorage } from '../lib/storage';
import { slugify } from '../lib/utils';

// ══════════════════════════════════════════════════════════════════
// HANDLER FACTORY
// ══════════════════════════════════════════════════════════════════

export function createPostsHandler(config: KozmoAIConfig) {
  const storage: StorageProvider = config.storage || new FileStorage();
  const apiKey = config.apiKey;

  /** GET /api/kozmo-ai/posts — List all posts */
  async function GET(request: NextRequest): Promise<NextResponse<KozmoAIAPIResponse<KozmoAIPostList>>> {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || undefined;
      const tag = searchParams.get('tag') || undefined;
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      const result = await storage.listPosts({ status, limit, offset, tag });

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Failed to list posts: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  /** POST /api/kozmo-ai/posts — Create a new post */
  async function POST(request: NextRequest): Promise<NextResponse<KozmoAIAPIResponse>> {
    // Authenticate
    const auth = verifyRequest(request, apiKey);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.reason! }, { status: 401 });
    }

    try {
      const body = (await request.json()) as KozmoAIArticle;

      // Validate required fields
      if (!body.title || !body.content) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields: title and content are required.',
          },
          { status: 400 }
        );
      }

      // Set defaults
      const article: KozmoAIArticle = {
        ...body,
        id: body.id || crypto.randomUUID(),
        slug: body.slug || slugify(body.title),
        tags: body.tags || [],
        status: body.status || 'published',
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: body.updatedAt || new Date().toISOString(),
      };

      // Store the post
      const post = await storage.upsertPost(article);

      // Trigger ISR revalidation
      revalidateKozmoAIPost({
        localId: post.localId,
        slug: post.slug,
        tags: post.tags,
        categories: post.categories,
      });

      if (config.debug) {
        console.log('[KozmoAI] Post created:', post.title, `(slug: ${post.slug})`);
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            localId: post.localId,
            slug: post.slug,
            url: `/${post.slug}`,
            message: 'Post created successfully. ISR revalidation triggered.',
          },
        },
        { status: 201 }
      );
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Failed to create post: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  return { GET, POST };
}
