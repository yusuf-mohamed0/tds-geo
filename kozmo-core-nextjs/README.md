# @kozmo-core/nextjs-integration

**Integrate AI-generated SEO content from KOZMO Core into your Next.js App Router site.**

Receive articles from KOZMO Core via REST API or webhooks, store them locally with automatic ISR revalidation, and render beautiful blog pages with pre-built React components.

---

## Features

- **📥 Receive content** — REST API endpoints to receive articles from KOZMO Core
- **⚡ ISR revalidation** — Automatic `revalidateTag`/`revalidatePath` triggers when content changes
- **💾 Pluggable storage** — JSON file storage included; implement your own for SQLite/PostgreSQL/Prisma
- **🎨 React components** — Drop-in `KozmoCoreBlogList`, `KozmoCoreBlogPost`, and `KozmoCoreContent` components
- **🔑 API key auth** — Secure all endpoints with shared secret via `X-KOZMO-Core-Key` header
- **🌐 Webhooks** — Real-time content push from KOZMO Core (`article.created`, `article.updated`, `article.deleted`)
- **📝 Markdown + HTML** — Accepts and renders both markdown and HTML content
- **🧩 Fully typed** — TypeScript types mirroring KOZMO Core's content schema

## Installation

```bash
npm install @kozmo-core/nextjs-integration
```

**Peer dependencies** (must be installed in your project):
- `next` ^14.0.0 || ^15.0.0
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

### 1. Set your API key

```env
# .env.local
KOZMO_CORE_API_KEY=your-kozmo-core-api-key-here
```

### 2. Create API route files

**`app/api/kozmo-core/posts/route.ts`** — List and create posts:

```typescript
import { createKozmoCoreServer } from '@kozmo-core/nextjs-integration/server';

const kozmo-core = createKozmoCoreServer({
  apiKey: process.env.KOZMO_CORE_API_KEY!,
});

export const GET = kozmo-core.handlers.posts.GET;
export const POST = kozmo-core.handlers.posts.POST;
```

**`app/api/kozmo-core/posts/[id]/route.ts`** — Get, update, delete a single post:

```typescript
import { createKozmoCoreServer } from '@kozmo-core/nextjs-integration/server';

const kozmo-core = createKozmoCoreServer({
  apiKey: process.env.KOZMO_CORE_API_KEY!,
});

export const GET = kozmo-core.handlers.post.GET;
export const PUT = kozmo-core.handlers.post.PUT;
export const DELETE = kozmo-core.handlers.post.DELETE;
```

**`app/api/kozmo-core/webhook/route.ts`** — Receive real-time events from KOZMO Core:

```typescript
import { createKozmoCoreServer } from '@kozmo-core/nextjs-integration/server';

const kozmo-core = createKozmoCoreServer({
  apiKey: process.env.KOZMO_CORE_API_KEY!,
});

export const POST = kozmo-core.handlers.webhook.POST;
```

### 3. Build your blog pages

**`app/blog/page.tsx`** — Blog listing page:

```typescript
import { KozmoCoreBlogList } from '@kozmo-core/nextjs-integration/components';
import { FileStorage } from '@kozmo-core/nextjs-integration';
import { KOZMO_CORE_TAG } from '@kozmo-core/nextjs-integration';

export const revalidate = 3600; // Fallback revalidation (1 hour)

export default async function BlogPage() {
  const storage = new FileStorage();
  const { posts, totalPages } = await storage.listPosts({ limit: 12 });

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <KozmoCoreBlogList posts={posts} totalPages={totalPages} />
    </div>
  );
}
```

**`app/blog/[slug]/page.tsx`** — Single blog post page:

```typescript
import { notFound } from 'next/navigation';
import { KozmoCoreBlogPost } from '@kozmo-core/nextjs-integration/components';
import { FileStorage } from '@kozmo-core/nextjs-integration';

export const revalidate = 3600;

export default async function PostPage({ params }: { params: { slug: string } }) {
  const storage = new FileStorage();
  const post = await storage.getPostBySlug(params.slug);

  if (!post) notFound();

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <KozmoCoreBlogPost post={post} showShareButtons />
    </article>
  );
}
```

## Architecture

```
KOZMO Core Platform                    Your Next.js Site
┌──────────────┐    HTTP/HTTPS    ┌─────────────────────────────┐
│              │                  │                             │
│  Content     │ ──── POST ─────▶ │  /api/kozmo-core/posts          │
│  Generation  │     (create)     │  /api/kozmo-core/posts/[id]     │
│  Pipeline    │                  │  /api/kozmo-core/webhook        │
│              │ ◀─── revalidate─ │                             │
│  Webhook     │    (ISR tag)     │  ┌─────────────────────┐   │
│  Dispatcher  │                  │  │  FileStorage        │   │
│              │                  │  │  (.kozmo-core/*.json)   │   │
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

All handlers are created via `createKozmoCoreServer(config)`.

#### `GET /api/kozmo-core/posts`
List all posts with optional filtering:
- `?status=published` — Filter by status
- `?tag=seo` — Filter by tag
- `?limit=20&offset=0` — Pagination

#### `POST /api/kozmo-core/posts`
Create a new post. Requires `X-KOZMO-Core-Key` header.
Body: `{ title, content, slug?, tags?, metaTitle?, ... }`

#### `GET /api/kozmo-core/posts/[id]`
Get a single post by local ID, slug, or KOZMO Core article ID.

#### `PUT /api/kozmo-core/posts/[id]`
Update a post. Requires `X-KOZMO-Core-Key` header.

#### `DELETE /api/kozmo-core/posts/[id]`
Delete a post. Requires `X-KOZMO-Core-Key` header.

#### `POST /api/kozmo-core/webhook`
Receive real-time events. Requires `X-KOZMO-Core-Key` header.
Events: `article.created`, `article.updated`, `article.deleted`, `ping`

### Storage Providers

**FileStorage** (default) — Stores posts as JSON files in `.kozmo-core/`:

```typescript
import { FileStorage } from '@kozmo-core/nextjs-integration';

const storage = new FileStorage('.kozmo-core');  // default
```

**Custom Storage** — Implement the `StorageProvider` interface:

```typescript
import { StorageProvider, KozmoCoreArticle, KozmoCorePost } from '@kozmo-core/nextjs-integration';

class MyDatabaseStorage implements StorageProvider {
  async upsertPost(article: KozmoCoreArticle): Promise<KozmoCorePost> {
    // Store in your database
  }
  // ... implement all required methods
}
```

### Revalidation

```typescript
import {
  revalidateKozmoCorePost,        // Revalidate a single post
  revalidateAllKozmoCoreContent,  // Revalidate all KOZMO Core content
  getKozmoCoreTags,               // Get cache tags for a post
  KOZMO_CORE_TAG,                  // 'kozmo-core' — the default cache tag
} from '@kozmo-core/nextjs-integration';
```

## Advanced Usage

### Using with your own database (Prisma example)

```typescript
import { createKozmoCoreServer, StorageProvider } from '@kozmo-core/nextjs-integration';
import { prisma } from '@/lib/prisma';

class PrismaStorage implements StorageProvider {
  async upsertPost(article: KozmoCoreArticle) {
    const existing = await prisma.post.findUnique({
      where: { kozmoCoreId: article.id }
    });

    if (existing) {
      return prisma.post.update({
        where: { id: existing.id },
        data: { title: article.title, content: article.content, /* ... */ }
      });
    }

    return prisma.post.create({
      data: { kozmoCoreId: article.id, title: article.title, /* ... */ }
    });
  }
  // ... implement other methods
}

const kozmo-core = createKozmoCoreServer({
  apiKey: process.env.KOZMO_CORE_API_KEY!,
  storage: new PrismaStorage(),
});
```

### Debug logging

```typescript
const kozmo-core = createKozmoCoreServer({
  apiKey: process.env.KOZMO_CORE_API_KEY!,
  debug: true,
});
```

## Development

```bash
git clone https://github.com/yusuf-mohamed0/KOZMO-Core
cd kozmo-core-nextjs-integration
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

MIT — © KOZMO Core
