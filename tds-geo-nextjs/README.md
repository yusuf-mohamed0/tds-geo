# @tds-geo/nextjs-integration

**Integrate AI-generated SEO content from TDS Geo into your Next.js App Router site.**

Receive articles from TDS Geo via REST API or webhooks, store them locally with automatic ISR revalidation, and render beautiful blog pages with pre-built React components.

---

## Features

- **📥 Receive content** — REST API endpoints to receive articles from TDS Geo
- **⚡ ISR revalidation** — Automatic `revalidateTag`/`revalidatePath` triggers when content changes
- **💾 Pluggable storage** — JSON file storage included; implement your own for SQLite/PostgreSQL/Prisma
- **🎨 React components** — Drop-in `TdsGeoBlogList`, `TdsGeoBlogPost`, and `TdsGeoContent` components
- **🔑 API key auth** — Secure all endpoints with shared secret via `X-TDS-GEO-Key` header
- **🌐 Webhooks** — Real-time content push from TDS Geo (`article.created`, `article.updated`, `article.deleted`)
- **📝 Markdown + HTML** — Accepts and renders both markdown and HTML content
- **🧩 Fully typed** — TypeScript types mirroring TDS Geo's content schema

## Installation

```bash
npm install @tds-geo/nextjs-integration
```

**Peer dependencies** (must be installed in your project):
- `next` ^14.0.0 || ^15.0.0
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

### 1. Set your API key

```env
# .env.local
TDS_GEO_API_KEY=your-tds-geo-api-key-here
```

### 2. Create API route files

**`app/api/tds-geo/posts/route.ts`** — List and create posts:

```typescript
import { createTdsGeoServer } from '@tds-geo/nextjs-integration/server';

const tds-geo = createTdsGeoServer({
  apiKey: process.env.TDS_GEO_API_KEY!,
});

export const GET = tds-geo.handlers.posts.GET;
export const POST = tds-geo.handlers.posts.POST;
```

**`app/api/tds-geo/posts/[id]/route.ts`** — Get, update, delete a single post:

```typescript
import { createTdsGeoServer } from '@tds-geo/nextjs-integration/server';

const tds-geo = createTdsGeoServer({
  apiKey: process.env.TDS_GEO_API_KEY!,
});

export const GET = tds-geo.handlers.post.GET;
export const PUT = tds-geo.handlers.post.PUT;
export const DELETE = tds-geo.handlers.post.DELETE;
```

**`app/api/tds-geo/webhook/route.ts`** — Receive real-time events from TDS Geo:

```typescript
import { createTdsGeoServer } from '@tds-geo/nextjs-integration/server';

const tds-geo = createTdsGeoServer({
  apiKey: process.env.TDS_GEO_API_KEY!,
});

export const POST = tds-geo.handlers.webhook.POST;
```

### 3. Build your blog pages

**`app/blog/page.tsx`** — Blog listing page:

```typescript
import { TdsGeoBlogList } from '@tds-geo/nextjs-integration/components';
import { FileStorage } from '@tds-geo/nextjs-integration';
import { TDS_GEO_TAG } from '@tds-geo/nextjs-integration';

export const revalidate = 3600; // Fallback revalidation (1 hour)

export default async function BlogPage() {
  const storage = new FileStorage();
  const { posts, totalPages } = await storage.listPosts({ limit: 12 });

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <TdsGeoBlogList posts={posts} totalPages={totalPages} />
    </div>
  );
}
```

**`app/blog/[slug]/page.tsx`** — Single blog post page:

```typescript
import { notFound } from 'next/navigation';
import { TdsGeoBlogPost } from '@tds-geo/nextjs-integration/components';
import { FileStorage } from '@tds-geo/nextjs-integration';

export const revalidate = 3600;

export default async function PostPage({ params }: { params: { slug: string } }) {
  const storage = new FileStorage();
  const post = await storage.getPostBySlug(params.slug);

  if (!post) notFound();

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <TdsGeoBlogPost post={post} showShareButtons />
    </article>
  );
}
```

## Architecture

```
TDS Geo Platform                    Your Next.js Site
┌──────────────┐    HTTP/HTTPS    ┌─────────────────────────────┐
│              │                  │                             │
│  Content     │ ──── POST ─────▶ │  /api/tds-geo/posts          │
│  Generation  │     (create)     │  /api/tds-geo/posts/[id]     │
│  Pipeline    │                  │  /api/tds-geo/webhook        │
│              │ ◀─── revalidate─ │                             │
│  Webhook     │    (ISR tag)     │  ┌─────────────────────┐   │
│  Dispatcher  │                  │  │  FileStorage        │   │
│              │                  │  │  (.tds-geo/*.json)   │   │
└──────────────┘                  │  └─────────────────────┘   │
                                  │                             │
                                  │  ┌─────────────────────┐   │
                                  │  │  ISR Revalidation    │   │
                                  │  │  (revalidateTag)     │   │
                                  │  └─────────────────────┘   │
                                  │                             │
                                  │  ┌─────────────────────┐   │
                                  │  │  React Components    │   │
                                  │  │  BlogList, BlogPost  │   │
                                  │  └─────────────────────┘   │
                                  └─────────────────────────────┘
```

## API Reference

### Route Handlers

All handlers are created via `createTdsGeoServer(config)`.

#### `GET /api/tds-geo/posts`
List all posts with optional filtering:
- `?status=published` — Filter by status
- `?tag=seo` — Filter by tag
- `?limit=20&offset=0` — Pagination

#### `POST /api/tds-geo/posts`
Create a new post. Requires `X-TDS-GEO-Key` header.
Body: `{ title, content, slug?, tags?, metaTitle?, ... }`

#### `GET /api/tds-geo/posts/[id]`
Get a single post by local ID, slug, or TDS Geo article ID.

#### `PUT /api/tds-geo/posts/[id]`
Update a post. Requires `X-TDS-GEO-Key` header.

#### `DELETE /api/tds-geo/posts/[id]`
Delete a post. Requires `X-TDS-GEO-Key` header.

#### `POST /api/tds-geo/webhook`
Receive real-time events. Requires `X-TDS-GEO-Key` header.
Events: `article.created`, `article.updated`, `article.deleted`, `ping`

### Storage Providers

**FileStorage** (default) — Stores posts as JSON files in `.tds-geo/`:

```typescript
import { FileStorage } from '@tds-geo/nextjs-integration';

const storage = new FileStorage('.tds-geo');  // default
```

**Custom Storage** — Implement the `StorageProvider` interface:

```typescript
import { StorageProvider, TdsGeoArticle, TdsGeoPost } from '@tds-geo/nextjs-integration';

class MyDatabaseStorage implements StorageProvider {
  async upsertPost(article: TdsGeoArticle): Promise<TdsGeoPost> {
    // Store in your database
  }
  // ... implement all required methods
}
```

### Revalidation

```typescript
import {
  revalidateTdsGeoPost,        // Revalidate a single post
  revalidateAllTdsGeoContent,  // Revalidate all TDS Geo content
  getTdsGeoTags,               // Get cache tags for a post
  TDS_GEO_TAG,                  // 'tds-geo' — the default cache tag
} from '@tds-geo/nextjs-integration';
```

## Advanced Usage

### Using with your own database (Prisma example)

```typescript
import { createTdsGeoServer, StorageProvider } from '@tds-geo/nextjs-integration';
import { prisma } from '@/lib/prisma';

class PrismaStorage implements StorageProvider {
  async upsertPost(article: TdsGeoArticle) {
    const existing = await prisma.post.findUnique({
      where: { tdsGeoId: article.id }
    });

    if (existing) {
      return prisma.post.update({
        where: { id: existing.id },
        data: { title: article.title, content: article.content, /* ... */ }
      });
    }

    return prisma.post.create({
      data: { tdsGeoId: article.id, title: article.title, /* ... */ }
    });
  }
  // ... implement other methods
}

const tds-geo = createTdsGeoServer({
  apiKey: process.env.TDS_GEO_API_KEY!,
  storage: new PrismaStorage(),
});
```

### Debug logging

```typescript
const tds-geo = createTdsGeoServer({
  apiKey: process.env.TDS_GEO_API_KEY!,
  debug: true,
});
```

## Development

```bash
git clone https://github.com/yusuf-mohamed0/tds-geo
cd tds-geo-nextjs-integration
npm install
npm run build
npm run typecheck
```

## Publishing to npm

```bash
npm login
npm publish --access public
```

## License

MIT — © TDS Geo
