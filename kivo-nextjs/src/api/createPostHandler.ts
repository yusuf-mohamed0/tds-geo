// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * Kivo Geo Next.js Integration - Single Post Route Handler
 *
 * Factory for GET, PUT, DELETE handlers for `/api/kivo/posts/[id]`.
 *
 * Usage in your Next.js App Router:
 *   // app/api/kivo/posts/[id]/route.ts
 *   import { createPostHandler } from '@tds/nextjs-integration/server';
 *
 *   const handler = createPostHandler({ apiKey: process.env.KIVO_API_KEY! });
 *   export const GET = handler.GET;
 *   export const PUT = handler.PUT;
 *   export const DELETE = handler.DELETE;
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '../lib/auth';
import { revalidateTdsGeoPost } from '../lib/revalidation';
import {
  TdsGeoConfig,
  TdsGeoPost,
  TdsGeoApiResponse,
  UpdatePostPayload,
  StorageProvider,
} from '../types';
import { FileStorage } from '../lib/storage';

export function createPostHandler(config: TdsGeoConfig) {
  const storage: StorageProvider = config.storage || new FileStorage();
  const apiKey = config.apiKey;

  /** Extract the post ID from the URL path (`/api/kivo/posts/[id]`) */
  function getPostId(request: NextRequest): string {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    // Path: ... /api/kivo/posts/[id]
    return segments[segments.length - 1] || '';
  }

  /** GET /api/kivo/posts/[id] — Get a single post by localId or slug */
  async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse<TdsGeoApiResponse<TdsGeoPost>>> {
    try {
      const resolvedParams = await params;
      const identifier = resolvedParams.id || getPostId(request);

      if (!identifier) {
        return NextResponse.json(
          { success: false, error: 'Post ID is required.' },
          { status: 400 }
        );
      }

      // Try by local ID first, then by slug, then by Kivo Geo ID
      let post = await storage.getPost(identifier);
      if (!post) post = await storage.getPostBySlug(identifier);
      if (!post) post = await storage.getPostByTdsGeoId(identifier);

      if (!post) {
        return NextResponse.json(
          { success: false, error: `Post not found: ${identifier}` },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: post });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Failed to get post: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  /** PUT /api/kivo/posts/[id] — Update a post */
  async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse<TdsGeoApiResponse>> {
    const auth = verifyRequest(request, apiKey);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.reason! }, { status: 401 });
    }

    try {
      const resolvedParams = await params;
      const identifier = resolvedParams.id || getPostId(request);
      const update = (await request.json()) as UpdatePostPayload;

      if (!identifier) {
        return NextResponse.json(
          { success: false, error: 'Post ID is required.' },
          { status: 400 }
        );
      }

      // Find existing post
      let post = await storage.getPost(identifier);
      if (!post) post = await storage.getPostBySlug(identifier);
      if (!post) post = await storage.getPostByTdsGeoId(identifier);

      if (!post) {
        return NextResponse.json(
          { success: false, error: `Post not found: ${identifier}` },
          { status: 404 }
        );
      }

      // Merge updates
      const updatedArticle = {
        ...post,
        ...update,
        id: post.id, // Preserve Kivo Geo article ID
        slug: update.slug || post.slug,
        tags: update.tags || post.tags,
        updatedAt: new Date().toISOString(),
      };

      const saved = await storage.upsertPost(updatedArticle);

      // Trigger ISR revalidation
      revalidateTdsGeoPost({
        localId: saved.localId,
        slug: saved.slug,
        tags: saved.tags,
        categories: saved.categories,
      });

      return NextResponse.json({
        success: true,
        data: {
          localId: saved.localId,
          slug: saved.slug,
          message: 'Post updated successfully.',
        },
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Failed to update post: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  /** DELETE /api/kivo/posts/[id] — Delete a post */
  async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse<TdsGeoApiResponse>> {
    const auth = verifyRequest(request, apiKey);
    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.reason! }, { status: 401 });
    }

    try {
      const resolvedParams = await params;
      const identifier = resolvedParams.id || getPostId(request);

      if (!identifier) {
        return NextResponse.json(
          { success: false, error: 'Post ID is required.' },
          { status: 400 }
        );
      }

      // Find the post to get its data for revalidation
      let post = await storage.getPost(identifier);
      if (!post) post = await storage.getPostBySlug(identifier);
      if (!post) post = await storage.getPostByTdsGeoId(identifier);

      if (!post) {
        return NextResponse.json(
          { success: false, error: `Post not found: ${identifier}` },
          { status: 404 }
        );
      }

      const deleted = await storage.deletePost(post.localId);

      if (!deleted) {
        return NextResponse.json(
          { success: false, error: 'Failed to delete post.' },
          { status: 500 }
        );
      }

      // Trigger ISR revalidation
      revalidateTdsGeoPost({
        localId: post.localId,
        slug: post.slug,
        tags: post.tags,
        categories: post.categories,
      });

      return NextResponse.json({
        success: true,
        data: { message: 'Post deleted successfully.' },
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Failed to delete post: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  return { GET, PUT, DELETE };
}
