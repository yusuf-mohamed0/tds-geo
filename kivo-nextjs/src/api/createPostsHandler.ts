// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * Kivo Geo Next.js Integration - Posts Route Handler
 *
 * Factory that creates GET (list) and POST (create) handlers for
 * the `/api/kivo/posts` endpoint.
 *
 * Usage in your Next.js App Router:
 *   // app/api/kivo/posts/route.ts
 *   import { createPostsHandler } from '@tds/nextjs-integration/server';
 *
 *   const handler = createPostsHandler({ apiKey: process.env.KIVO_API_KEY! });
 *   export const GET = handler.GET;
 *   export const POST = handler.POST;
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '../lib/auth';
import { revalidateTdsGeoPost } from '../lib/revalidation';
import {
  TdsGeoConfig,
  TdsGeoArticle,
  TdsGeoPostList,
  TdsGeoApiResponse,
  StorageProvider,
} from '../types';
import { FileStorage } from '../lib/storage';
import { slugify } from '../lib/utils';

// ══════════════════════════════════════════════════════════════════
// HANDLER FACTORY
// ══════════════════════════════════════════════════════════════════

export function createPostsHandler(config: TdsGeoConfig) {
  const storage: StorageProvider = config.storage || new FileStorage();
  const apiKey = config.apiKey;

  /** GET /api/kivo/posts — List all posts */
  async function GET(request: NextRequest): Promise<NextResponse<TdsGeoApiResponse<TdsGeoPostList>>> {
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

  /** POST /api/kivo/posts — Create a new post */
  async function POST(request: NextRequest): Promise<NextResponse<TdsGeoApiResponse>> {
    // Authenticate
    const auth = verifyRequest(request, apiKey);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.reason! }, { status: 401 });
    }

    try {
      const body = (await request.json()) as TdsGeoArticle;

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
      const article: TdsGeoArticle = {
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
      revalidateTdsGeoPost({
        localId: post.localId,
        slug: post.slug,
        tags: post.tags,
        categories: post.categories,
      });

      if (config.debug) {
        console.log('[Kivo Geo] Post created:', post.title, `(slug: ${post.slug})`);
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
