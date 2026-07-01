# Brand Voice & AI Knowledge Per Client

## 1. Brand Voice (Per-Client)

### Storage — Two Layers

**Layer A: Simple column on `clients` table (fallback)**

`brand_voice TEXT DEFAULT 'professional and educational'`

A quick tone description used when no detailed profile exists.

**Layer B: `brand_voice_profiles` table (rich, structured)**

One profile per client. Stored as JSONB columns:

| Column | Example |
|---|---|
| `tone_profile` | `{"primary":"professional","secondary":"educational","formality":0.7,"enthusiasm":0.5,"empathy":0.6}` |
| `vocabulary_profile` | `{"preferred_terms":{"ROI":"return on investment"},"avoided_terms":["cutting-edge"],"power_words":["proven","expert"]}` |
| `audience_profile` | `{"demographics":{"industry":"healthcare","size":"SME"},"pain_points":["compliance","time"],"reading_level":"intermediate"}` |
| `formatting_preferences` | `{"heading_style":"sentence","paragraph_length":"medium","use_bullets":true}` |
| `forbidden_phrases` | `["game-changer","synergy","disruptive"]` |
| `preferred_terminology` | `{"CAC":"customer acquisition cost","SaaS":"software as a service"}` |
| `sample_content` | Example paragraphs showing desired writing style |
| `writing_fingerprint` | 1536-dim embedding vector of existing content |

### How It Works in the Pipeline

```
Before writing:
  1. Load brand voice profile for this client
  2. Find similar content snippets (vector similarity)
  3. Build brand instruction block
  4. Inject into AI prompt

After writing:
  5. Check for forbidden phrases
  6. Score tone consistency (0-100)
  7. Flag violations
```

### API Endpoints

All at `/api/brand-voice/{clientId}`:
- `GET /` — Get profile
- `PUT /` — Create/update profile
- `GET /guidance` — Get content guidance prompt
- `POST /consistency-check` — Check article against brand voice
- `POST /embeddings` — Store a sample content embedding
- `GET /fingerprint` — Analyze writing fingerprint stats

## 2. Knowledge Base (RAG System)

Each client can have **multiple knowledge bases**. Each KB contains documents that are chunked and embedded for semantic search.

### Flow

```
1. Create KB → POST /api/knowledge-bases
2. Upload document → POST /api/knowledge-bases/{id}/documents
3. System processes document:
   a. Chunks it (semantic/paragraph/fixed splitting)
   b. Generates OpenAI embedding for each chunk (1536 dims)
   c. Stores in content_embeddings table with pgvector
4. Query → POST /api/knowledge-bases/recall
   a. Embed the query
   b. Vector similarity search (cosine distance)
   c. Return top matching chunks
```

### Chunking Strategies

| Strategy | How It Works |
|---|---|
| `semantic` | Split on paragraph breaks, overlap 50 chars |
| `paragraph` | Split on blank lines |
| `fixed` | Split every 500 words, 50 word overlap |

### How It Feeds Article Generation

During article generation, the pipeline:
1. Takes the topic/keyword
2. Searches ALL client KBs for relevant content
3. Finds 3-5 most relevant document chunks
4. Injects them into the AI prompt as reference context

This ensures articles stay consistent with client-provided reference materials (product docs, brand guidelines, etc.).

## 3. Website Intelligence (Scraped Data)

Each client's website is scraped. See `04-WEBSITE_SCRAPING.md` for full details.

The scraped data is injected into every article prompt as a "client intelligence" block — so the AI knows the client's services, audience, tone, and terminology.

## 4. Knowledge Graph

Entities and relationships extracted from published articles. Used to:
- Avoid repeating topics
- Suggest related/supplementary topics
- Build internal link networks

## Summary — Everything Is Per-Client

| Feature | Per-Client? | Storage |
|---|---|---|
| Brand voice profile | ✅ Yes | `brand_voice_profiles` + embeddings |
| Knowledge base (RAG) | ✅ Yes (multiple KBs per client) | `knowledge_bases` + `kb_documents` + `content_embeddings` |
| Website intelligence | ✅ Yes (one record per client) | `website_intelligence` |
| Writing fingerprint | ✅ Yes | `brand_voice_embeddings` |
| Knowledge graph | ✅ Yes | `knowledge_graph_entities` + `relationships` |
| Pipeline config | ✅ Yes | `clients` table columns |
| Prompt templates | ❌ Global (shared) | `prompt_templates` table |
