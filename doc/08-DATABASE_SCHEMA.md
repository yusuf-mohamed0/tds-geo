# Database Schema

## Overview

PostgreSQL 16 with extensions: `uuid-ossp`, `pg_trgm`, `vector` (pgvector for embeddings).

All tables use UUID primary keys. Every client-scoped table references `clients(id)` with `ON DELETE CASCADE`.

## Core Tables

### clients (root tenant table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(255) | Business name |
| `slug` | VARCHAR(100) UNIQUE | URL-friendly identifier |
| `shopify_shop` | VARCHAR(255) | Store domain |
| `shopify_token` | TEXT | Access token |
| `shopify_api_version` | VARCHAR(50) | Default: 2025-07 |
| `brand_voice` | TEXT | Fallback tone (default: 'professional and educational') |
| `approval_mode` | VARCHAR(20) | auto or manual |
| `monthly_token_limit` | INTEGER | |
| `monthly_cost_limit` | DECIMAL(10,2) | |
| `is_active` | BOOLEAN | |
| `settings` | JSONB | Flexible settings |
| `billing_plan` | VARCHAR(50) | starter/professional/enterprise |
| `billing_status` | VARCHAR(20) | pending/active/cancelled/declined |

### users (auth + roles)

| Column | Type | FK |
|---|---|---|
| `id` | UUID PK | |
| `email` | VARCHAR(255) UNIQUE | |
| `password_hash` | VARCHAR(255) | bcrypt |
| `role` | VARCHAR(20) | super_admin / admin / editor / client |
| `client_id` | UUID | → clients(id), nullable for super_admins |
| `is_active` | BOOLEAN | |

### articles (generated content)

| Column | Type | FK |
|---|---|---|
| `id` | UUID PK | |
| `client_id` | UUID | → clients(id) CASCADE |
| `keyword_id` | UUID | → keywords(id) SET NULL |
| `title` | TEXT | |
| `content_md` | TEXT | Markdown |
| `content_html` | TEXT | HTML |
| `status` | VARCHAR(20) | draft/generated/reviewed/approved/rejected/published/failed/archived |
| `pipeline_stage` | VARCHAR(50) | draft/title/outline/article/seo_enhanced/.../complete |
| `seo_score` | DECIMAL(5,1) | |
| `readability_score` | DECIMAL(5,1) | |
| `quality_score` | DECIMAL(5,1) | |
| `eat_score` | DECIMAL(5,1) | E-E-A-T score |

### keywords

| Column | Type | FK |
|---|---|---|
| `id` | UUID PK | |
| `client_id` | UUID | → clients(id) CASCADE |
| `keyword` | VARCHAR(500) | |
| `cluster_id` | UUID | → keyword_clusters(id) |
| `search_volume` | INTEGER | |
| `competition` | VARCHAR(20) | low/medium/high |
| `intent` | VARCHAR(20) | informational/commercial/transactional/navigational |
| UNIQUE(client_id, keyword) | | |

## Content & Publishing

| Table | Purpose | FK |
|---|---|---|
| `article_images` | Featured + section images | article_id → articles |
| `publishing_history` | Publish attempts + results | article_id → articles |
| `publishing_queue` | Scheduled publishing jobs | article_id → articles |
| `internal_links_cache` | Suggested internal links | source/target → articles |
| `content_embeddings` | Vector embeddings for RAG | article_id → articles, kb_document_id → kb_documents |

## Brand Voice & Knowledge

| Table | Purpose | FK |
|---|---|---|
| `brand_voice_profiles` | Per-client voice profile (UNIQUE) | client_id → clients |
| `brand_voice_embeddings` | Voice sample embeddings | client_id → clients |
| `knowledge_bases` | Per-client KBs | client_id → clients |
| `kb_documents` | Documents within KBs | knowledge_base_id → knowledge_bases |
| `content_embeddings` | Vector store for RAG | client_id → clients |
| `knowledge_graph_entities` | Entity graph | client_id → clients |
| `knowledge_graph_relationships` | Entity relationships | client_id → clients |

## Scraping & Intelligence

| Table | Purpose | FK |
|---|---|---|
| `website_intelligence` | Scraped website data (UNIQUE per client) | client_id → clients |
| `crawler_visits` | AI crawler visit logs | client_id → clients |
| `article_memory` | Published article history | client_id → clients |

## Operations

| Table | Purpose |
|---|---|
| `schedules` | Content generation schedules (cron/interval) |
| `jobs` | Background job tracking |
| `workflow_logs` | Pipeline stage execution logs |
| `cost_tracking` | Per-article cost (OpenAI, SerpAPI, Shopify) |
| `api_usage` | API rate limit tracking |
| `activity_logs` | Audit trail |
| `billing_events` | Billing lifecycle events |
| `webhooks` | Webhook subscriptions |
| `webhook_deliveries` | Webhook delivery logs |

## Auth & Security

| Table | Purpose |
|---|---|
| `shopify_oauth_states` | OAuth state parameter storage |
| `shopify_sessions` | Shopify session tokens |
| `device_registry` | Device-bound auth |
| `employee_sessions` | Employee login sessions |
| `permission_matrix` | Role-based access rules |
| `audit_log` | Compliance-grade audit |
| `secret_rotation` | Secret rotation tracking |

## Plugins & Prompts

| Table | Purpose |
|---|---|
| `plugin_registry` | Registered plugins |
| `plugin_instances` | Per-client plugin instances |
| `prompt_templates` | Global prompt templates |
| `prompt_versions` | Versioned prompt history |

## Integrations

| Table | Purpose |
|---|---|
| `cms_connections` | CMS connector config (WordPress, etc.) |
| `odoo_connections` | Odoo ERP connections |
| `connected_sites` | Connected external sites |

## Key Relationships

```
clients ──┬── users (N:1)              # Client has many users
           ├── articles (N:1)           # Client has many articles
           ├── keywords (N:1)           # Client has many keywords
           ├── brand_voice_profiles (1:1) # One profile per client
           ├── knowledge_bases (N:1)    # Client has many KBs
           ├── website_intelligence (1:1) # One scraped record
           ├── schedules (N:1)          # Publishing schedules
           ├── cms_connections (N:1)    # CMS connections
           └── billing_events (N:1)     # Billing history

articles ──┬── article_images (N:1)
            ├── publishing_history (N:1)
            ├── content_embeddings (N:1)
            ├── cost_tracking (N:1)
            ├── workflow_logs (N:1)
            └── keywords (N:1, optional)

knowledge_bases ──┬── kb_documents (N:1)
                   └── content_embeddings (N:1 through kb_document_id)
```

## Migration Files

| File | Tables Added |
|---|---|
| `schema.sql` | Core tables (clients, users, articles, keywords, etc.) |
| `migration_enterprise_v4.sql` | Brand voice, KB graph, editorial, connectors (largest migration) |
| `migration_aeo_v5.sql` | Knowledge bases, KB documents, crawler visits |
| `migration_billing_v1.sql` | Billing columns + billing_events |
| `migration_website_intelligence.sql` | Website scraper data |
| `migration_device_auth.sql` | Device registry + RLS |
| `migration_odoo_v1.sql` | Odoo ERP integration |
| `migration_worker_scoring.sql` | Worker performance scoring |
| `migration_global_memory.sql` | Article memory table |
