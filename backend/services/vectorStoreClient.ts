// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// turbovec Vector Store Client
// HTTP client that talks to the Python FastAPI
// microservice wrapping turbovec.
// ──────────────────────────────────────────────

import { logger } from '../utils/logger';

const TVEC_BASE_URL = process.env.TVEC_URL || 'http://127.0.0.1:8530';

export interface IndexInfo {
  name: string;
  dim: number;
  bit_width: number;
  use_id_map: boolean;
  count: number;
}

export interface SearchResult {
  scores: number[];
  indices: number[];
}

class VectorStoreClient {
  private baseUrl: string;
  private healthy = false;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || TVEC_BASE_URL;
  }

  // ─── Health ─────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        this.healthy = true;
        const data = await res.json() as { indices?: unknown[] };
        logger.info('turbovec vector store healthy', { indices: data.indices?.length ?? 0 });
        return true;
      }
      return false;
    } catch {
      this.healthy = false;
      return false;
    }
  }

  get isHealthy(): boolean {
    return this.healthy;
  }

  // ─── Index Management ───────────────────────

  async createIndex(name: string, dim = 1536, bitWidth = 4, useIdMap = false): Promise<void> {
    const res = await fetch(`${this.baseUrl}/index/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, dim, bit_width: bitWidth, use_id_map: useIdMap }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      const errMsg = (errBody as { detail?: string }).detail || res.statusText;
      throw new Error(`Failed to create index '${name}': ${errMsg}`);
    }
  }

  // ─── Vectors ────────────────────────────────

  async addVectors(name: string, vectors: number[][], ids?: number[]): Promise<number> {
    const body: Record<string, unknown> = { name, vectors };
    if (ids) body.ids = ids;

    const res = await fetch(`${this.baseUrl}/index/${encodeURIComponent(name)}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      const errMsg = (errBody as { detail?: string }).detail || res.statusText;
      throw new Error(`Failed to add vectors: ${errMsg}`);
    }
    const data = await res.json() as { total?: number };
    return data.total ?? 0;
  }

  async search(name: string, query: number[], k = 10, allowlist?: number[]): Promise<SearchResult> {
    const body: Record<string, unknown> = { name, query, k };
    if (allowlist) body.allowlist = allowlist;

    const res = await fetch(`${this.baseUrl}/index/${encodeURIComponent(name)}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      const errMsg = (errBody as { detail?: string }).detail || res.statusText;
      throw new Error(`Search failed: ${errMsg}`);
    }
    return res.json() as Promise<SearchResult>;
  }

  async removeVector(name: string, id: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/index/${encodeURIComponent(name)}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      const errMsg = (errBody as { detail?: string }).detail || res.statusText;
      throw new Error(`Failed to remove vector: ${errMsg}`);
    }
  }

  async saveIndex(name: string, path?: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/index/${encodeURIComponent(name)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path }),
    });
    if (!res.ok) throw new Error(`Failed to save index '${name}'`);
    const data = await res.json() as { path?: string };
    return data.path ?? '';
  }

  async loadIndex(name: string, path: string, dim = 1536, bitWidth = 4): Promise<void> {
    const res = await fetch(`${this.baseUrl}/index/${encodeURIComponent(name)}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path, dim, bit_width: bitWidth }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      const errMsg = (errBody as { detail?: string }).detail || res.statusText;
      throw new Error(`Failed to load index '${name}': ${errMsg}`);
    }
  }

  async deleteIndex(name: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/index/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete index '${name}'`);
  }

  async listIndices(): Promise<IndexInfo[]> {
    const res = await fetch(`${this.baseUrl}/indices`);
    if (!res.ok) return [];
    const data = await res.json() as { indices?: IndexInfo[] };
    return data.indices ?? [];
  }
}

export default new VectorStoreClient();
