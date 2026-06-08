// ──────────────────────────────────────────────
// AirLLM Local Inference Client
// HTTP client for the Python FastAPI microservice
// wrapping AirLLM for local LLM inference.
// ──────────────────────────────────────────────

import { logger } from '../utils/logger';

const AIRLLM_BASE_URL = process.env.AIRLLM_URL || 'http://127.0.0.1:8531';

export interface GenerateResponse {
  text: string;
  tokens_generated: number;
  time_ms: number;
  model: string;
}

class LocalLLMClient {
  private baseUrl: string;
  private healthy = false;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || AIRLLM_BASE_URL;
  }

  async healthCheck(): Promise<{ healthy: boolean; modelLoaded: boolean; model: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        this.healthy = true;
        const data = await res.json() as { status?: string; model?: string; model_loaded?: boolean };
        return {
          healthy: data.status?.startsWith('healthy') ?? false,
          modelLoaded: data.model_loaded ?? false,
          model: data.model ?? 'not_set',
        };
      }
      this.healthy = false;
      return { healthy: false, modelLoaded: false, model: 'unreachable' };
    } catch {
      this.healthy = false;
      return { healthy: false, modelLoaded: false, model: 'unreachable' };
    }
  }

  get isHealthy(): boolean {
    return this.healthy;
  }

  async loadModel(modelName: string, compression?: '4bit' | '8bit'): Promise<void> {
    const res = await fetch(`${this.baseUrl}/model/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName, compression }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((errBody as { detail?: string }).detail || 'Failed to load model');
    }
  }

  async generate(prompt: string, options?: {
    maxNewTokens?: number;
    temperature?: number;
  }): Promise<GenerateResponse> {
    const res = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        max_new_tokens: options?.maxNewTokens ?? 128,
        temperature: options?.temperature ?? 0.7,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((errBody as { detail?: string }).detail || 'Generation failed');
    }
    return res.json() as Promise<GenerateResponse>;
  }
}

export default new LocalLLMClient();
