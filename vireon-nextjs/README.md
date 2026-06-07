# @vireon/nextjs-integration

**Integrate AI-generated SEO content from Vireon into your Next.js App Router site.**

Receive articles from Vireon via REST API or webhooks, store them locally with automatic ISR revalidation, and render beautiful blog pages with pre-built React components.

---

## Features

- **📥 Receive content** — REST API endpoints to receive articles from Vireon
- **⚡ ISR revalidation** — Automatic `revalidateTag`/`revalidatePath` triggers when content changes
- **💾 Pluggable storage** — JSON file storage included; implement your own for SQLite/PostgreSQL/Prisma
- **🎨 React components** — Drop-in `VireonBlogList`, `VireonBlogPost`, and `VireonContent` components
- **🔑 API key auth** — Secure all endpoints with shared secret via `X-Vireon-Key` header
- **🌐 Webhooks** — Real-time content push from Vireon (`article.created`, `article.updated`, `article.deleted`)
- **📝 Markdown + HTML** — Accepts and renders both markdown and HTML content
- **🧩 Fully typed** — TypeScript types mirroring Vireon's content schema

## Installation

```bash
npm install @vireon/nextjs-integration
```

**Peer dependencies** (must be installed in your project):
- `next` ^14.0.0 || ^15.0.0
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

### 1. Set your API key

```env
# .env.local
VIREON_API_KEY=your-vireon-api-key-here
```

### 2. Create API route files

**`app/api/vireon/posts/route.ts`** — List and create posts:

```typescript
import { createVireonServer } from '@vireon/nextjs-integration/server';

const vireon = createVireonServer({
  apiKey: process.env.VIREON_API_KEY!,
});

export const GET = vireon.handlers.posts.GET;
export const POST = vireon.handlers.posts.POST;
```

**`app/api/vireon/posts/[id]/route.ts`** — Get, update, delete a single post:

```typescript
import { createVireonServer } from '@vireon/nextjs-integration/server';

const vireon = createVireonServer({
  apiKey: process.env.VIREON_API_KEY!,
});

export const GET = vireon.handlers.post.GET;
export const PUT = vireon.handlers.post.PUT;
export const DELETE = vireon.handlers.post.DELETE;
```

**`app/api/vireon/webhook/route.ts`** — Receive real-time events from Vireon:

```typescript
import { createVireonServer } from '@vireon/nextjs-integration/server';

const vireon = createVireonServer({
  apiKey: process.env.VIREON_API_KEY!,
});

export const POST = vireon.handlers.webhook.POST;
```

### 3. Build your blog pages

**`app/blog/page.tsx`** — Blog listing page:

```typescript
import { VireonBlogList } from '@vireon/nextjs-integration/components';
import { FileStorage } from '@vireon/nextjs-integration';
import { VIREON_TAG } from '@vireon/nextjs-integration';

export const revalidate = 3600; // Fallback revalidation (1 hour)

export default async function BlogPage() {
  const storage = new FileStorage();
  const { posts, totalPages } = await storage.listPosts({ limit: 12 });

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <VireonBlogList posts={posts} totalPages={totalPages} />
    </div>
  );
}
```

**`app/blog/[slug]/page.tsx`** — Single blog post page:

```typescript
import { notFound } from 'next/navigation';
import { VireonBlogPost } from '@vireon/nextjs-integration/components';
import { FileStorage } from '@vireon/nextjs-integration';

export const revalidate = 3600;

export default async function PostPage({ params }: { params: { slug: string } }) {
  const storage = new FileStorage();
  const post = await storage.getPostBySlug(params.slug);

  if (!post) notFound();

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <VireonBlogPost post={post} showShareButtons />
    </article>
  );
}
```

## Architecture

```
Vireon Platform                    Your Next.js Site
┌──────────────┐    HTTP/HTTPS    ┌─────────────────────────────┐
│              │                  │                             │
│  Content     │ ──── POST ─────▶ │  /api/vireon/posts          │
│  Generation  │     (create)     │  /api/vireon/posts/[id]     │
│  Pipeline    │                  │  /api/vireon/webhook        │
│              │ ◀─── revalidate─ │                             │
│  Webhook     │    (ISR tag)     │  ┌─────────────────────┐   │
│  Dispatcher  │                  │  │  FileStorage        │   │
│              │                  │  │  (.vireon/*.json)   │   │
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

All handlers are created via `createVireonServer(config)`.

#### `GET /api/vireon/posts`
List all posts with optional filtering:
- `?status=published` — Filter by status
- `?tag=seo` — Filter by tag
- `?limit=20&offset=0` — Pagination

#### `POST /api/vireon/posts`
Create a new post. Requires `X-Vireon-Key` header.
Body: `{ title, content, slug?, tags?, metaTitle?, ... }`

#### `GET /api/vireon/posts/[id]`
Get a single post by local ID, slug, or Vireon article ID.

#### `PUT /api/vireon/posts/[id]`
Update a post. Requires `X-Vireon-Key` header.

#### `DELETE /api/vireon/posts/[id]`
Delete a post. Requires `X-Vireon-Key` header.

#### `POST /api/vireon/webhook`
Receive real-time events. Requires `X-Vireon-Key` header.
Events: `article.created`, `article.updated`, `article.deleted`, `ping`

### Storage Providers

**FileStorage** (default) — Stores posts as JSON files in `.vireon/`:

```typescript
import { FileStorage } from '@vireon/nextjs-integration';

const storage = new FileStorage('.vireon');  // default
```

**Custom Storage** — Implement the `StorageProvider` interface:

```typescript
import { StorageProvider, VireonArticle, VireonPost } from '@vireon/nextjs-integration';

class MyDatabaseStorage implements StorageProvider {
  async upsertPost(article: VireonArticle): Promise<VireonPost> {
    // Store in your database
  }
  // ... implement all required methods
}
```

### Revalidation

```typescript
import {
  revalidateVireonPost,        // Revalidate a single post
  revalidateAllVireonContent,  // Revalidate all Vireon content
  getVireonTags,               // Get cache tags for a post
  VIREON_TAG,                  // 'vireon' — the default cache tag
} from '@vireon/nextjs-integration';
```

## Advanced Usage

### Using with your own database (Prisma example)

```typescript
import { createVireonServer, StorageProvider } from '@vireon/nextjs-integration';
import { prisma } from '@/lib/prisma';

class PrismaStorage implements StorageProvider {
  async upsertPost(article: VireonArticle) {
    const existing = await prisma.post.findUnique({
      where: { vireonId: article.id }
    });

    if (existing) {
      return prisma.post.update({
        where: { id: existing.id },
        data: { title: article.title, content: article.content, /* ... */ }
      });
    }

    return prisma.post.create({
      data: { vireonId: article.id, title: article.title, /* ... */ }
    });
  }
  // ... implement other methods
}

const vireon = createVireonServer({
  apiKey: process.env.VIREON_API_KEY!,
  storage: new PrismaStorage(),
});
```

### Debug logging

```typescript
const vireon = createVireonServer({
  apiKey: process.env.VIREON_API_KEY!,
  debug: true,
});
```

## Development

```bash
git clone https://github.com/yusuf-mohamed0/vireon-nextjs-integration
cd vireon-nextjs-integration
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

MIT — © Vireon
