// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import OpenAI from 'openai';
import { logger } from '../utils/logger';

const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || '';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!API_KEY) {
      throw new Error('OPENAI_API_KEY not configured — LLM provider unavailable');
    }
    client = new OpenAI({
      apiKey: API_KEY,
      ...(BASE_URL ? { baseURL: BASE_URL } : {}),
    });
  }
  return client;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
}

export interface LlmResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export async function generate(
  messages: LlmMessage[],
  options: LlmOptions = {},
): Promise<LlmResponse> {
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o';
  const maxTokens = options.maxTokens ?? 4096;
  const temperature = options.temperature ?? 0.7;

  try {
    const response = await getClient().chat.completions.create({
      model,
      messages: messages as any,
      max_tokens: maxTokens,
      temperature,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    });

    return {
      content: response.choices[0].message.content || '',
      usage: response.usage
        ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens }
        : undefined,
    };
  } catch (err) {
    logger.error('LLM generation failed', { model, error: (err as Error).message });
    throw err;
  }
}

export async function generateJson<T>(
  messages: LlmMessage[],
  options: LlmOptions = {},
): Promise<T> {
  const result = await generate(messages, { ...options, responseFormat: { type: 'json_object' } });
  return JSON.parse(result.content) as T;
}

export function isConfigured(): boolean {
  return !!API_KEY;
}
